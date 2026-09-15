/**
 * Tab script helper (v1.1 — Firefox-safe)
 * ------------------------------------------------------------------
 * Cross-browser abstraction for getting data from the active tab.
 *
 * On Firefox: content-script.js is auto-injected on every page, so
 * we can use `browser.tabs.sendMessage()` to talk to it directly.
 *
 * On Chromium: content-script.js is NOT auto-injected (to avoid the
 * "broad host permissions" warning on the Chrome Web Store). Instead,
 * we use the `chrome.scripting.executeScript()` API with `activeTab`
 * permission, which is granted when the user invokes the extension.
 *
 * Every function below tries the content-script path first (fast,
 * works on Firefox), and falls back to programmatic injection
 * (works on Chromium with activeTab). Both paths return the same
 * shape of data.
 *
 * FIREFOX SAFETY: Uses dynamic property access (`api()['scripting']`)
 * instead of `browser.scripting` to avoid Firefox static analysis
 * warnings about unimplemented APIs.
 */

/** @typedef {{title: string, url: string, text: string}} PageContent */
/** @typedef {{title: string, url: string, description: string}} PageMeta */

function api() {
  return typeof browser !== 'undefined' ? browser : chrome;
}

/**
 * Get the scripting API object if available.
 * Uses dynamic property access to avoid Firefox warnings.
 */
function getScripting() {
  try {
    const a = api();
    const key = 'scripting';
    const s = a[key];
    if (s && typeof s.executeScript === 'function') return s;
  } catch { /* ignore */ }
  return null;
}

/**
 * Get the currently selected text in a tab.
 * @param {number} tabId
 * @returns {Promise<string>}
 */
export async function getSelectionFromTab(tabId) {
  // Path 1: ask the content script (Firefox).
  try {
    const resp = await browser.tabs.sendMessage(tabId, { type: 'get-selection' });
    if (resp && resp.selection) return resp.selection;
  } catch { /* content script not loaded — try scripting API */ }

  // Path 2: programmatic injection (Chromium with activeTab).
  const scripting = getScripting();
  if (scripting) {
    try {
      const results = await scripting.executeScript({
        target: { tabId },
        func: () => {
          const sel = window.getSelection();
          return sel ? sel.toString().trim() : '';
        }
      });
      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
    } catch (e) {
      console.warn('[Ask Duck.ai] getSelectionFromTab scripting failed', e);
    }
  }
  return '';
}

/**
 * Get the page content (title, URL, body text) for "send page" actions.
 * @param {number} tabId
 * @returns {Promise<PageContent>}
 */
export async function getPageContentFromTab(tabId) {
  // Path 1: content script.
  try {
    const resp = await browser.tabs.sendMessage(tabId, { type: 'get-page-content' });
    if (resp && resp.title) return resp;
  } catch { /* fall through */ }

  // Path 2: scripting API.
  const scripting = getScripting();
  if (scripting) {
    try {
      const results = await scripting.executeScript({
        target: { tabId },
        func: () => ({
          title: document.title || '',
          url: location.href,
          text: document.body ? (document.body.innerText || '').slice(0, 6000) : ''
        })
      });
      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
    } catch (e) {
      console.warn('[Ask Duck.ai] getPageContentFromTab scripting failed', e);
    }
  }
  return { title: '', url: '', text: '' };
}

/**
 * Get page metadata (title, URL, description) for page-level actions.
 * @param {number} tabId
 * @returns {Promise<PageMeta>}
 */
export async function getPageMetaFromTab(tabId) {
  // Path 1: content script.
  try {
    const resp = await browser.tabs.sendMessage(tabId, { type: 'get-page-meta' });
    if (resp && resp.title) return resp;
  } catch { /* fall through */ }

  // Path 2: scripting API.
  const scripting = getScripting();
  if (scripting) {
    try {
      const results = await scripting.executeScript({
        target: { tabId },
        func: () => {
          const meta = document.querySelector('meta[name="description"]');
          const ogDesc = document.querySelector('meta[property="og:description"]');
          return {
            title: document.title || '',
            url: location.href,
            description: (meta && meta.content) || (ogDesc && ogDesc.content) || ''
          };
        }
      });
      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
    } catch (e) {
      console.warn('[Ask Duck.ai] getPageMetaFromTab scripting failed', e);
    }
  }
  return { title: '', url: '', description: '' };
}

/**
 * Show a browser-style prompt() dialog inside the tab's page.
 * @param {number} tabId
 * @param {string} promptText
 * @param {string} [defaultValue]
 * @returns {Promise<string|null>}
 */
export async function promptInputInTab(tabId, promptText, defaultValue = '') {
  // Path 1: content script.
  try {
    const resp = await browser.tabs.sendMessage(tabId, {
      type: 'prompt-input',
      payload: { prompt: promptText, default: defaultValue }
    });
    if (resp && resp.value !== undefined) return resp.value;
  } catch { /* fall through */ }

  // Path 2: scripting API.
  const scripting = getScripting();
  if (scripting) {
    try {
      const results = await scripting.executeScript({
        target: { tabId },
        func: (p, d) => window.prompt(p, d),
        args: [promptText, defaultValue]
      });
      if (results && results[0]) {
        return results[0].result;
      }
    } catch (e) {
      console.warn('[Ask Duck.ai] promptInputInTab scripting failed', e);
    }
  }
  return null;
}
