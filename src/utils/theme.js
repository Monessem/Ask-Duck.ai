/**
 * Theme helpers — applies the user's theme preference to a shadow
 * root host or the document element.
 */

import { getSettings, onSettingsChanged, getCachedSettings } from '../services/settings.js';

/**
 * Apply the theme to the documentElement. Used by popup/options pages.
 * @param {HTMLElement} [el=document.documentElement]
 */
export async function applyTheme(el = document.documentElement) {
  const settings = await getSettings();
  const resolved = resolveTheme(settings.theme);
  el.setAttribute('data-theme', resolved);
}

/**
 * Apply the theme synchronously using the cached settings. Falls
 * back to 'system' if settings haven't been loaded yet.
 *
 * @param {HTMLElement} [el=document.documentElement]
 */
export function applyThemeSync(el = document.documentElement) {
  const settings = getCachedSettings();
  const resolved = resolveTheme(settings.theme);
  el.setAttribute('data-theme', resolved);
}

/**
 * @param {'system'|'light'|'dark'} pref
 * @returns {'light'|'dark'}
 */
export function resolveTheme(pref) {
  if (pref === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return pref;
}

/**
 * Subscribe to theme changes (settings + system preference).
 * @param {(theme: 'light'|'dark') => void} cb
 * @returns {() => void}
 */
export function watchTheme(cb) {
  let stopped = false;
  const off1 = onSettingsChanged(async (s) => {
    if (stopped) return;
    cb(resolveTheme(s.theme));
  });
  const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  const onMq = () => {
    if (stopped) return;
    const s = getCachedSettings();
    if (s.theme === 'system') cb(resolveTheme('system'));
  };
  if (mq) mq.addEventListener('change', onMq);
  return () => {
    stopped = true;
    off1 && off1();
    mq && mq.removeEventListener('change', onMq);
  };
}
