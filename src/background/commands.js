/**
 * Keyboard commands handler
 * ------------------------------------------------------------------
 * Listens for browser.commands events and routes them to the
 * appropriate action. Supports both sidebar and tab display modes.
 */

import { MSG } from './messaging.js';
import { getSettings } from '../services/settings.js';
import { buildPrompt } from '../prompts/prompt-builder.js';
import { launchInDuckAi } from '../services/duckai/duckai-client.js';

/**
 * Register the commands listener.
 */
export function registerCommands() {
  if (!browser.commands) return;
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'open-duckai-assistant') {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || !tabs.length) return;
        const tab = tabs[0];

        let selection = '';
        try {
          const resp = await browser.tabs.sendMessage(tab.id, { type: MSG.GET_SELECTION });
          selection = (resp && resp.selection) || '';
        } catch {
          // Content script may not be loaded on this page.
        }

        if (!selection) {
          // No selection — just open duck.ai.
          await browser.tabs.create({ url: 'https://duck.ai/' });
          return;
        }

        const settings = await getSettings();
        const actionId = settings.defaultActionId;
        const prompt = await buildPrompt({ actionId, selection });

        if (settings.displayMode === 'sidebar') {
          // Sidebar mode: tell the content script to open the sidebar.
          try {
            await browser.tabs.sendMessage(tab.id, {
              type: MSG.OPEN_SIDEBAR,
              payload: { prompt, autoSubmit: settings.autoSubmit }
            });
            return;
          } catch (err) {
            console.warn('Ask Duck.ai: sidebar open failed, falling back to tab', err);
          }
        }

        // Tab mode.
        await launchInDuckAi({ prompt, autoSubmit: settings.autoSubmit });
      } catch (err) {
        console.warn('Ask Duck.ai: command failed', err);
      }
    } else if (command === 'open-popup') {
      try {
        await browser.runtime.openOptionsPage();
      } catch {
        /* noop */
      }
    }
  });
}
