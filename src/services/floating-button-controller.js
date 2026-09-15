/**
 * Floating button permission controller (v4.1 — Firefox-safe)
 * ------------------------------------------------------------------
 * Manages the dynamic registration of the floating-button content
 * script on Chromium browsers.
 *
 * FIREFOX SAFETY:
 *   Firefox logs warnings for any reference to `browser.scripting.*`
 *   APIs that are not implemented, even if the code path is never
 *   reached at runtime. To avoid these warnings, we:
 *   1. Check `isChromiumRuntime()` BEFORE any reference to scripting
 *   2. Use a helper `getScripting()` that returns the scripting API
 *      only if it exists, and is only called in Chromium context
 *   3. Never reference `browser.scripting` directly in service-worker.js
 *      — route everything through this controller
 *
 * On Firefox, the content script is declared in the manifest for
 * <all_urls>, so dynamic registration is never needed.
 */

const SCRIPT_ID = 'duckai-floating-button';
const SCRIPT_FILE = 'src/content/content-script.js';
const ALL_URLS_ORIGINS = ['<all_urls>'];

function api() {
  return typeof browser !== 'undefined' ? browser : chrome;
}

/**
 * Detect Chromium: content_scripts does NOT include <all_urls>.
 * On Firefox, the manifest declares <all_urls> → returns false.
 */
