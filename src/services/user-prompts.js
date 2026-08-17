/**
 * User custom prompts service
 * ------------------------------------------------------------------
 * Stores user-created custom prompts (separate from the built-in
 * action customization). These appear as a special category "My
 * Prompts" in the action menu and context menu.
 */

import { get, set, onChange } from './storage.js';

const KEY = 'userPrompts';

/**
 * @typedef {Object} UserPrompt
 * @property {string} id
 * @property {string} label     - User-visible name
 * @property {string} instruction - The instruction text
 * @property {number} createdAt
 */

/**
 * Get all user prompts.
 * @returns {Promise<UserPrompt[]>}
 */
export async function getUserPrompts() {
  const result = await get(KEY, []);
  return Array.isArray(result) ? result : [];
}

/**
 * Add a new user prompt.
 * @param {string} label
 * @param {string} instruction
 * @returns {Promise<UserPrompt>}
 */
export async function addUserPrompt(label, instruction) {
  const list = await getUserPrompts();
  const item = {
    id: 'user-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    label: (label || '').trim() || 'Untitled',
    instruction: (instruction || '').trim(),
    createdAt: Date.now()
  };
  list.push(item);
  await set(KEY, list);
  return item;
}

/**
 * Update an existing user prompt.
 * @param {string} id
 * @param {string} label
 * @param {string} instruction
 */
export async function updateUserPrompt(id, label, instruction) {
  const list = await getUserPrompts();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], label: (label || '').trim(), instruction: (instruction || '').trim() };
  await set(KEY, list);
}

/**
 * Delete a user prompt.
 * @param {string} id
 */
export async function deleteUserPrompt(id) {
  const list = await getUserPrompts();
  const next = list.filter((p) => p.id !== id);
  await set(KEY, next);
}

/**
 * Get a user prompt by ID.
 * @param {string} id
 * @returns {Promise<UserPrompt|null>}
 */
export async function getUserPrompt(id) {
  const list = await getUserPrompts();
  return list.find((p) => p.id === id) || null;
}

/**
 * Subscribe to changes.
 * @param {(prompts: UserPrompt[]) => void} cb
 */
export function onUserPromptsChanged(cb) {
  return onChange(KEY, async () => {
    cb(await getUserPrompts());
  });
}
