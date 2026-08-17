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

  const PROMPTS_KEY = 'duckai.prompts';
  const SETTINGS_KEY = 'duckai.settings';
  const POLL_MS = 150;
  const MAX_WAIT_MS = 30000;

  if (window.__duckaiInjectorLoaded) return;
  window.__duckaiInjectorLoaded = true;

  let processing = false;
  let captchaActive = false;
  let processedId = null;
  let currentDirection = null;

  console.log('[Ask Duck.ai] Injector v4.7 loaded on', location.href);

  // Start immediately.
  setTimeout(check, 100);
  setInterval(check, 500);
  window.addEventListener('hashchange', () => {
    // Reset processedId so we can process a new prompt on the same tab.
    processedId = null;
    setTimeout(check, 100);
  });

  // Apply text direction immediately and re-apply periodically.
  applyTextDirection();
  setInterval(applyTextDirection, 1000);

  // Re-apply on DOM changes (Duck.ai is a SPA).
  const dirObserver = new MutationObserver(() => {
    applyTextDirection();
  });
  if (document.documentElement) {
    dirObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['dir'] });
  }

  function storage() {
    return browser.storage.local;
  }

  // ====== Text Direction Forcing (question + answer only) ======
  async function applyTextDirection() {
    try {
      const settings = await getSettings();
      let dir = settings.textDirection || 'auto';

      // Auto: derive from response language.
      if (dir === 'auto') {
        const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];
        if (settings.responseLanguage && RTL_LANGS.includes(settings.responseLanguage)) {
          dir = 'rtl';
        } else {
          // For auto + non-RTL language, don't force anything.
          removeDirectionStyle();
          currentDirection = null;
          return;
        }
      }

      // Only apply if changed.
      if (dir === currentDirection) return;
      currentDirection = dir;

      // Inject CSS targeting ONLY the question (user message) and answer (assistant message).
      // Duck.ai structure:
      //   - User message: [data-testid="user-message"] contains a div with the text
      //   - Assistant message: rendered in a prose/markdown container after user message
      // We target ONLY the text content divs, not the whole message wrapper,
      // to avoid affecting avatars, timestamps, buttons, etc.
      let style = document.getElementById('duckai-rtl-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'duckai-rtl-style';
        document.head.appendChild(style);
      }
      // Target ONLY the actual text content of messages.
      // - [data-testid="user-message"] > div (the text bubble)
      // - .prose, .markdown (assistant response text)
      // - [data-testid="assistant-message"] .prose
      style.textContent = `
        /* User question text only */
        [data-testid="user-message"] > div,
        [data-testid="user-message"] > div * {
          direction: ${dir} !important;
          text-align: ${dir === 'rtl' ? 'right' : 'left'} !important;
        }
        /* Assistant answer text only (prose/markdown content) */
        [data-testid="assistant-message"] .prose,
        [data-testid="assistant-message"] .prose *,
        [data-testid="assistant-message"] .markdown,
        [data-testid="assistant-message"] .markdown *,
        [data-testid="assistant-message"] [class*="prose"],
        [data-testid="assistant-message"] [class*="prose"] * {
          direction: ${dir} !important;
          text-align: ${dir === 'rtl' ? 'right' : 'left'} !important;
        }
        /* Chat input textarea (where you type) */
        textarea[name="user-prompt"],
        textarea[data-testid*="chat-input"] {
          direction: ${dir} !important;
          text-align: ${dir === 'rtl' ? 'right' : 'left'} !important;
        }
        /* Code blocks always LTR — never flip */
        pre, code, pre *, code *, [class*="code-block"], [class*="CodeBlock"], [data-testid*="code"], .prose pre, .prose code, .markdown pre, .markdown code {
          direction: ltr !important;
          text-align: left !important;
        }
      `;

      console.log('[Ask Duck.ai] Applied text direction (Q&A only):', dir);
    } catch (e) {
      // Settings not ready yet — retry later.
    }
  }

  function removeDirectionStyle() {
    const style = document.getElementById('duckai-rtl-style');
    if (style) style.remove();
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
    b.innerHTML = '<strong>Ask Duck.ai:</strong> Solve the verification challenge — your prompt will be sent automatically.';
    document.body.appendChild(b);
  }

  function removeBanner() {
    const b = document.getElementById('duckai-banner');
    if (b) b.remove();
  }
})();
