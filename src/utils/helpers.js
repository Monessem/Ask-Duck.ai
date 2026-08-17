/**
 * Misc utility helpers shared across the extension.
 */

/**
 * Promise-chained debouncer.
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(fn, wait) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Format a timestamp as a short local time string.
 * @param {number} ts
 * @returns {string}
 */
export function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

/**
 * Format a timestamp as a short date string.
 * @param {number} ts
 * @returns {string}
 */
export function formatDate(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

/**
 * Truncate a string to N chars, adding an ellipsis if needed.
 * @param {string} s
 * @param {number} n
 * @returns {string}
 */
export function truncate(s, n = 80) {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '\u2026';
}

/**
 * Wait for a predicate to become true. Resolves with the predicate
 * result; rejects if timeout elapses.
 *
 * @param {() => boolean} predicate
 * @param {number} [timeoutMs=2000]
 * @param {number} [intervalMs=50]
 * @returns {Promise<void>}
 */
export function waitFor(predicate, timeoutMs = 2000, intervalMs = 50) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      try {
        if (predicate()) return resolve();
      } catch (err) {
        return reject(err);
      }
      if (Date.now() - start >= timeoutMs) {
        return reject(new Error('waitFor timeout'));
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

/**
 * Generate a reasonably-unique id without external deps.
 * @returns {string}
 */
export function uid() {
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  );
}

/**
 * Safe JSON parse.
 * @param {string} s
 * @param {*} fallback
 * @returns {*}
 */
export function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

/**
 * Returns true if the document looks like a page where injecting a
 * floating button would be a bad idea (PDF.js viewer, devtools,
 * about: pages, etc.).
 *
 * @returns {boolean}
 */
export function isUnsupportedPage() {
  if (typeof document === 'undefined') return true;
  const url = location.href;
  if (!url || !url.startsWith('http')) return true;
  // PDF.js viewer
  if (document.body && document.body.getAttribute('class') && /pdf-viewer/.test(document.body.getAttribute('class'))) {
    return true;
  }
  return false;
}
