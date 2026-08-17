/**
 * Custom prompts service
 * ------------------------------------------------------------------
 * Stores user-customized instructions for each action. The prompt
 * builder checks here first before falling back to the default
 * instruction defined in actions.js.
 */

import { get, set, onChange } from './storage.js';

const KEY = 'customPrompts';

/**
 * Get all custom prompts.
 * @returns {Promise<Object<string, string>>} Map of actionId -> custom instruction
 */
export async function getCustomPrompts() {
  const result = await get(KEY, {});
  return result && typeof result === 'object' ? result : {};
}

/**
 * Get the custom instruction for a specific action, if any.
 * @param {string} actionId
 * @returns {Promise<string|null>}
 */
export async function getCustomPrompt(actionId) {
  const all = await getCustomPrompts();
  const val = all[actionId];
  return typeof val === 'string' && val.trim() ? val.trim() : null;
}

/**
 * Set a custom instruction for an action.
 * @param {string} actionId
 * @param {string} instruction
 */
export async function setCustomPrompt(actionId, instruction) {
  const all = await getCustomPrompts();
  if (instruction && instruction.trim()) {
    all[actionId] = instruction.trim();
  } else {
    delete all[actionId];
  }
  await set(KEY, all);
}

/**
 * Reset a custom instruction to the default.
 * @param {string} actionId
 */
export async function resetCustomPrompt(actionId) {
  const all = await getCustomPrompts();
  delete all[actionId];
  await set(KEY, all);
}

/**
 * Reset all custom instructions.
 */
export async function resetAllCustomPrompts() {
  await set(KEY, {});
}

/**
 * Subscribe to changes.
 * @param {(customPrompts: Object<string, string>) => void} cb
 * @returns {() => void}
 */
export function onCustomPromptsChanged(cb) {
  return onChange(KEY, async () => {
    const all = await getCustomPrompts();
    cb(all);
  });
}
