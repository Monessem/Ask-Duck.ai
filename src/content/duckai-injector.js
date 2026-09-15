/**
 * Duck.ai Injector (v4.7 — RTL/LTR forcing + prompt injection)
 * ------------------------------------------------------------------
 * Content script on https://duck.ai/* pages.
 *
 * Features:
 *   1. Reads prompt ID from URL hash (#p=<id>) and injects into chat
 *   2. FORCES text direction (RTL/LTR) on the entire duck.ai domain:
 *      - Sets <html dir="rtl|ltr">
 *      - Sets <body dir="rtl|ltr">
 *      - Injects CSS to force direction on all text elements
 *      - Keeps code blocks LTR always
 *   3. Handles CAPTCHA
 *   4. Reads direction from settings, not from prompt suffix
 * ------------------------------------------------------------------
 */

(function () {
  'use strict';

  // Cross-browser: Firefox has `browser`, Chromium has `chrome`.
  var browser = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  if (!browser) {
    console.error('[Ask Duck.ai] No browser API found in injector');
    return;
  }

  const PROMPTS_KEY = 'duckai.prompts';
  const SETTINGS_KEY = 'duckai.settings';
  const POLL_MS = 150;
  const MAX_WAIT_MS = 30000;

  if (window.__duckaiInjectorLoaded) return;
  window.__duckaiInjectorLoaded = true;

  console.log('[Ask Duck.ai] Injector loaded on', location.href);

  let processing = false;
  let captchaActive = false;
  let processedId = null;
  let currentDirection = null;
  let dirTimer = null;
  let checkTimer = null;

  // Start with a single check after a short delay.
  setTimeout(check, 200);

  // Listen for hash changes (when a new prompt is sent).
  window.addEventListener('hashchange', () => {
    // Reset processedId so we can process a new prompt on the same tab.
    processedId = null;
    setTimeout(check, 100);
  });

  // Apply text direction with debounce (not on every mutation).
  // Duck.ai is a SPA — React re-renders constantly. A 500ms debounce
  // is sufficient and dramatically reduces CPU usage.
  function debouncedApplyDirection() {
    if (dirTimer) clearTimeout(dirTimer);
    dirTimer = setTimeout(function () {
      dirTimer = null;
      applyTextDirection();
    }, 500);
  }

  // Initial direction application.
  applyTextDirection();

  // Re-apply on DOM changes, but DEBOUNCED to avoid CPU spikes.
  // Only observe childList changes (not attribute changes — those
  // fire too frequently on React apps and cause performance issues).
  const dirObserver = new MutationObserver(debouncedApplyDirection);
  if (document.documentElement) {
    dirObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
      // Removed: attributes: true, attributeFilter: ['dir', 'style', 'class']
      // These fire too often on React apps. The 500ms debounce on
      // childList changes is more than enough.
    });
  }

  // Cleanup on page unload to prevent memory leaks.
  window.addEventListener('pagehide', function () {
    if (dirTimer) { clearTimeout(dirTimer); dirTimer = null; }
    if (checkTimer) { clearTimeout(checkTimer); checkTimer = null; }
    dirObserver.disconnect();
  }, { once: true });

  function storage() {
    return browser.storage.local;
  }

  // ====== Arabic text detection ======
  // Unicode ranges for Arabic script:
  //   U+0600–U+06FF  Arabic
  //   U+0750–U+077F  Arabic Supplement
  //   U+FB50–U+FDFF  Arabic Presentation Forms-A
  //   U+FE70–U+FEFF  Arabic Presentation Forms-B
  var ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;

  /**
   * Check if a text string contains enough Arabic characters to be
   * considered "Arabic text" (needs RTL rendering).
   *
   * Rule: if Arabic characters make up at least 30% of all letter
   * characters (Arabic + Latin letters), treat the text as Arabic.
   * This handles mixed Arabic/English content correctly — a paragraph
   * with one Arabic word in an English sentence stays LTR, but a
   * paragraph that's predominantly Arabic becomes RTL.
   *
   * @param {string} text
   * @returns {boolean}
   */
  function isArabicText(text) {
    if (!text) return false;
    var arabicMatches = text.match(ARABIC_RE);
    var arabicCount = arabicMatches ? arabicMatches.length : 0;
    if (arabicCount === 0) return false;
    // Count Latin letters for comparison.
    var latinMatches = text.match(/[a-zA-Z]/g);
    var latinCount = latinMatches ? latinMatches.length : 0;
    var total = arabicCount + latinCount;
    if (total === 0) return false;
    return (arabicCount / total) >= 0.30;
  }

  // ====== Text Direction (per-message Arabic detection) ======
  // Instead of forcing a single global direction, we detect the
  // language of EACH message individually:
  //   - Arabic-dominant messages → dir="rtl", text-align: right
  //   - English/other messages   → dir="ltr", text-align: left
  //   - Code blocks              → always dir="ltr"
  //
  // This keeps the Duck.ai UI fully LTR (navigation, buttons, icons)
  // while rendering Arabic responses correctly in RTL.
  async function applyTextDirection() {
    try {
      var settings = await getSettings();
      var mode = settings.textDirection || 'auto';

      // Inject the base CSS (only once).
      ensureDirectionStyle();

      if (mode === 'rtl') {
        // Force ALL messages to RTL (user override).
        tagAssistantResponses();
        setAllMessagesDirection('rtl');
        return;
      }
      if (mode === 'ltr') {
        // Force ALL messages to LTR (user override).
        tagAssistantResponses();
        setAllMessagesDirection('ltr');
        return;
      }

      // Auto mode: detect Arabic per message.
      tagAssistantResponses();
      detectAndApplyDirections();
    } catch (e) {
      // Settings not ready yet — retry later.
    }
  }

  /**
   * Inject the base CSS that handles code blocks (always LTR) and
   * the input textarea (auto-detect). This is injected once and
   * doesn't need to change per-message.
   */
  function ensureDirectionStyle() {
    var style = document.getElementById('duckai-rtl-style');
    if (style) return;
    style = document.createElement('style');
    style.id = 'duckai-rtl-style';
    style.textContent =
      /* Code blocks are always LTR, regardless of message direction */
      '[data-testid="user-message"] pre,' +
      '[data-testid="user-message"] code,' +
      '[data-testid="user-message"] + div pre,' +
      '[data-testid="user-message"] + div code,' +
      '[data-duckai-response] pre,' +
      '[data-duckai-response] code,' +
      '[data-testid="assistant-message"] pre,' +
      '[data-testid="assistant-message"] code {' +
        'direction: ltr !important;' +
        'text-align: left !important;' +
      '}' +
      /* Chat input: auto-detect based on content */
      'textarea[name="user-prompt"],' +
      '[data-testid="duckai-chat-input"] textarea {' +
        'unicode-bidi: plaintext !important;' +
      '}';
    document.head.appendChild(style);
  }

  function removeDirectionStyle() {
    var style = document.getElementById('duckai-rtl-style');
    if (style) style.remove();
  }

  /**
   * Force a single direction on all message elements.
   * Used when the user explicitly selects RTL or LTR mode.
   */
  function setAllMessagesDirection(dir) {
    var align = dir === 'rtl' ? 'right' : 'left';
    var selectors = [
      '[data-testid="user-message"]',
      '[data-duckai-response]',
      '[data-testid="assistant-message"]'
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.setAttribute('dir', dir);
        el.style.direction = dir;
        el.style.textAlign = align;
        // Children except code.
        el.querySelectorAll('*:not(pre):not(code)').forEach(function (child) {
          child.setAttribute('dir', dir);
          child.style.direction = dir;
          child.style.textAlign = align;
        });
        // Code → always LTR.
        el.querySelectorAll('pre, code').forEach(function (code) {
          code.setAttribute('dir', 'ltr');
          code.style.direction = 'ltr';
          code.style.textAlign = 'left';
        });
      });
    });
    // Sibling after user-message (untagged responses).
    document.querySelectorAll('[data-testid="user-message"]').forEach(function (userMsg) {
      var sibling = userMsg.nextElementSibling;
      if (sibling && !sibling.hasAttribute('data-duckai-response')) {
        var text = (sibling.textContent || '').trim();
        if (text.indexOf('Anonymized by DuckDuckGo') >= 0) {
          sibling = sibling.nextElementSibling;
        }
      }
      if (sibling) {
        sibling.setAttribute('dir', dir);
        sibling.style.direction = dir;
        sibling.style.textAlign = align;
      }
    });
  }

  /**
   * Auto-detect Arabic text in each message and apply the correct
   * direction individually. This is the core of the per-message
   * RTL/LTR system.
   *
   * - User messages: detect based on the user's input text
   * - Assistant responses: detect based on the response text
   * - Code blocks: always LTR (handled by CSS)
   * - Mixed content: uses unicode-bidi:plaintext for proper rendering
   */
  function detectAndApplyDirections() {
    // User messages.
    document.querySelectorAll('[data-testid="user-message"]').forEach(function (el) {
      var text = el.textContent || '';
      var dir = isArabicText(text) ? 'rtl' : 'ltr';
      applyDirectionToElement(el, dir);
    });

    // Assistant responses (tagged by tagAssistantResponses).
    document.querySelectorAll('[data-duckai-response]').forEach(function (el) {
      var text = el.textContent || '';
      var dir = isArabicText(text) ? 'rtl' : 'ltr';
      applyDirectionToElement(el, dir);
    });

    // Also handle the sibling after user-message (untagged responses).
    document.querySelectorAll('[data-testid="user-message"]').forEach(function (userMsg) {
      var sibling = userMsg.nextElementSibling;
      if (sibling && !sibling.hasAttribute('data-duckai-response')) {
        var text = (sibling.textContent || '').trim();
        if (text.indexOf('Anonymized by DuckDuckGo') >= 0) {
          sibling = sibling.nextElementSibling;
        }
      }
      if (sibling) {
        var sibText = sibling.textContent || '';
        var dir = isArabicText(sibText) ? 'rtl' : 'ltr';
        applyDirectionToElement(sibling, dir);
      }
    });

    // Chat input: use plaintext bidi so it auto-detects as user types.
    document.querySelectorAll('textarea[name="user-prompt"], [data-testid="duckai-chat-input"] textarea').forEach(function (input) {
      input.setAttribute('dir', 'auto');
      input.style.unicodeBidi = 'plaintext';
    });
  }

  /**
   * Apply direction to an element and its children (except code blocks).
   * @param {Element} el
   * @param {string} dir - 'rtl' or 'ltr'
   */
  function applyDirectionToElement(el, dir) {
    var align = dir === 'rtl' ? 'right' : 'left';
    el.setAttribute('dir', dir);
    el.style.direction = dir;
    el.style.textAlign = align;
    // Apply to children except code blocks (which stay LTR via CSS).
    el.querySelectorAll('*:not(pre):not(code):not(pre *):not(code *)').forEach(function (child) {
      child.setAttribute('dir', dir);
      child.style.direction = dir;
      child.style.textAlign = align;
    });
    // Code blocks: force LTR.
    el.querySelectorAll('pre, code').forEach(function (code) {
      code.setAttribute('dir', 'ltr');
      code.style.direction = 'ltr';
      code.style.textAlign = 'left';
    });
  }

  /**
   * Find all user messages and tag the sibling after each one
   * (the assistant response) with data-duckai-response.
   * This runs periodically to catch dynamically added messages.
   */
  function tagAssistantResponses() {
    try {
      var userMsgs = document.querySelectorAll('[data-testid="user-message"]');
      userMsgs.forEach(function (userMsg) {
        var sibling = userMsg.nextElementSibling;
        if (sibling && !sibling.hasAttribute('data-duckai-response')) {
          // Skip if it's the notice/banner div.
          var text = (sibling.textContent || '').trim();
          if (text.indexOf('Anonymized by DuckDuckGo') >= 0) {
            // This is the privacy notice, not the response.
            // Look at the next sibling.
            sibling = sibling.nextElementSibling;
          }
          if (sibling) {
            sibling.setAttribute('data-duckai-response', 'true');
          }
        }
      });
    } catch (e) {
      // Non-fatal.
    }
  }

  async function getSettings() {
    try {
      const result = await storage().get(SETTINGS_KEY);
      return result[SETTINGS_KEY] || { textDirection: 'auto', responseLanguage: 'auto' };
    } catch {
      return { textDirection: 'auto', responseLanguage: 'auto' };
    }
  }

  // ====== Prompt Injection ======
  function getPromptIdFromUrl() {
    const hash = location.hash || '';
    const match = hash.match(/[#&]p=([a-z0-9-]+)/i);
    return match ? match[1] : null;
  }

  async function check() {
    if (processing) return;

    const promptId = getPromptIdFromUrl();
    if (!promptId) return;
    if (promptId === processedId) return;

    const payload = await readPrompt(promptId);
    if (!payload) {
      processedId = promptId;
      return;
    }

    console.log('[Ask Duck.ai] Got prompt:', promptId, 'autoSubmit:', payload.autoSubmit, 'len:', payload.prompt.length);

    if (isCaptchaPage()) {
      if (!captchaActive) {
        captchaActive = true;
        console.log('[Ask Duck.ai] CAPTCHA detected, waiting');
        showCaptchaBanner();
      }
      return;
    }

    if (captchaActive) {
      captchaActive = false;
      removeBanner();
    }

    processing = true;
    processedId = promptId;

    try {
      await inject(payload);
      await deletePrompt(promptId);
      console.log('[Ask Duck.ai] Injection complete');
      try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    } catch (err) {
      console.warn('[Ask Duck.ai] Injection failed:', err.message);
      await fallback(payload.prompt);
      await deletePrompt(promptId);
      try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    } finally {
      processing = false;
    }
  }

  async function readPrompt(id) {
    try {
      const result = await storage().get(PROMPTS_KEY);
      const map = (result[PROMPTS_KEY] && typeof result[PROMPTS_KEY] === 'object') ? result[PROMPTS_KEY] : {};
      return map[id] || null;
    } catch (e) {
      return null;
    }
  }

  async function deletePrompt(id) {
    try {
      const result = await storage().get(PROMPTS_KEY);
      const map = (result[PROMPTS_KEY] && typeof result[PROMPTS_KEY] === 'object') ? result[PROMPTS_KEY] : {};
      if (map[id]) {
        delete map[id];
        await storage().set({ [PROMPTS_KEY]: map });
      }
    } catch (e) {}
  }

  async function inject(payload) {
    const { prompt, autoSubmit } = payload;

    const ta = await waitFor(() => {
      const el = findTextarea();
      if (el && !el.disabled) return el;
      return null;
    }, MAX_WAIT_MS);
    if (!ta) throw new Error('Textarea not found or disabled');

    console.log('[Ask Duck.ai] Textarea found, setting value...');
    ta.focus();
    ta.click();
    setReactValue(ta, prompt);
    await sleep(300);

    if (ta.value !== prompt) {
      setReactValue(ta, prompt);
      await sleep(300);
    }

    if (autoSubmit) {
      const btn = await waitFor(() => {
        const el = findSendButton();
        if (el && !el.disabled) return el;
        return null;
      }, 5000);
      if (btn) {
        btn.click();
        console.log('[Ask Duck.ai] Send clicked');
      } else {
        ta.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true
        }));
      }
    } else {
      showReadyHint();
    }
  }

  function setReactValue(ta, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, value);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function findTextarea() {
    const candidates = [
      'textarea[name="user-prompt"]',
      'textarea[data-testid*="chat-input"]',
      'textarea[placeholder*="Ask"]',
      'textarea[placeholder*="essage"]',
      'form textarea',
      'textarea'
    ];
    for (const sel of candidates) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent !== null) return el;
      }
    }
    return null;
  }

  function findSendButton() {
    const candidates = [
      'button[aria-label="Send"]',
      'button[aria-label="Ask"]',
      'form[data-chat-footer] button[type="submit"]',
      'button[type="submit"]'
    ];
    for (const sel of candidates) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) return btn;
    }
    return null;
  }

  function isCaptchaPage() {
    const url = location.href;
    if (/challenge|captcha|verify/i.test(url)) return true;
    const text = document.body ? document.body.textContent : '';
    if (/bots use DuckDuckGo too/i.test(text)) return true;
    if (/squares containing a duck/i.test(text)) return true;
    if (/complete the following challenge/i.test(text)) return true;
    return false;
  }

  function waitFor(fn, timeout) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        try {
          const val = fn();
          if (val) return resolve(val);
        } catch (e) {}
        if (Date.now() - start >= timeout) return resolve(null);
        setTimeout(tick, POLL_MS);
      };
      tick();
    });
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function fallback(prompt) {
    try {
      await navigator.clipboard.writeText(prompt);
      showBanner('Ask Duck.ai: Prompt copied to clipboard. Paste with Ctrl+V.');
    } catch {
      showBanner('Ask Duck.ai: Could not inject. Copy manually.', prompt);
    }
  }

  function showReadyHint() {
    removeBanner();
    const b = document.createElement('div');
    b.id = 'duckai-banner';
    b.style.cssText = 'position:fixed;top:16px;left:16px;right:16px;z-index:2147483647;' +
      'background:#1e40af;color:#fff;padding:10px 14px;border-radius:8px;' +
      'font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.2);max-width:500px;margin:0 auto;';
    b.textContent = 'Ask Duck.ai: Prompt is ready — click Send.';
    document.body.appendChild(b);
    setTimeout(() => removeBanner(), 5000);
  }

  function showBanner(msg, copyText) {
    removeBanner();
    const b = document.createElement('div');
    b.id = 'duckai-banner';
    b.style.cssText = 'position:fixed;top:16px;left:16px;right:16px;z-index:2147483647;' +
      'background:#1f2937;color:#fff;padding:12px 16px;border-radius:10px;' +
      'font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:600px;margin:0 auto;';
    b.textContent = msg;
    if (copyText) {
      const pre = document.createElement('pre');
      pre.textContent = copyText;
      pre.style.cssText = 'background:rgba(255,255,255,.1);padding:8px;border-radius:6px;font-size:12px;max-height:200px;overflow:auto;white-space:pre-wrap;margin:8px 0 0';
      b.appendChild(pre);
    }
    document.body.appendChild(b);
    setTimeout(() => removeBanner(), 15000);
  }

  function showCaptchaBanner() {
    removeBanner();
    const b = document.createElement('div');
    b.id = 'duckai-banner';
    b.style.cssText = 'position:fixed;top:16px;left:16px;right:16px;z-index:2147483647;' +
      'background:#92400e;color:#fff;padding:14px 16px;border-radius:10px;' +
      'font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:600px;margin:0 auto;';
    b.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = 'Ask Duck.ai:';
    b.appendChild(strong);
    b.appendChild(document.createTextNode(' Solve the verification challenge — your prompt will be sent automatically.'));
    document.body.appendChild(b);
  }

  function removeBanner() {
    const b = document.getElementById('duckai-banner');
    if (b) b.remove();
  }
})();
