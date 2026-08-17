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
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data format');
  }

  // Import settings.
  if (data.settings && typeof data.settings === 'object') {
    if (merge) {
      await setSettings(data.settings);
    } else {
      await setSettings(data.settings);
    }
  }

  // Import custom prompts (per-action instruction overrides).
  if (data.customPrompts && typeof data.customPrompts === 'object') {
    if (!merge) {
      await resetAllCustomPrompts();
    }
    for (const [actionId, instruction] of Object.entries(data.customPrompts)) {
      await setCustomPrompt(actionId, instruction);
    }
  }

  // Import user prompts (custom user-created prompts).
  if (Array.isArray(data.userPrompts)) {
    if (!merge) {
      // Delete all existing user prompts.
      const existing = await getUserPrompts();
      for (const p of existing) {
        await deleteUserPrompt(p.id);
      }
    }
    // Add imported user prompts.
    for (const p of data.userPrompts) {
      if (p.label && p.instruction) {
        await addUserPrompt(p.label, p.instruction);
      }
    }
  }

  // Import recent actions (optional).
  if (Array.isArray(data.recentActions)) {
    await set(RECENT_KEY, data.recentActions);
  }

  return { ok: true };
}

/**
 * Import data from a JSON file.
 * @param {File} file
 * @param {boolean} merge
 */
export async function importFromFile(file, merge = false) {
  const text = await file.text();
  const data = JSON.parse(text);
  return await importAllData(data, merge);
}
