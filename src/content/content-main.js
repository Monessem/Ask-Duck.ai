/**
 * Content script main module
 * ------------------------------------------------------------------
 * Owns action menu + message bridge.
 * The floating button is handled directly in content-script.js
 * (self-contained, no module loading required).
 */

import { ensureMenu, openMenu } from './action-menu.js';
import { MSG } from '../background/messaging.js';
import { getSettings } from '../services/settings.js';
import { isUnsupportedPage } from '../utils/helpers.js';

export function init() {
  // SPA navigation watcher.
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }
  });
  urlObserver.observe(document.documentElement, { childList: true, subtree: true });
}

/**
 * Open the action menu with the given options.
 * Called from content-script.js when the floating button is clicked.
 */
export function openActionMenu(opts) {
  if (isUnsupportedPage()) return;
  ensureMenu();
  // openMenu is async — call it without blocking.
  openMenu({
    selection: opts.selection || '',
    suggestedCategory: opts.suggestedCategory,
    coords: opts.coords
  }).catch(function (err) {
    console.warn('[Ask Duck.ai] openMenu failed', err);
  });
}
