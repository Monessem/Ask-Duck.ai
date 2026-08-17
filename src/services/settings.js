/**
 * Settings service — typed access to user preferences with sensible
 * defaults. All settings are stored via the storage service.
 */

import { get, set, onChange } from './storage.js';

/** @typedef {'system'|'light'|'dark'} ThemePref */

/**
 * @typedef {Object} Settings
 * @property {boolean} floatingButton       - Show floating selection button
 * @property {boolean} contextMenu          - Enable context menu
 * @property {string}  defaultActionId      - Default action when invoking without selection
 * @property {string}  defaultLanguage      - Default translate language code
 * @property {ThemePref} theme              - UI theme preference
 * @property {'sidebar'|'tab'} displayMode  - Where to show Duck.ai response
 * @property {boolean} autoSubmit           - Auto-submit prompt in Duck.ai
 * @property {string}  responseLanguage     - Language for Duck.ai responses ('auto' or language code)
 * @property {'auto'|'ltr'|'rtl'} textDirection - Text direction for Duck.ai responses
 * @property {boolean} historyEnabled       - Persist conversation history locally
 * @property {number}  historyMaxItems      - Max stored conversations
 * @property {boolean} openInDuckAiOnFail   - Reserved; always true now
 * @property {boolean} sendUsageTelemetry   - Reserved; always false
 */

/** @type {Settings} */
export const DEFAULT_SETTINGS = {
  floatingButton: true,
  contextMenu: true,
  defaultActionId: 'common.eli5',
  defaultLanguage: 'en',
  theme: 'system',
  displayMode: 'sidebar',
  autoSubmit: false,
  responseLanguage: 'auto',
  textDirection: 'auto',
  smartDetection: true,
  historyEnabled: false,
  historyMaxItems: 50,
  openInDuckAiOnFail: true,
  sendUsageTelemetry: false
};

const KEY = 'settings';

/** @type {Settings|null} */
let cache = null;

/**
 * Load settings from storage (with defaults applied for any
 * missing fields). Returns a deep copy so callers can't mutate
 * the cache.
 *
 * @returns {Promise<Settings>}
 */
export async function getSettings() {
  const stored = await get(KEY, {});
  // Merge with defaults — ensures new settings (like smartDetection)
  // get their default value even if stored settings are from an older version.
  cache = { ...DEFAULT_SETTINGS, ...stored };
  // Explicitly check smartDetection — if it's undefined, use the default.
  if (cache.smartDetection === undefined) {
    cache.smartDetection = DEFAULT_SETTINGS.smartDetection;
  }
  return { ...cache };
}

/**
 * Persist settings. Merges with existing values.
 * @param {Partial<Settings>} patch
 * @returns {Promise<Settings>}
 */
export async function setSettings(patch) {
  const current = cache || (await getSettings());
  const next = { ...current, ...patch };
  await set(KEY, next);
  cache = next;
  return { ...next };
}

/**
 * Reset settings to defaults.
 * @returns {Promise<Settings>}
 */
export async function resetSettings() {
  await set(KEY, { ...DEFAULT_SETTINGS });
  cache = { ...DEFAULT_SETTINGS };
  return { ...cache };
}

/**
 * Subscribe to settings changes.
 * @param {(settings: Settings) => void} cb
 * @returns {() => void}
 */
export function onSettingsChanged(cb) {
  return onChange(KEY, async () => {
    const s = await getSettings();
    cb(s);
  });
}

/**
 * Synchronously return the most recently loaded settings, or
 * defaults if none have been loaded yet.
 *
 * @returns {Settings}
 */
export function getCachedSettings() {
  return cache ? { ...cache } : { ...DEFAULT_SETTINGS };
}
