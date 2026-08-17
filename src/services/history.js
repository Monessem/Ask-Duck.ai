/**
 * Conversation history service
 * ------------------------------------------------------------------
 * Stores completed conversations locally when the user opts in.
 * History is OFF by default for privacy.
 */

import { get, set } from './storage.js';
import { uid } from '../utils/helpers.js';

const KEY = 'history';

/**
 * @typedef {Object} Conversation
 * @property {string} id
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string} title       - Truncated first user message
 * @property {string} sourceUrl   - URL where the conversation started (optional)
 * @property {Array<{role:'user'|'assistant', content:string, timestamp:number, actionId?:string}>} turns
 */

/**
 * @returns {Promise<Conversation[]>}
 */
export async function getAllConversations() {
  const list = await get(KEY, []);
  return Array.isArray(list) ? list : [];
}

/**
 * @param {string} id
 * @returns {Promise<Conversation|null>}
 */
export async function getConversation(id) {
  const all = await getAllConversations();
  return all.find((c) => c.id === id) || null;
}

/**
 * @param {number} maxItems
 * @returns {Promise<Conversation[]>}
 */
export async function trimOldConversations(maxItems) {
  const all = await getAllConversations();
  if (all.length <= maxItems) return all;
  const sorted = all.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  const kept = sorted.slice(0, maxItems);
  await set(KEY, kept);
  return kept;
}

/**
 * Create a new conversation record.
 * @param {{sourceUrl?: string, title?: string}} [meta]
 * @returns {Conversation}
 */
export function createConversation(meta = {}) {
  const now = Date.now();
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    title: meta.title || 'New conversation',
    sourceUrl: meta.sourceUrl || '',
    turns: []
  };
}

/**
 * Persist a conversation (insert or update).
 * @param {Conversation} conv
 * @param {number} [maxItems]
 * @returns {Promise<Conversation>}
 */
export async function saveConversation(conv, maxItems = 50) {
  const all = await getAllConversations();
  const idx = all.findIndex((c) => c.id === conv.id);
  conv.updatedAt = Date.now();
  if (idx >= 0) {
    all[idx] = conv;
  } else {
    all.unshift(conv);
  }
  // Trim
  const sorted = all.sort((a, b) => b.updatedAt - a.updatedAt);
  const kept = sorted.slice(0, maxItems);
  await set(KEY, kept);
  return conv;
}

/**
 * Append a single turn to a conversation.
 * @param {string} id
 * @param {{role:'user'|'assistant', content:string, actionId?:string}} turn
 * @param {number} [maxItems]
 * @returns {Promise<Conversation|null>}
 */
export async function appendTurn(id, turn, maxItems = 50) {
  const all = await getAllConversations();
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const conv = all[idx];
  conv.turns.push({ ...turn, timestamp: Date.now() });
  conv.updatedAt = Date.now();
  // Update title from first user turn if needed.
  if (conv.title === 'New conversation') {
    const firstUser = conv.turns.find((t) => t.role === 'user');
    if (firstUser) {
      conv.title = firstUser.content.replace(/\s+/g, ' ').trim().slice(0, 60);
    }
  }
  return saveConversation(conv, maxItems);
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteConversation(id) {
  const all = await getAllConversations();
  const next = all.filter((c) => c.id !== id);
  await set(KEY, next);
}

/**
 * Clear all stored conversations.
 * @returns {Promise<void>}
 */
export async function clearAllConversations() {
  await set(KEY, []);
}
