/**
 * Onboarding page controller
 * ------------------------------------------------------------------
 * Shown on first install (and when user opens it manually).
 * Guides the user through enabling the floating button and
 * understanding how the extension works.
 */

import { applyTheme } from '../utils/theme.js';
import { applyDocumentDirection, t } from '../utils/i18n.js';
import { getSettings, setSettings } from '../services/settings.js';
import {
  isChromiumRuntime,
  isAllUrlsGranted,
  requestAllUrlsPermission,
  registerFloatingButtonScript
} from '../services/floating-button-controller.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  applyDocumentDirection();
  await applyTheme(document.documentElement);
  await checkFloatingButtonState();
  wireButtons();
}

/**
 * Check the current floating button state and update the UI.
 * On Firefox, the floating button works out of the box (no permission needed).
 * On Chromium, we need to request <all_urls> permission.
 */
async function checkFloatingButtonState() {
  const statusEl = document.getElementById('floating-status');
  const enableBtn = document.getElementById('enable-floating-btn');
  if (!statusEl || !enableBtn) return;

  const settings = await getSettings();
  if (!settings.floatingButton) {
    // Setting is off — show "Enable" button.
    statusEl.textContent = '';
    return;
  }

  // Setting is on — check if permission is granted.
  if (!isChromiumRuntime()) {
    // Firefox — floating button works without extra permission.
    statusEl.textContent = '✓ Active';
    statusEl.className = 'status-text success';
    enableBtn.textContent = 'Already enabled';
    enableBtn.disabled = true;
    return;
  }

  // Chromium — check permission.
  const granted = await isAllUrlsGranted();
  if (granted) {
    statusEl.textContent = '✓ Active';
    statusEl.className = 'status-text success';
    enableBtn.textContent = 'Already enabled';
    enableBtn.disabled = true;
  } else {
    statusEl.textContent = 'Permission needed';
    statusEl.className = 'status-text';
  }
}

function wireButtons() {
  const enableBtn = document.getElementById('enable-floating-btn');
  if (enableBtn) {
    enableBtn.addEventListener('click', async () => {
      enableBtn.disabled = true;
      const originalText = enableBtn.textContent;
      enableBtn.textContent = 'Requesting...';
      const statusEl = document.getElementById('floating-status');

      // Ensure the setting is enabled.
      await setSettings({ floatingButton: true });

      // On Chromium, request <all_urls> permission (user gesture).
      if (isChromiumRuntime()) {
        const alreadyGranted = await isAllUrlsGranted();
        if (!alreadyGranted) {
          const result = await requestAllUrlsPermission();
          if (!result) {
            if (statusEl) {
              statusEl.textContent = 'Permission denied — floating button cannot work without site access.';
              statusEl.className = 'status-text error';
            }
            enableBtn.disabled = false;
            enableBtn.textContent = '';
            const retryIcon = document.createElement('span');
            retryIcon.className = 'btn-icon';
            retryIcon.textContent = '🦆';
            enableBtn.appendChild(retryIcon);
            enableBtn.appendChild(document.createTextNode(' Try again'));
            return;
          }
        }
      }

      // Now register the floating button content script.
      // This sends a message to the background service worker,
      // which uses chrome.scripting.registerContentScripts() and
      // also injects the script into ALL open tabs.
      //
      // Retry up to 3 times — the service worker might need a moment
      // to wake up on Chrome MV3.
      let result = null;
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (attempt > 1) {
          // Wait before retrying.
          await new Promise((r) => setTimeout(r, 500));
        }
        try {
          result = await registerFloatingButtonScript();
          if (result && result.success) break;
          lastError = (result && result.error) || 'Unknown error';
        } catch (err) {
          lastError = err.message || 'Exception during registration';
        }
      }

      if (!result || !result.success) {
        if (statusEl) {
          statusEl.textContent = 'Failed to register: ' + (lastError || 'Unknown error') + '. Please try again.';
          statusEl.className = 'status-text error';
        }
        enableBtn.disabled = false;
        enableBtn.textContent = originalText;
        return;
      }

      // Success!
      if (statusEl) {
        const injectMsg = result.injectedCount !== undefined
          ? ' Injected into ' + result.injectedCount + ' tab(s).'
          : '';
        statusEl.textContent = '✓ Floating button enabled!' + injectMsg + ' Select text on any webpage to try it.';
        statusEl.className = 'status-text success';
      }
      enableBtn.textContent = '';
      const checkIcon = document.createElement('span');
      checkIcon.className = 'btn-icon';
      checkIcon.textContent = '✓';
      const label = document.createTextNode(' Enabled');
      enableBtn.appendChild(checkIcon);
      enableBtn.appendChild(label);
      enableBtn.disabled = true;
    });
  }

  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      window.close();
    });
  }

  const goSettingsBtn = document.getElementById('go-settings-btn');
  if (goSettingsBtn) {
    goSettingsBtn.addEventListener('click', () => {
      browser.runtime.openOptionsPage();
      window.close();
    });
  }
}
