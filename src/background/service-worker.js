/**
 * Background service worker (v4.4 — clean, stable)
 * ------------------------------------------------------------------
 * Handles:
 *   - Context menu building and clicks
 *   - Keyboard commands
 *   - Message routing from popup/content scripts
 *   - Building prompts and delivering to Duck.ai
 *   - User custom prompts (user- prefix)
 */

import { buildContextMenu, resolveMenuItem } from './context-menu.js';
import { MSG } from './messaging.js';
import { storePendingPrompt, buildDuckAiUrl, DuckAIError } from '../services/duckai/duckai-client.js';
import { getSettings, onSettingsChanged } from '../services/settings.js';
import { buildPrompt } from '../prompts/prompt-builder.js';
import { getAction } from '../prompts/actions.js';
import { recordAction } from '../services/recent-actions.js';

const DUCKAI_URL = 'https://duck.ai/';

// ====== Register all listeners IMMEDIATELY (sync) at top level ======
// This is critical for Firefox MV3 — listeners must be registered
// before any async work, otherwise events may be missed.

try {
  if (browser.contextMenus && browser.contextMenus.onClicked) {
    browser.contextMenus.onClicked.addListener(handleContextMenuClick);
  }
} catch (e) { console.error('Duck.ai: ctx menu listener', e); }

try {
  if (browser.runtime && browser.runtime.onMessage) {
    browser.runtime.onMessage.addListener(handleMessage);
  }
} catch (e) { console.error('Duck.ai: msg listener', e); }

try {
  if (browser.commands && browser.commands.onCommand) {
    browser.commands.onCommand.addListener(handleCommand);
  }
} catch (e) { console.error('Duck.ai: commands listener', e); }

try {
  onSettingsChanged(async (s) => {
    try {
      if (s.contextMenu) await buildContextMenu();
      else await browser.contextMenus.removeAll();
    } catch (e) { console.error('Duck.ai: ctx rebuild', e); }
  });
} catch (e) { console.error('Duck.ai: settings listener', e); }

// Build context menu (async, non-blocking).
buildContextMenu().catch((e) => console.error('Duck.ai: ctx menu build', e));

// ====== Context menu click handler ======
async function handleContextMenuClick(info, tab) {
  try {
    const settings = await getSettings();
    if (!settings.contextMenu) return;

    // Page-level utility items.
    if (info.menuItemId === 'duckai-settings') {
      await browser.runtime.openOptionsPage();
      return;
    }
    if (info.menuItemId === 'duckai-bmac') {
      await browser.tabs.create({ url: 'https://buymeacoffee.com/monessem' });
      return;
    }
    if (info.menuItemId === 'duckai-send-page') {
      await sendPageToDuckAi(tab, null);
      return;
    }
    if (info.menuItemId === 'duckai-summarize-page') {
      await sendPageToDuckAi(tab, 'summary.general');
      return;
    }

    // Selection-based actions.
    const resolved = resolveMenuItem(info.menuItemId);
    if (!resolved) return;

    const selection = (info.selectionText || '').trim();
    if (!selection) return;

    if (resolved.choose) {
      // Ask user for custom language.
      try {
        const resp = await browser.tabs.sendMessage(tab.id, {
          type: MSG.PROMPT_INPUT, payload: { prompt: 'Enter target language:' }
        });
        if (resp && resp.value) {
          await executeAction('translate', selection, resp.value.trim());
        }
      } catch {
        await executeAction('translate', selection, settings.defaultLanguage);
      }
      return;
    }

    await executeAction(resolved.actionId, selection, resolved.input || null);
  } catch (err) {
    console.error('Duck.ai: ctx click error', err);
  }
}

// ====== Keyboard command handler ======
async function handleCommand(command) {
  try {
    if (command === 'open-popup') {
      await browser.runtime.openOptionsPage();
      return;
    }
    if (command !== 'open-duckai-assistant') return;

    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs.length) return;
    const tab = tabs[0];

    let selection = '';
    try {
      const resp = await browser.tabs.sendMessage(tab.id, { type: MSG.GET_SELECTION });
      selection = (resp && resp.selection) || '';
    } catch { /* content script not loaded */ }

    const settings = await getSettings();
    if (selection) {
      const actionId = settings.defaultActionId;
      const prompt = await buildPrompt({ actionId, selection });
      await recordAction(actionId);
      await deliverPrompt(prompt, settings);
    } else {
      await browser.tabs.create({ url: DUCKAI_URL });
    }
  } catch (err) {
    console.error('Duck.ai: command error', err);
  }
}

// ====== Message handler ======
function handleMessage(message, sender, sendResponse) {
  handleMessageAsync(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) => sendResponse({
      ok: false,
      error: { message: err && err.message, code: err && err.code }
    }));
  return true; // async response
}

async function handleMessageAsync(message, sender) {
  if (!message || !message.type) return null;

  switch (message.type) {
    case MSG.RUN_ACTION: {
      const { actionId, selection, input } = message.payload || {};
      return await executeAction(actionId, selection, input);
    }

    case MSG.PAGE_ACTION: {
      const { actionId, pageTitle, pageUrl, pageDescription } = message.payload || {};
      const settings = await getSettings();
      const { buildPagePrompt } = await import('../prompts/prompt-builder.js');
      const prompt = await buildPagePrompt({ actionId, pageTitle, pageUrl, pageDescription });
      await recordAction(actionId);
      return await deliverPrompt(prompt, settings);
    }

    case MSG.ACTION_FROM_POPUP: {
      const { actionId, input } = message.payload || {};
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs.length) throw new DuckAIError('No active tab', { code: 'duckai_unknown' });
      const tab = tabs[0];
      let selection = message.payload?.selection || '';
      if (!selection) {
        try {
          const resp = await browser.tabs.sendMessage(tab.id, { type: MSG.GET_SELECTION });
          selection = (resp && resp.selection) || '';
        } catch { /* ignore */ }
      }
      if (!selection) throw new DuckAIError('No text selected', { code: 'duckai_empty_request' });
      return await executeAction(actionId, selection, input);
    }

    case MSG.GET_SELECTION:
      return { selection: '' };

    case MSG.OPEN_IN_DUCKAI:
      await browser.tabs.create({ url: DUCKAI_URL });
      return { ok: true };

    case MSG.GET_RECENT_ACTIONS: {
      const { getRecentActions } = await import('../services/recent-actions.js');
      return { actions: await getRecentActions() };
    }

    default:
      return null;
  }
}

