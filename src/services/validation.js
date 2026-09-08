/**
 * Pure validation helpers for anything that reaches storage.
 * ------------------------------------------------------------------
 * Imported data (backup files) and settings patches are untrusted:
 * they can carry unknown keys, wrong types, or unbounded strings that
 * would corrupt the UI or fill up storage. Everything here is pure so
 * it can be unit tested without a browser.
 */

export const LIMITS = {
  LABEL: 100,
  INSTRUCTION: 4000,
  ACTION_ID: 64,
  USER_PROMPTS: 200,
  CUSTOM_PROMPTS: 500,
  RECENT_ACTIONS: 50,
  HISTORY_MAX_ITEMS: 500
};

const THEMES = ['system', 'light', 'dark'];
const DISPLAY_MODES = ['sidebar', 'tab'];
const DIRECTIONS = ['auto', 'ltr', 'rtl'];

/** @type {Object<string, {type: string, values?: string[], min?: number, max?: number, maxLength?: number}>} */
export const SETTINGS_SCHEMA = {
  floatingButton: { type: 'boolean' },
  contextMenu: { type: 'boolean' },
  defaultActionId: { type: 'string', maxLength: LIMITS.ACTION_ID },
  defaultLanguage: { type: 'string', maxLength: 16 },
  theme: { type: 'enum', values: THEMES },
  displayMode: { type: 'enum', values: DISPLAY_MODES },
  autoSubmit: { type: 'boolean' },
  responseLanguage: { type: 'string', maxLength: 16 },
  textDirection: { type: 'enum', values: DIRECTIONS },
  smartDetection: { type: 'boolean' },
  historyEnabled: { type: 'boolean' },
  historyMaxItems: { type: 'integer', min: 5, max: LIMITS.HISTORY_MAX_ITEMS },
  openInDuckAiOnFail: { type: 'boolean' },
  sendUsageTelemetry: { type: 'boolean' }
};

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

/**
 * Keep only known settings keys holding a valid value.
 *
 * @param {unknown} patch
 * @returns {Object}
 */
export function sanitizeSettingsPatch(patch) {
  if (!isPlainObject(patch)) return {};
  const out = {};
  for (const [key, rule] of Object.entries(SETTINGS_SCHEMA)) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (rule.type === 'boolean') {
      if (typeof value === 'boolean') out[key] = value;
    } else if (rule.type === 'enum') {
      if (rule.values.includes(value)) out[key] = value;
    } else if (rule.type === 'string') {
      if (typeof value === 'string') out[key] = value.trim().slice(0, rule.maxLength);
    } else if (rule.type === 'integer') {
      const n = Number.parseInt(value, 10);
      if (Number.isFinite(n)) out[key] = Math.min(rule.max, Math.max(rule.min, n));
    }
  }
  return out;
}

/**
 * Normalize a backup file into exactly what the importer may write.
 * Unknown keys are dropped, strings are trimmed and capped, and lists
 * are truncated.
 *
 * @param {unknown} data
 * @returns {{settings: Object, customPrompts: Object<string, string>, userPrompts: Array<{label: string, instruction: string}>, recentActions: string[]}}
 */
export function sanitizeImportPayload(data) {
  if (!isPlainObject(data)) throw new Error('Invalid data format');

  const settings = sanitizeSettingsPatch(data.settings);

  /** @type {Object<string, string>} */
  const customPrompts = {};
  if (isPlainObject(data.customPrompts)) {
    for (const [actionId, instruction] of Object.entries(data.customPrompts).slice(0, LIMITS.CUSTOM_PROMPTS)) {
      const id = text(actionId, LIMITS.ACTION_ID);
      const value = text(instruction, LIMITS.INSTRUCTION);
      if (id && value) customPrompts[id] = value;
    }
  }

  const userPrompts = [];
  if (Array.isArray(data.userPrompts)) {
    for (const entry of data.userPrompts.slice(0, LIMITS.USER_PROMPTS)) {
      if (!isPlainObject(entry)) continue;
      const label = text(entry.label, LIMITS.LABEL);
      const instruction = text(entry.instruction, LIMITS.INSTRUCTION);
      if (label && instruction) userPrompts.push({ label, instruction });
    }
  }

  const recentActions = Array.isArray(data.recentActions)
    ? data.recentActions
      .map((id) => text(id, LIMITS.ACTION_ID))
      .filter(Boolean)
      .slice(0, LIMITS.RECENT_ACTIONS)
    : [];

  return { settings, customPrompts, userPrompts, recentActions };
}

function text(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
