/**
 * Global browser API polyfill for Chromium compatibility.
 * If `browser` is not defined but `chrome` is, alias it.
 */
if (typeof globalThis.browser === 'undefined' && typeof globalThis.chrome !== 'undefined') {
  globalThis.browser = globalThis.chrome;
}
