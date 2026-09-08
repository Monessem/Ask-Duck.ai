/**
 * Settings import/export service
 * ------------------------------------------------------------------
 * Exports all extension data (settings, custom prompts, user prompts)
 * to a JSON file, and imports from a JSON file.
 */

import { getSettings, setSettings } from './settings.js';
import { getCustomPrompts, setCustomPrompt, resetAllCustomPrompts } from './custom-prompts.js';
import { getUserPrompts, addUserPrompt, deleteUserPrompt } from './user-prompts.js';
import { get, set } from './storage.js';
import { sanitizeImportPayload } from './validation.js';

const HISTORY_KEY = 'history';
const RECENT_KEY = 'recentActions';

/**
 * Export all extension data to a JSON object.
 * @returns {Promise<object>}
 */
export async function exportAllData() {
  const settings = await getSettings();
  const customPrompts = await getCustomPrompts();
  const userPrompts = await getUserPrompts();
  const recentActions = await get(RECENT_KEY, []);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    extensionVersion: browser.runtime.getManifest().version,
    settings,
    customPrompts,
    userPrompts,
    recentActions
  };
}

/**
 * Export all data and trigger a download.
 */
export async function exportToFile() {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
  const filename = `duckai-assistant-backup-${timestamp}.json`;

  // Use the downloads API if available, otherwise fallback to anchor download.
  try {
    await browser.downloads.download({
      url,
      filename,
      saveAs: true
    });
  } catch {
    // Fallback: create an anchor and click it.
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Revoke after a delay.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Import data from a JSON object.
 * @param {object} data
 * @param {boolean} merge If true, merge with existing; if false, replace.
 */
export async function importAllData(data, merge = false) {
  // A backup file is untrusted input: normalize it before writing.
  const payload = sanitizeImportPayload(data);

  if (Object.keys(payload.settings).length) {
    await setSettings(payload.settings);
  }

  if (Object.keys(payload.customPrompts).length || (!merge && isPlainObject(data.customPrompts))) {
    if (!merge) {
      await resetAllCustomPrompts();
    }
    for (const [actionId, instruction] of Object.entries(payload.customPrompts)) {
      await setCustomPrompt(actionId, instruction);
    }
  }

  if (Array.isArray(data.userPrompts)) {
    if (!merge) {
      const existing = await getUserPrompts();
      for (const p of existing) {
        await deleteUserPrompt(p.id);
      }
    }
    for (const p of payload.userPrompts) {
      await addUserPrompt(p.label, p.instruction);
    }
  }

  if (payload.recentActions.length) {
    await set(RECENT_KEY, payload.recentActions);
  }

  return { ok: true };
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Import data from a JSON file.
 * @param {File} file
 * @param {boolean} merge
 */
export async function importFromFile(file, merge = false) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid data format');
  }
  return await importAllData(data, merge);
}