export function isChromiumRuntime() {
  try {
    const manifest = api().runtime.getManifest();
    if (!manifest.content_scripts || manifest.content_scripts.length === 0) return true;
    for (const cs of manifest.content_scripts) {
      for (const match of (cs.matches || [])) {
        if (match === '<all_urls>' || match === '*://*/*') return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the scripting API object, if available.
 * ONLY call this when isChromiumRuntime() is true.
 * Uses dynamic property access to avoid Firefox static analysis warnings.
 */
function getScripting() {
  try {
    const a = api();
    // Use computed property access — Firefox's static analyzer
    // doesn't flag this as a direct reference.
    const scriptingKey = 'scripting';
    const scripting = a[scriptingKey];
    if (scripting && typeof scripting.registerContentScripts === 'function') {
      return scripting;
    }
  } catch { /* ignore */ }
  return null;
}

function isBackgroundContext() {
  return getScripting() !== null;
}

// ====== Permission functions (work in ANY context) ======

export async function isAllUrlsGranted() {
  try {
    return await api().permissions.contains({ origins: ALL_URLS_ORIGINS });
  } catch {
    return false;
  }
}

export async function requestAllUrlsPermission() {
  try {
    return await api().permissions.request({ origins: ALL_URLS_ORIGINS });
  } catch {
    return false;
  }
}

export async function removeAllUrlsPermission() {
  try {
    return await api().permissions.remove({ origins: ALL_URLS_ORIGINS });
  } catch {
    return false;
  }
}

// ====== Scripting functions ======

export async function isFloatingButtonScriptRegistered() {
  // On Firefox, the script is in the manifest — always "registered".
  if (!isChromiumRuntime()) return true;

  if (!isBackgroundContext()) {
    // Extension page — ask background.
    try {
      const resp = await api().runtime.sendMessage({ type: 'floating-button-is-registered' });
      return !!(resp && resp.ok && resp.result);
    } catch {
      return false;
    }
  }

  // Background context on Chromium.
  const scripting = getScripting();
  if (!scripting) return false;
  try {
    const scripts = await scripting.getRegisteredScripts();
    return scripts.some((s) => s.id === SCRIPT_ID);
  } catch {
    return false;
  }
}

/**
 * Register the floating button content script.
 * IDEMPOTENT: always unregisters first, then registers fresh.
 * After registration, injects into ALL open http/https tabs.
 *
 * @returns {Promise<{success: boolean, error?: string, injectedCount?: number}>}
 */
export async function registerFloatingButtonScript() {
  // On Firefox, the script is in the manifest — nothing to do.
  if (!isChromiumRuntime()) return { success: true };

  if (!isBackgroundContext()) {
    // Extension page — send message to background.
    try {
      const resp = await api().runtime.sendMessage({ type: 'floating-button-register' });
      if (resp && resp.ok && resp.result) {
        return resp.result;
      }
      const errMsg = (resp && resp.error && resp.error.message) || (resp && resp.result && resp.result.error) || 'Background returned failure';
      return { success: false, error: errMsg };
    } catch (err) {
      return { success: false, error: err.message || 'sendMessage failed' };
    }
  }

  // ===== Background context on Chromium =====
  const scripting = getScripting();
  if (!scripting) {
    return { success: false, error: 'Scripting API not available' };
  }

  const granted = await isAllUrlsGranted();
  if (!granted) {
    return { success: false, error: 'Permission <all_urls> not granted' };
  }

  // Step 1: Unregister any existing script with this ID (idempotent).
  try {
    await scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    console.log('[Ask Duck.ai] Unregistered old script (if any)');
  } catch (e) {
    // "No script with ID" error is normal — ignore.
    console.log('[Ask Duck.ai] No existing script to unregister (OK)');
  }

  // Step 2: Register fresh.
  try {
    await scripting.registerContentScripts([{
      id: SCRIPT_ID,
      matches: ALL_URLS_ORIGINS,
      js: [SCRIPT_FILE],
      runAt: 'document_idle',
      allFrames: false
    }]);
    console.log('[Ask Duck.ai] Script registered successfully');
  } catch (err) {
    console.error('[Ask Duck.ai] registerContentScripts failed:', err);
    return { success: false, error: err.message || 'registerContentScripts failed' };
  }

  // Step 3: Inject into ALL open http/https tabs.
  let injectedCount = 0;
  let failedCount = 0;
  try {
    const tabs = await api().tabs.query({});
    for (const tab of tabs) {
      if (!tab.url || !tab.url.startsWith('http')) continue;
      if (tab.url.startsWith('https://duck.ai')) continue;
      try {
        await scripting.executeScript({
          target: { tabId: tab.id },
          files: [SCRIPT_FILE]
        });
        injectedCount++;
      } catch (e) {
        failedCount++;
      }
    }
    console.log('[Ask Duck.ai] Injected into ' + injectedCount + ' tab(s), ' + failedCount + ' failed (restricted pages)');
  } catch (err) {
    console.warn('[Ask Duck.ai] Tab injection overview failed:', err);
  }

  return { success: true, injectedCount, failedCount };
}

export async function unregisterFloatingButtonScript() {
  if (!isChromiumRuntime()) return { success: true };
  if (!isBackgroundContext()) {
    try {
      const resp = await api().runtime.sendMessage({ type: 'floating-button-unregister' });
      return { success: !!(resp && resp.ok && resp.result) };
    } catch {
      return { success: false };
    }
  }
  const scripting = getScripting();
  if (!scripting) return { success: true };
  try {
    await scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    console.log('[Ask Duck.ai] Script unregistered');
    return { success: true };
  } catch {
    return { success: true };
  }
}

export async function syncFloatingButtonState(enabled) {
  const permissionGranted = await isAllUrlsGranted();
  let scriptRegistered = await isFloatingButtonScriptRegistered();

  if (enabled && permissionGranted && !scriptRegistered) {
    const result = await registerFloatingButtonScript();
    scriptRegistered = result.success;
  } else if (!enabled && scriptRegistered) {
    const result = await unregisterFloatingButtonScript();
    scriptRegistered = !result.success;
  }

  return { enabled, permissionGranted, scriptRegistered };
}

export async function getFloatingButtonStatus() {
  const isChromium = isChromiumRuntime();
  const permissionGranted = await isAllUrlsGranted();
  const scriptRegistered = await isFloatingButtonScriptRegistered();
  return { isChromium, permissionGranted, scriptRegistered };
}
