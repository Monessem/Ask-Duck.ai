/**
 * Recent actions service
 * ------------------------------------------------------------------
 * Tracks the last N actions used, for the Quick Actions toolbar.
 */

import { get, set } from './storage.js';

const KEY = 'recentActions';
const MAX_RECENT = 8;

/**
 * Get the list of recent action ids (most recent first).
 * @returns {Promise<string[]>}
 */
export async function getRecentActions() {
  const list = await get(KEY, []);
  return Array.isArray(list) ? list : [];
}

/**
 * Record that an action was used. Moves it to the front.
 * @param {string} actionId
 */
export async function recordAction(actionId) {
  if (!actionId) return;
  const list = await getRecentActions();
  const filtered = list.filter((id) => id !== actionId);
  filtered.unshift(actionId);
  const trimmed = filtered.slice(0, MAX_RECENT);
  await set(KEY, trimmed);
}

/**
 * Clear recent actions.
 */
export async function clearRecentActions() {
  await set(KEY, []);
}
