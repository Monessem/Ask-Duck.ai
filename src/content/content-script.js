/**
 * Content script bootstrap (classic script)
 * ------------------------------------------------------------------
 * Self-contained: floating button + message bridge.
 * No external module imports until the button is clicked.
 * AMO compliant: no innerHTML with dynamic values, no eval.
 */

(function () {
  'use strict';

  if (window.__askDuckAiInjected) return;
  window.__askDuckAiInjected = true;

  console.log('[Ask Duck.ai] Content script loaded on', location.href);

  // ---- Message bridge ----
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === 'get-selection') {
      sendResponse({ selection: getCurrentSelection() });
      return false;
    }
    if (message.type === 'get-page-content') {
      sendResponse({
        title: document.title || '',
        url: location.href,
        text: document.body ? (document.body.innerText || '').slice(0, 6000) : ''
      });
      return false;
    }
    if (message.type === 'get-page-meta') {
      const meta = document.querySelector('meta[name="description"]');
      const ogDesc = document.querySelector('meta[property="og:description"]');
      sendResponse({
        title: document.title || '',
        url: location.href,
        description: (meta && meta.content) || (ogDesc && ogDesc.content) || ''
      });
      return false;
    }
    if (message.type === 'prompt-input') {
      const p = message.payload || {};
      sendResponse({ value: window.prompt(p.prompt || 'Enter value:', p.default || '') });
      return false;
    }
    return false;
  });

  // ---- Floating button (self-contained) ----
  var floatingHost = null;
  var floatingBtn = null;

  function initFloatingButton() {
    if (floatingHost) return;
    if (!document.documentElement) return;

    var url = location.href;
    if (!url || !url.startsWith('http')) return;

    floatingHost = document.createElement('div');
    floatingHost.id = 'ask-duckai-floating';
    floatingHost.style.cssText =
      'all:initial;position:absolute;z-index:2147483646;top:0;left:0;display:none;pointer-events:none;';

    var shadow = floatingHost.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent =
      ':host{all:initial;direction:ltr}' +
      'button{all:initial;display:inline-flex;align-items:center;gap:6px;' +
      'padding:6px 10px;background:#1f2937;color:#fff;border-radius:999px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'font-size:13px;line-height:1;cursor:pointer;' +
      'box-shadow:0 4px 14px rgba(0,0,0,0.18),0 1px 2px rgba(0,0,0,0.08);' +
      'transition:transform 80ms ease,background 120ms ease;' +
      'pointer-events:auto;user-select:none}' +
      'button:hover{background:#111827;transform:translateY(-1px)}' +
      'button:active{transform:translateY(0)}' +
      'button img.logo{width:16px;height:16px;border-radius:50%;object-fit:contain}' +
      'button span.label{font-weight:500}' +
      '@media(prefers-reduced-motion:reduce){button{transition:none}button:hover{transform:none}}';
    shadow.appendChild(style);

    floatingBtn = document.createElement('button');
    floatingBtn.type = 'button';
    floatingBtn.setAttribute('aria-label', 'Ask Duck.ai');

    var logoImg = document.createElement('img');
    logoImg.className = 'logo';
    logoImg.setAttribute('alt', '');
    logoImg.setAttribute('aria-hidden', 'true');
    logoImg.src = browser.runtime.getURL('icons/icon-48.png');

    var labelSpan = document.createElement('span');
    labelSpan.className = 'label';
    labelSpan.textContent = 'Ask Duck.ai';

    floatingBtn.appendChild(logoImg);
    floatingBtn.appendChild(labelSpan);

    floatingBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var sel = getCurrentSelection();
      if (sel) {
        loadContentMain().then(function (mod) {
          if (mod && mod.openActionMenu) {
            mod.openActionMenu({ selection: sel, coords: getSelectionCoords() });
          } else {
            // Fallback: send directly to background.
            browser.runtime.sendMessage({
              type: 'run-action',
              payload: { actionId: 'common.tldr', selection: sel }
            });
          }
        });
      }
      hideFloating();
    });

    floatingBtn.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });

    shadow.appendChild(floatingBtn);
    document.documentElement.appendChild(floatingHost);
    console.log('[Ask Duck.ai] Floating button initialized');
  }

  function showFloating(x, y) {
    if (!floatingHost) return;
    floatingHost.style.display = 'block';
    var rect = floatingHost.getBoundingClientRect();
    var w = rect.width || 120;
    var h = rect.height || 32;
    var left = x - w / 2;
    var top = y - h - 8;
    if (left < 8) left = 8;
    if (left > window.innerWidth - w - 8) left = window.innerWidth - w - 8;
    if (top < 8) top = 8;
    floatingHost.style.transform = 'translate(' + left + 'px, ' + top + 'px)';
  }

  function hideFloating() {
    if (!floatingHost) return;
    floatingHost.style.display = 'none';
  }

  function getCurrentSelection() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) return '';
    return sel.toString().trim();
  }

  function getSelectionCoords() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    var range = sel.getRangeAt(0).cloneRange();
    range.collapse(false);
    var rect = range.getBoundingClientRect();
    if (!rect || (rect.left === 0 && rect.top === 0)) {
      rect = sel.getRangeAt(0).getBoundingClientRect();
    }
    if (!rect) return null;
    return {
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY
    };
  }

  // ---- Selection watcher ----
  var selTimer = null;
  document.addEventListener('selectionchange', function () {
    if (selTimer) clearTimeout(selTimer);
    selTimer = setTimeout(handleSelectionChange, 200);
  });

  function handleSelectionChange() {
    // Check settings — default to enabled if can't read.
    var settingsKey = 'duckai.settings';
    browser.storage.local.get(settingsKey).then(function (result) {
      var settings = result[settingsKey];
      // Default: floatingButton is true (enabled).
      if (settings && settings.floatingButton === false) {
        hideFloating();
        return;
      }
      checkAndShow();
    }).catch(function () {
      // Can't read settings — default to showing.
      checkAndShow();
    });
  }

  function checkAndShow() {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      hideFloating();
      return;
    }
    var text = sel.toString().trim();
    if (!text || text.length < 2) {
      hideFloating();
      return;
    }
    var coords = getSelectionCoords();
    if (!coords) return;
    // Delay slightly so user can finish selecting.
    setTimeout(function () {
      var stillSel = window.getSelection();
      if (!stillSel || stillSel.isCollapsed) return;
      showFloating(coords.x, coords.y);
    }, 250);
  }

  window.addEventListener('scroll', hideFloating, { passive: true });
  window.addEventListener('resize', hideFloating);

  // ---- Init floating button ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingButton);
  } else {
    initFloatingButton();
  }

  // ---- Lazy-load content-main ----
  var contentMainPromise = null;
  function loadContentMain() {
    if (contentMainPromise) return contentMainPromise;
    contentMainPromise = import(browser.runtime.getURL('src/content/content-main.js'))
      .then(function (mod) {
        if (mod && typeof mod.init === 'function') {
          try { mod.init(); } catch (e) {}
        }
        return mod;
      })
      .catch(function (err) {
        console.warn('[Ask Duck.ai] content-main load failed', err);
        return null;
      });
    return contentMainPromise;
  }
})();
