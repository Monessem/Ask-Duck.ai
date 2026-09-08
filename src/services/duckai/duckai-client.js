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
const PROMPT_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_PROMPTS = 20;
const CLEANUP_ALARM = 'duckai.prompt-cleanup';

// All prompt-map writes go through this queue: storage.local has no
// atomic read-modify-write, so concurrent callers would drop entries.
let writeQueue = Promise.resolve();
function withPromptLock(fn) {
  const run = () => fn();
  writeQueue = writeQueue.then(run, run);
  return writeQueue;
}

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
  const id = newPromptId();
  const item = {
    id,
    prompt: prompt || '',
    autoSubmit,
    timestamp: Date.now()
  };

  await withPromptLock(async () => {
    const map = pruneMap(await readMap());
    map[id] = item;
    await getStorage().set({ [PROMPTS_KEY]: map });
  });

  scheduleCleanup();
  return id;
}

function newPromptId() {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return Date.now().toString(36) + '-' + random;
}

async function readMap() {
  const result = await getStorage().get(PROMPTS_KEY);
  const value = result[PROMPTS_KEY];
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
}

/**
 * Drop expired prompts, then cap the map size. Prompts may contain text
 * copied from the user's pages, so they must not linger in storage.
 */
function pruneMap(map) {
  const now = Date.now();
  const entries = Object.entries(map)
    .filter(([, item]) => item && typeof item === 'object' && now - (item.timestamp || 0) < PROMPT_TTL_MS)
    .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
    .slice(0, MAX_PENDING_PROMPTS - 1);
  return Object.fromEntries(entries);
}

/**
 * MV3 background contexts can be terminated at any time, so cleanup is
 * driven by an alarm rather than setTimeout.
 */
function scheduleCleanup() {
  try {
    if (!globalThis.browser || !browser.alarms) return;
    browser.alarms.create(CLEANUP_ALARM, { delayInMinutes: 1, periodInMinutes: 5 });
    if (!browser.alarms.onAlarm.hasListener(onCleanupAlarm)) {
      browser.alarms.onAlarm.addListener(onCleanupAlarm);
    }
  } catch { /* alarms unavailable (e.g. content script) */ }
}

async function onCleanupAlarm(alarm) {
  if (!alarm || alarm.name !== CLEANUP_ALARM) return;
  await purgeExpiredPrompts();
}

/**
 * Remove every prompt older than the TTL.
 */
export async function purgeExpiredPrompts() {
  try {
    await withPromptLock(async () => {
      const map = await readMap();
      const kept = pruneMap(map);
      if (Object.keys(kept).length !== Object.keys(map).length) {
        await getStorage().set({ [PROMPTS_KEY]: kept });
      }
      if (Object.keys(kept).length === 0 && globalThis.browser && browser.alarms) {
        try { await browser.alarms.clear(CLEANUP_ALARM); } catch {}
      }
    });
  } catch {}
}

/**
 * Get a specific prompt by ID and remove it from storage.
 * Called by the injector when the tab loads.
 */
export async function consumePrompt(id) {
  if (!id) return null;
  return await withPromptLock(async () => {
    const map = await readMap();
    const item = map[id];
    if (!item) return null;
    delete map[id];
    await getStorage().set({ [PROMPTS_KEY]: map });
    if (Date.now() - (item.timestamp || 0) > PROMPT_TTL_MS) return null;
    return item;
  });
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
