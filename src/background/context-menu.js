/**
 * Context menu builder (v4.3 — robust)
 * ------------------------------------------------------------------
 * Single context menu with category submenus.
 * Wrapped in try-catch to prevent total failure.
 */

import { CATEGORIES, TRANSLATE_LANGUAGES, getActionsByCategory, getAction } from '../prompts/actions.js';

export async function buildContextMenu() {
  if (!browser.contextMenus) {
    console.error('Duck.ai: contextMenus API not available');
    return;
  }
  try {
    await browser.contextMenus.removeAll();
  } catch (e) {
    console.error('Duck.ai: removeAll failed', e);
    return;
  }

  const ALL_CTX = ['page', 'frame', 'selection', 'link', 'image', 'editable'];
  const SEL_CTX = ['selection'];

  try {
    // ---- 1. Page-level actions on top (always visible) ----
    browser.contextMenus.create({
      id: 'duckai-send-page',
      title: '📄 ' + (browser.i18n.getMessage('contextMenuSendPage') || 'Send this page to Duck.ai'),
      contexts: ALL_CTX
    });

    browser.contextMenus.create({
      id: 'duckai-summarize-page',
      title: '🗂️ ' + (browser.i18n.getMessage('contextMenuSummarizePage') || 'Summarize this page'),
      contexts: ALL_CTX
    });

    // ---- 2. Separator before categories ----
    browser.contextMenus.create({
      id: 'duckai-sep1',
      type: 'separator',
      contexts: ALL_CTX
    });

    // ---- 3. Category submenus (selection only) ----
    for (const cat of CATEGORIES) {
      const catId = `cat-${cat.id}`;
      browser.contextMenus.create({
        id: catId,
        title: `${cat.icon} ${browser.i18n.getMessage(cat.labelKey) || cat.defaultLabel}`,
        contexts: SEL_CTX
      });

      if (cat.id === 'translate') {
        for (const lang of TRANSLATE_LANGUAGES) {
          browser.contextMenus.create({
            id: `translate-${lang.code}`,
            parentId: catId,
            title: `${lang.flag} ${browser.i18n.getMessage(lang.labelKey) || lang.defaultLabel}`,
            contexts: SEL_CTX
          });
        }
        browser.contextMenus.create({
          id: 'translate-sep',
          parentId: catId,
          type: 'separator',
          contexts: SEL_CTX
        });
        browser.contextMenus.create({
          id: 'translate-choose',
          parentId: catId,
          title: browser.i18n.getMessage('actionTranslateChoose') || 'Choose language...',
          contexts: SEL_CTX
        });
      } else {
        const actions = getActionsByCategory(cat.id);
        for (const action of actions) {
          browser.contextMenus.create({
            id: `action-${action.id}`,
            parentId: catId,
            title: browser.i18n.getMessage(action.labelKey) || action.defaultLabel,
            contexts: SEL_CTX
          });
        }
      }
    }

    // ---- 3b. "My Prompts" submenu (selection only, best-effort) ----
    try {
      const { getUserPrompts } = await import('../services/user-prompts.js');
      const userPrompts = await getUserPrompts();
      if (userPrompts && userPrompts.length > 0) {
        browser.contextMenus.create({
          id: 'cat-myprompts',
          title: '⭐ ' + (browser.i18n.getMessage('categoryMyPrompts') || 'My Prompts'),
          contexts: SEL_CTX
        });
        for (const p of userPrompts) {
          browser.contextMenus.create({
            id: `user-${p.id}`,
            parentId: 'cat-myprompts',
            title: p.label,
            contexts: SEL_CTX
          });
        }
      }
    } catch (e) {
      console.warn('Duck.ai: user prompts in menu failed', e);
    }

    // ---- 4. Separator + utility items at bottom ----
    browser.contextMenus.create({
      id: 'duckai-sep2',
      type: 'separator',
      contexts: ALL_CTX
    });

    browser.contextMenus.create({
      id: 'duckai-settings',
      title: '⚙️ ' + (browser.i18n.getMessage('contextMenuSettings') || 'Settings'),
      contexts: ALL_CTX
    });

    browser.contextMenus.create({
      id: 'duckai-bmac',
      title: '☕ ' + (browser.i18n.getMessage('contextMenuBmac') || 'Buy Me a Coffee'),
      contexts: ALL_CTX
    });
  } catch (e) {
    console.error('Duck.ai: context menu build failed', e);
  }
}

export function resolveMenuItem(menuItemId) {
  if (menuItemId.startsWith('translate-')) {
    if (menuItemId === 'translate-choose' || menuItemId === 'translate-sep') {
      return { actionId: 'translate', input: null, choose: true };
    }
    const langCode = menuItemId.replace('translate-', '');
    return { actionId: 'translate', input: languageLabel(langCode) };
  }
  if (menuItemId.startsWith('action-')) {
    const actionId = menuItemId.replace('action-', '');
    if (getAction(actionId)) return { actionId };
  }
  // User custom prompts: user-<id>
  if (menuItemId.startsWith('user-')) {
    return { actionId: menuItemId };
  }
  return null;
}

function languageLabel(code) {
  const lang = TRANSLATE_LANGUAGES.find((l) => l.code === code);
  if (!lang) return code;
  return browser.i18n.getMessage(lang.labelKey) || lang.defaultLabel;
}
