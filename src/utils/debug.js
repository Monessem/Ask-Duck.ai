/**
 * Debug logging. Off by default so the extension stays silent in the
 * console of every page it runs on; flip DEBUG to true when developing.
 */

const DEBUG = false;

export function debugLog(...args) {
  if (DEBUG) console.log(...args);
}
