/**
 * Internationalization helpers
 * ------------------------------------------------------------------
 * Wraps browser.i18n with graceful fallbacks. All user-visible
 * strings in the extension should go through `t()` and be defined
 * in `_locales/<locale>/messages.json`.
 */

/**
 * Get a localized message.
 * @param {string} key - Message key (without __MSG__ wrapper)
 * @param {(string|number)[]} [substitutions]
 * @returns {string}
 */
export function t(key, substitutions) {
  try {
    const msg = browser.i18n.getMessage(key, substitutions);
    if (msg) return msg;
  } catch {
    /* fall through */
  }
  return key;
}

/**
 * Get the UI language code (e.g. 'en' or 'ar').
 * @returns {string}
 */
export function getUILanguage() {
  try {
    return browser.i18n.getUILanguage().split('-')[0];
  } catch {
    return 'en';
  }
}

/**
 * Whether the current UI language is RTL.
 * @returns {boolean}
 */
export function isRTL() {
  const lang = getUILanguage();
  return ['ar', 'he', 'fa', 'ur'].includes(lang);
}

/**
 * Apply the correct `dir` attribute to the document element based on
 * the current UI language.
 */
export function applyDocumentDirection() {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('dir', isRTL() ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', getUILanguage());
}
