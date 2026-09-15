/**
 * Prompt Builder (v3.0)
 * ------------------------------------------------------------------
 * Minimal prompt: one-line instruction + the text.
 * Supports page-level actions (no selection — uses page title/meta).
 */

import { getAction } from './actions.js';
import { getCustomPrompt } from '../services/custom-prompts.js';
import { getUserPrompt } from '../services/user-prompts.js';
import { getSettings } from '../services/settings.js';

export const MAX_SELECTION_LENGTH = 8000;

export function sanitizeSelection(raw) {
  if (!raw) return '';
  let text = String(raw).normalize('NFC');
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  text = text.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
  text = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > MAX_SELECTION_LENGTH) {
    text = text.slice(0, MAX_SELECTION_LENGTH) + '\n[...truncated]';
  }
  return text;
}

const LANGUAGE_NAMES = {
  auto: 'Auto-detect',
  ar: 'Arabic',
  en: 'English',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  tr: 'Turkish',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian'
};

// Languages that use RTL script.
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Build a minimal prompt: one-line instruction + the text.
 * Supports built-in actions and user custom prompts (id starts with 'user-').
 */
export async function buildPrompt({ actionId, selection, input }) {
  const safeSelection = sanitizeSelection(selection);
  if (!safeSelection) throw new Error('No usable text in selection');

  let instruction;
  let action;

  // Check if it's a user custom prompt.
  if (actionId && actionId.startsWith('user-')) {
    const userPrompt = await getUserPrompt(actionId);
    if (!userPrompt) throw new Error(`Unknown user prompt: ${actionId}`);
    instruction = userPrompt.instruction;
  } else {
    action = getAction(actionId);
    if (!action) throw new Error(`Unknown action: ${actionId}`);
    instruction = await getCustomPrompt(actionId);
    if (!instruction) instruction = action.instruction;
    if (action.needsInput) {
      const inputVal = (input || '').trim() || action.inputDefault || '';
      instruction = instruction.replace(/\{\{input\}\}/g, inputVal);
    }
  }

  const settings = await getSettings();
  const langSuffix = buildLanguageSuffix(settings.responseLanguage);
  const dirSuffix = buildDirectionSuffix(settings.textDirection, settings.responseLanguage);

  return `${instruction}\n\n${safeSelection}${langSuffix}${dirSuffix}`;
}

/**
 * Build a page-level prompt (no selection — uses page title + meta).
 */
export async function buildPagePrompt({ actionId, pageTitle, pageUrl, pageDescription }) {
  let instruction;
  let action;

  if (actionId && actionId.startsWith('user-')) {
    const userPrompt = await getUserPrompt(actionId);
    if (!userPrompt) throw new Error(`Unknown user prompt: ${actionId}`);
    instruction = userPrompt.instruction;
  } else {
    action = getAction(actionId);
    if (!action) throw new Error(`Unknown action: ${actionId}`);
    instruction = await getCustomPrompt(actionId);
    if (!instruction) instruction = action.instruction;
  }

  const lines = [instruction, ''];
  if (pageTitle) lines.push(`Page title: ${pageTitle}`);
  if (pageUrl) lines.push(`Page URL: ${pageUrl}`);
  if (pageDescription) lines.push(`Page description: ${pageDescription}`);
  if (!pageTitle && !pageDescription) {
    lines.push('(No page metadata available.)');
  }

  const settings = await getSettings();
  const langSuffix = buildLanguageSuffix(settings.responseLanguage);
  const dirSuffix = buildDirectionSuffix(settings.textDirection, settings.responseLanguage);

  return lines.join('\n') + langSuffix + dirSuffix;
}

function buildLanguageSuffix(responseLanguage) {
  if (!responseLanguage || responseLanguage === 'auto') return '';
  const langName = LANGUAGE_NAMES[responseLanguage] || responseLanguage;
  return `\n\nRespond in ${langName}.`;
}

/**
 * Build a text direction directive suffix.
 * - 'auto': derive from responseLanguage (RTL for Arabic/Persian/Hebrew/Urdu)
 * - 'ltr': force LTR
 * - 'rtl': force RTL
 * Keeps code blocks unchanged (instructs the model to do so).
 */
function buildDirectionSuffix(textDirection, responseLanguage) {
  let dir = null;
  if (textDirection === 'ltr') dir = 'LTR';
  else if (textDirection === 'rtl') dir = 'RTL';
  else if (textDirection === 'auto' || !textDirection) {
    // Auto: derive from response language.
    if (responseLanguage && RTL_LANGUAGES.has(responseLanguage)) dir = 'RTL';
    // For 'auto' response language, don't force direction.
  }
  if (!dir) return '';
  return `\n\nWrite your response in ${dir} text direction. Keep any code blocks in LTR.`;
}


