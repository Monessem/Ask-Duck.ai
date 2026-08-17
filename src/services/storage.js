/**
 * Storage service — wraps browser.storage.local with a typed API
 * and namespacing so the rest of the code never touches storage
 * directly.
 */

const NAMESPACE = 'duckai';
const key = (k) => `${NAMESPACE}.${k}`;

/**
 * @template T
 * @param {string} k
 * @param {T} fallback
 * @returns {Promise<T>}
 */
export async function get(k, fallback) {
  try {
    const result = await browser.storage.local.get(key(k));
    const v = result[key(k)];
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

/**
 * @param {string} k
 * @param {*} v
 * @returns {Promise<void>}
 */
export async function set(k, v) {
  await browser.storage.local.set({ [key(k)]: v });
}

/**
 * @param {string} k
 * @returns {Promise<void>}
 */
export async function remove(k) {
  await browser.storage.local.remove(key(k));
}

/**
 * Remove ALL extension data (every namespaced key plus the
 * browser.storage.local root).
 *
 * @returns {Promise<void>}
 */
export async function clearAll() {
  const all = await browser.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(`${NAMESPACE}.`));
  if (keys.length) await browser.storage.local.remove(keys);
}

/**
 * Subscribe to storage changes for a specific key.
 * @param {string} k
 * @param {(newValue: *, oldValue: *) => void} cb
 * @returns {() => void} unsubscribe
 */
export function onChange(k, cb) {
  const listener = (changes, area) => {
    if (area !== 'local') return;
    const fullKey = key(k);
    if (!(fullKey in changes)) return;
    cb(changes[fullKey].newValue, changes[fullKey].oldValue);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
