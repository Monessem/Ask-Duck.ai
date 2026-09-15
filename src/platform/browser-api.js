/**
 * Cross-browser API compatibility layer
 * ------------------------------------------------------------------
 * Provides a unified `browserAPI` object that works on both
 * Firefox (browser.*) and Chromium (chrome.*).
 */

const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

if (!api) {
  throw new Error('No WebExtension API found');
}

export const browserAPI = api;

export function isChromium() {
  return typeof browser === 'undefined' && typeof chrome !== 'undefined';
}

export function isFirefox() {
  return typeof browser !== 'undefined';
}
