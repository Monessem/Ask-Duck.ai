/**
 * Cross-browser API alias.
 * ------------------------------------------------------------------
 * Firefox exposes `browser`, Chromium exposes `chrome`. The rest of
 * the codebase uses `browser` exclusively, so alias it when missing.
 *
 * Must be loaded before any other extension code (first entry in the
 * content_scripts arrays, first import in the background entry point).
 */

// Valid both as a classic content script and as an ES module import.
if (typeof globalThis.browser === 'undefined' && typeof globalThis.chrome !== 'undefined') {
  globalThis.browser = globalThis.chrome;
}