// ====== Core: execute action ======
async function executeAction(actionId, selection, input) {
  const settings = await getSettings();
  const finalActionId = actionId || settings.defaultActionId;

  // User custom prompts have IDs starting with 'user-'.
  const isUserPrompt = finalActionId && finalActionId.startsWith('user-');
  let action = null;
  if (!isUserPrompt) {
    action = getAction(finalActionId);
    if (!action) throw new DuckAIError(`Unknown action: ${finalActionId}`, { code: 'duckai_unknown' });
  }

  if (!selection || !selection.trim()) {
    throw new DuckAIError('No text selected', { code: 'duckai_empty_request' });
  }

  const prompt = await buildPrompt({
    actionId: finalActionId,
    selection,
    input: input || (action && action.category === 'translate' ? settings.defaultLanguage : null)
  });
  await recordAction(finalActionId);
  return await deliverPrompt(prompt, settings);
}

// ====== Send page to Duck.ai ======
async function sendPageToDuckAi(tab, actionId) {
  try {
    let pageMeta = { title: tab.title || '', url: tab.url || '', text: '' };
    try {
      const resp = await browser.tabs.sendMessage(tab.id, { type: 'get-page-content' });
      if (resp) {
        pageMeta.title = resp.title || pageMeta.title;
        pageMeta.url = resp.url || pageMeta.url;
        pageMeta.text = resp.text || '';
      }
    } catch { /* content script not loaded */ }

    let prompt;
    if (actionId) {
      const selection = pageMeta.text || pageMeta.title || pageMeta.url;
      prompt = await buildPrompt({ actionId, selection });
    } else {
      const lines = [
        'Read and analyze this webpage:',
        '',
        `Title: ${pageMeta.title}`,
        `URL: ${pageMeta.url}`,
        ''
      ];
      if (pageMeta.text) {
        const text = pageMeta.text.length > 6000
          ? pageMeta.text.slice(0, 6000) + '\n[...truncated]'
          : pageMeta.text;
        lines.push('Content:', text);
      } else {
        lines.push('(Could not extract page content.)');
      }
      prompt = lines.join('\n');
    }

    const settings = await getSettings();
    await deliverPrompt(prompt, settings);
  } catch (err) {
    console.error('Duck.ai: sendPageToDuckAi', err);
  }
}

// ====== Deliver prompt to Duck.ai ======
async function deliverPrompt(prompt, settings) {
  // 1. Store the prompt — returns a unique ID.
  const promptId = await storePendingPrompt(prompt, settings.autoSubmit);
  const url = buildDuckAiUrl(promptId);
  console.log('[Duck.ai] Prompt stored (' + prompt.length + ' chars, id=' + promptId + ')');

  // 2. Try to reuse an existing duck.ai tab first.
  try {
    const existingTab = await findExistingDuckAiTab();
    if (existingTab) {
      // Navigate the existing tab to the new URL (with new prompt hash).
      await browser.tabs.update(existingTab.id, { url, active: true });
      // Focus the window containing the tab.
      try {
        await browser.windows.update(existingTab.windowId, { focused: true });
      } catch {}
      console.log('[Duck.ai] Reused existing tab:', existingTab.id);
      return { ok: true, mode: 'tab-reused' };
    }
  } catch (e) {
    console.warn('[Duck.ai: reuse tab failed', e);
  }

  // 3. No existing tab — open new one.
  if (settings.displayMode === 'sidebar') {
    return await openDuckAiPopupWindow(url);
  }
  await browser.tabs.create({ url, active: true });
  return { ok: true, mode: 'tab' };
}

// ====== Find existing duck.ai tab ======
async function findExistingDuckAiTab() {
  try {
    const tabs = await browser.tabs.query({ url: 'https://duck.ai/*' });
    if (tabs && tabs.length > 0) {
      // Return the first duck.ai tab (prefer the most recently active).
      return tabs[0];
    }
  } catch (e) {
    console.warn('[Duck.ai] findExistingDuckAiTab', e);
  }
  return null;
}

// ====== Popup window creation ======
async function openDuckAiPopupWindow(url) {
  let width = 500, height = 800, left = 0, top = 0;
  try {
    const win = await browser.windows.getCurrent({ populate: false });
    width = Math.min(520, Math.floor((win.width || 1200) * 0.38));
    height = Math.min(win.height || 900, 900);
    left = (win.left || 0) + (win.width || 1200) - width;
    top = win.top || 0;
    if (left < 0) left = 0;
    if (top < 0) top = 0;
  } catch {
    left = Math.max(0, screen.availWidth - width - 20);
    top = 40;
  }
  try {
    await browser.windows.create({ url, type: 'popup', width, height, left, top });
    return { ok: true, mode: 'popup' };
  } catch (err) {
    console.warn('Duck.ai: popup failed, opening tab', err);
    await browser.tabs.create({ url });
    return { ok: true, mode: 'tab' };
  }
}
