/**
 * Duck.ai Launcher (UNOFFICIAL) — v4.0
 * ------------------------------------------------------------------
 * Opens Duck.ai in a new tab/popup with a prompt pre-filled.
 *
 * MULTI-TAB FIX: Each prompt gets a unique ID. The prompt is stored
 * keyed by ID, and the ID is passed via URL hash (#p=<id>). Each
 * duck.ai tab reads ITS OWN prompt from the hash — no queue race
 * conditions, every tab gets the right prompt.
 * ------------------------------------------------------------------
 */

const DUCKAI_URL = 'https://duck.ai/';
const PROMPTS_KEY = 'duckai.prompts'; // Map of id -> {prompt, autoSubmit, timestamp}

export class DuckAIError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'DuckAIError';
    this.code = opts.code || 'duckai_unknown';
  }
}

function getStorage() {
  return browser.storage.local;
}

/**
 * Store a prompt with a unique ID. Returns the ID.
 * The caller appends #p=<id> to the duck.ai URL.
 */
export async function storePendingPrompt(prompt, autoSubmit = true) {
  const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const item = {
    id,
    prompt: prompt || '',
    autoSubmit,
    timestamp: Date.now()
  };

  const result = await getStorage().get(PROMPTS_KEY);
  const map = (result[PROMPTS_KEY] && typeof result[PROMPTS_KEY] === 'object') ? result[PROMPTS_KEY] : {};
  map[id] = item;
  await getStorage().set({ [PROMPTS_KEY]: map });

  // Schedule cleanup after 10 minutes (in case tab never loads).
  setTimeout(() => cleanupPrompt(id), 10 * 60 * 1000);
  return id;
}

/**
 * Get a specific prompt by ID and remove it from storage.
 * Called by the injector when the tab loads.
 */
export async function consumePrompt(id) {
  if (!id) return null;
  const result = await getStorage().get(PROMPTS_KEY);
  const map = (result[PROMPTS_KEY] && typeof result[PROMPTS_KEY] === 'object') ? result[PROMPTS_KEY] : {};
  const item = map[id];
  if (!item) return null;
  delete map[id];
  await getStorage().set({ [PROMPTS_KEY]: map });
  return item;
}

/**
 * Remove a prompt from storage (cleanup).
 */
async function cleanupPrompt(id) {
  try {
    const result = await getStorage().get(PROMPTS_KEY);
    const map = (result[PROMPTS_KEY] && typeof result[PROMPTS_KEY] === 'object') ? result[PROMPTS_KEY] : {};
    if (map[id]) {
      delete map[id];
      await getStorage().set({ [PROMPTS_KEY]: map });
    }
  } catch {}
}

/**
 * Launch Duck.ai in a new tab with a prompt pre-filled.
 * The prompt ID is passed via URL hash.
 */
export async function launchInDuckAi({ prompt, autoSubmit = true }) {
  if (!prompt || typeof prompt !== 'string') {
    throw new DuckAIError('No prompt provided', { code: 'duckai_empty_request' });
  }
  const id = await storePendingPrompt(prompt, autoSubmit);
  // Pass the ID via URL hash so the injector knows which prompt to load.
  const url = `${DUCKAI_URL}#p=${id}`;
  await browser.tabs.create({ url, active: true });
}

/**
 * Build the duck.ai URL with a prompt ID hash.
 */
export function buildDuckAiUrl(promptId) {
  return `${DUCKAI_URL}#p=${promptId}`;
}

/**
 * Test whether Duck.ai is reachable.
 */
export async function testConnection(signal) {
  try {
    const response = await fetch(DUCKAI_URL, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-cache',
      signal
    });
    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? 'Connection successful' : `HTTP ${response.status}`
    };
  } catch (err) {
    if (err && err.name === 'AbortError') return { ok: false, message: 'Cancelled' };
    return { ok: false, message: err && err.message ? err.message : 'Network error' };
  }
}
