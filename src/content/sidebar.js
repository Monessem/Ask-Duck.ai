/**
 * Sidebar mode — sends a message to the background script to open
 * Duck.ai in a popup window.
 *
 * Content scripts CANNOT use browser.windows API, so we delegate to
 * the background script which can.
 *
 * The prompt is stored in session storage by the background script
 * BEFORE the popup window opens, ensuring the injector picks it up.
 */

import { MSG } from '../background/messaging.js';

/**
 * Ask the background to open Duck.ai in a popup window.
 *
 * @param {Object} opts
 * @param {string} [opts.prompt]
 * @param {boolean} [opts.autoSubmit]
 */
export async function openSidebar(opts = {}) {
  try {
    await browser.runtime.sendMessage({
      type: MSG.OPEN_POPUP_WINDOW,
      payload: {
        prompt: opts.prompt || '',
        autoSubmit: opts.autoSubmit !== false
      }
    });
  } catch (err) {
    console.warn('Duck.ai: failed to open popup window via background, falling back to tab', err);
    // Last-resort fallback: open in a new tab directly.
    window.open('https://duck.ai/', '_blank');
  }
}
