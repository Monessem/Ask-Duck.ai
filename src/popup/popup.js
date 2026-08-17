/**
 * Popup controller (v4.15 — AMO compliant, no innerHTML with dynamic values)
 * - Quick Actions toolbar (recent actions)
 * - Page-level action (summarize page)
 * - Searchable history
 */

import { CATEGORIES, getActionsByCategory, TRANSLATE_LANGUAGES, getAction, ACTIONS } from '../prompts/actions.js';
import { getSettings } from '../services/settings.js';
import { getUserPrompts } from '../services/user-prompts.js';
import { applyTheme } from '../utils/theme.js';
import { applyDocumentDirection, t } from '../utils/i18n.js';
import { truncate } from '../utils/helpers.js';
import { MSG } from '../background/messaging.js';
import { getAllConversations, clearAllConversations } from '../services/history.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  applyDocumentDirection();
  localizePage();
  await applyTheme(document.documentElement);
  renderVersion();
  await renderSelectionBanner();
  await renderQuickActions();
  renderCategories();
  renderPageActions();
  wireStaticButtons();
}

function localizePage() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
}

function renderVersion() {
  document.getElementById('version').textContent = `v${browser.runtime.getManifest().version}`;
}

async function renderSelectionBanner() {
  const banner = document.getElementById('selection-banner');
  const preview = document.getElementById('selection-preview');
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs.length) return;
    const tab = tabs[0];
    if (!tab.url || !tab.url.startsWith('http')) return;
    let selection = '';
    try {
      const resp = await browser.tabs.sendMessage(tab.id, { type: MSG.GET_SELECTION });
      selection = (resp && resp.selection) || '';
    } catch {}
    if (selection) {
      preview.textContent = truncate(selection, 200);
      banner.hidden = false;
    }
  } catch {}
}

// ---- Quick Actions (recent) ----
async function renderQuickActions() {
  const container = document.getElementById('quick-actions-bar');
  if (!container) return;
  while (container.firstChild) container.removeChild(container.firstChild);
  try {
    const resp = await browser.runtime.sendMessage({ type: MSG.GET_RECENT_ACTIONS });
    const recentIds = (resp && resp.ok && resp.result && resp.result.actions) || [];
    if (!recentIds.length) {
      container.hidden = true;
      return;
    }
    container.hidden = false;
    const label = document.createElement('span');
    label.className = 'quick-label';
    label.textContent = '⚡';
    container.appendChild(label);
    recentIds.slice(0, 5).forEach((id) => {
      const action = getAction(id);
      if (!action) return;
      const btn = document.createElement('button');
      btn.className = 'quick-btn';
      btn.title = action.defaultLabel;
      btn.textContent = action.defaultLabel.slice(0, 20);
      btn.addEventListener('click', () => invokeAction(id));
      container.appendChild(btn);
    });
  } catch {
    container.hidden = true;
  }
}

// ---- Page-level actions ----
function renderPageActions() {
  const container = document.getElementById('page-actions');
  if (!container) return;
  const summarizeBtn = document.getElementById('page-summarize');
  if (summarizeBtn) {
    summarizeBtn.addEventListener('click', async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || !tabs.length) return;
        const tab = tabs[0];
        let pageMeta = { title: tab.title || '', url: tab.url || '', description: '' };
        try {
          const resp = await browser.tabs.sendMessage(tab.id, { type: 'get-page-meta' });
          if (resp && resp.title) pageMeta = resp;
        } catch {}
        await browser.runtime.sendMessage({
          type: MSG.PAGE_ACTION,
          payload: {
            actionId: 'summary.one',
            pageTitle: pageMeta.title,
            pageUrl: pageMeta.url,
            pageDescription: pageMeta.description
          }
        });
        window.close();
      } catch (err) {
        console.warn('page summarize failed', err);
      }
    });
  }
  const tldrBtn = document.getElementById('page-tldr');
  if (tldrBtn) {
    tldrBtn.addEventListener('click', async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tabs || !tabs.length) return;
        const tab = tabs[0];
        let pageMeta = { title: tab.title || '', url: tab.url || '', description: '' };
        try {
          const resp = await browser.tabs.sendMessage(tab.id, { type: 'get-page-meta' });
          if (resp && resp.title) pageMeta = resp;
        } catch {}
        await browser.runtime.sendMessage({
          type: MSG.PAGE_ACTION,
          payload: {
            actionId: 'common.tldr',
            pageTitle: pageMeta.title,
            pageUrl: pageMeta.url,
            pageDescription: pageMeta.description
          }
        });
        window.close();
      } catch (err) {
        console.warn('page tldr failed', err);
      }
    });
  }
}

function renderCategories() {
  const nav = document.querySelector('.categories');
  while (nav.firstChild) nav.removeChild(nav.firstChild);
  for (const cat of CATEGORIES) {
    const btn = document.createElement('button');
    btn.className = 'category-card';
    btn.type = 'button';
    btn.dataset.category = cat.id;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'cat-icon';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = cat.icon;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'cat-name';
    nameSpan.textContent = t(cat.labelKey) || cat.defaultLabel;
    btn.appendChild(iconSpan);
    btn.appendChild(nameSpan);
    btn.addEventListener('click', () => showActions(cat.id));
    nav.appendChild(btn);
  }
  // Add "My Prompts" category card.
  const myBtn = document.createElement('button');
  myBtn.className = 'category-card';
  myBtn.type = 'button';
  myBtn.dataset.category = 'myprompts';
  const myIcon = document.createElement('span');
  myIcon.className = 'cat-icon';
  myIcon.setAttribute('aria-hidden', 'true');
  myIcon.textContent = '⭐';
  const myName = document.createElement('span');
  myName.className = 'cat-name';
  myName.textContent = t('categoryMyPrompts') || 'My Prompts';
  myBtn.appendChild(myIcon);
  myBtn.appendChild(myName);
  myBtn.addEventListener('click', () => showActions('myprompts'));
  nav.appendChild(myBtn);
}

/**
 * Show user custom prompts in the actions list.
 */
async function showMyPrompts(list) {
  const prompts = await getUserPrompts();
  if (prompts.length === 0) {
    const li = document.createElement('li');
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.textContent = t('myPromptsEmptyMenu') || 'No custom prompts yet. Add them in Settings → My Prompts.';
    li.appendChild(div);
    list.appendChild(li);
    return;
  }
  for (const p of prompts) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'action-item';
    const span = document.createElement('span');
    span.textContent = `⭐ ${p.label}`;
    const arrow = document.createElement('span');
    arrow.className = 'action-arrow';
    arrow.textContent = '\u203a';
    btn.appendChild(span);
    btn.appendChild(arrow);
    btn.addEventListener('click', () => invokeAction(p.id));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function showActions(categoryId) {
  document.querySelector('.categories').hidden = true;
  document.getElementById('quick-actions-bar').hidden = true;
  document.getElementById('page-actions').hidden = true;
  document.getElementById('quick-actions').hidden = true;
  const actionsContainer = document.getElementById('actions-container');
  actionsContainer.hidden = false;
  const list = document.getElementById('actions-list');
  while (list.firstChild) list.removeChild(list.firstChild);

  // Handle "My Prompts" category (user custom prompts).
  if (categoryId === 'myprompts') {
    document.getElementById('actions-title').textContent = `⭐ ${t('categoryMyPrompts') || 'My Prompts'}`;
    showMyPrompts(list);
    return;
  }

  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return;
  document.getElementById('actions-title').textContent = `${cat.icon} ${t(cat.labelKey) || cat.defaultLabel}`;

  if (categoryId === 'translate') {
    for (const lang of TRANSLATE_LANGUAGES) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'action-item';
      const span = document.createElement('span');
      span.textContent = `${lang.flag} ${t(lang.labelKey) || lang.defaultLabel}`;
      const arrow = document.createElement('span');
      arrow.className = 'action-arrow';
      arrow.textContent = '\u203a';
      btn.appendChild(span);
      btn.appendChild(arrow);
      btn.addEventListener('click', () => invokeAction('translate', t(lang.labelKey) || lang.defaultLabel));
      li.appendChild(btn);
      list.appendChild(li);
    }
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'action-item';
    const span = document.createElement('span');
    span.textContent = t('actionTranslateChoose') || 'Choose language...';
    const arrow = document.createElement('span');
    arrow.className = 'action-arrow';
    arrow.textContent = '\u203a';
    btn.appendChild(span);
    btn.appendChild(arrow);
    btn.addEventListener('click', () => invokeAction('translate', null, true));
    li.appendChild(btn);
    list.appendChild(li);
    return;
  }

  const actions = getActionsByCategory(categoryId);
  for (const action of actions) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'action-item';
    const span = document.createElement('span');
    span.textContent = t(action.labelKey) || action.defaultLabel;
    const arrow = document.createElement('span');
    arrow.className = 'action-arrow';
    arrow.textContent = '\u203a';
    btn.appendChild(span);
    btn.appendChild(arrow);
    if (action.needsInput) {
      btn.addEventListener('click', () => {
        const input = prompt(action.id === 'code.convert'
          ? 'Target language (e.g. Python, Rust, Go):'
          : 'Target value:', action.inputDefault || '');
        if (input) invokeAction(action.id, input.trim());
      });
    } else {
      btn.addEventListener('click', () => invokeAction(action.id));
    }
    li.appendChild(btn);
    list.appendChild(li);
  }
}

document.getElementById('back-btn').addEventListener('click', () => {
  document.getElementById('actions-container').hidden = true;
  document.querySelector('.categories').hidden = false;
  document.getElementById('quick-actions-bar').hidden = false;
  document.getElementById('page-actions').hidden = false;
  document.getElementById('quick-actions').hidden = false;
});

function wireStaticButtons() {
  document.getElementById('open-settings').addEventListener('click', () => {
    browser.runtime.openOptionsPage(); window.close();
  });
  document.getElementById('ask-default').addEventListener('click', async () => {
    const settings = await getSettings();
    invokeAction(settings.defaultActionId);
  });
  document.getElementById('open-history').addEventListener('click', showHistory);
  document.getElementById('open-shortcuts').addEventListener('click', () => {
    browser.runtime.openOptionsPage(); window.close();
  });
  document.getElementById('open-duckai').addEventListener('click', () => {
    browser.tabs.create({ url: 'https://duck.ai/' }); window.close();
  });
  document.getElementById('open-support').addEventListener('click', () => {
    browser.tabs.create({ url: browser.runtime.getURL('src/support/support.html') }); window.close();
  });
  document.getElementById('open-bmac').addEventListener('click', () => {
    browser.tabs.create({ url: 'https://buymeacoffee.com/monessem' }); window.close();
  });
  document.getElementById('open-about').addEventListener('click', (e) => {
    e.preventDefault(); browser.runtime.openOptionsPage(); window.close();
  });
}

async function invokeAction(actionId, input = null, chooseLanguage = false) {
  if (chooseLanguage) {
    const lang = prompt(t('actionTranslateChoose') || 'Enter target language:', 'Swedish');
    if (!lang) return;
    input = lang.trim();
  }
  try {
    browser.runtime.sendMessage({
      type: MSG.ACTION_FROM_POPUP,
      payload: { actionId, input }
    }).catch(() => {});
    window.close();
  } catch (err) {
    console.warn('invokeAction failed', err);
    window.close();
  }
}

async function showHistory() {
  const settings = await getSettings();
  if (!settings.historyEnabled) {
    renderEmpty(t('historyDisabled') || 'History is disabled. Enable it in Settings.');
    return;
  }
  const all = await getAllConversations();
  if (!all.length) {
    renderEmpty(t('historyEmpty') || 'No conversations yet.');
    return;
  }
  document.querySelector('.categories').hidden = true;
  document.getElementById('quick-actions-bar').hidden = true;
  document.getElementById('page-actions').hidden = true;
  document.getElementById('quick-actions').hidden = true;
  const actionsContainer = document.getElementById('actions-container');
  actionsContainer.hidden = false;
  document.getElementById('actions-title').textContent = t('popupHistory') || 'Conversation history';

  const list = document.getElementById('actions-list');
  while (list.firstChild) list.removeChild(list.firstChild);

  const searchWrap = document.createElement('li');
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search history...';
  searchInput.style.cssText = 'width:100%;padding:6px 8px;font:inherit;font-size:12px;border:1px solid var(--border);border-radius:6px;margin-bottom:6px';
  searchWrap.appendChild(searchInput);
  list.appendChild(searchWrap);

  const clearLi = document.createElement('li');
  const clearBtn = document.createElement('button');
  clearBtn.className = 'action-item';
  const clearSpan = document.createElement('span');
  clearSpan.style.color = 'var(--error-fg)';
  clearSpan.textContent = t('historyClear') || 'Clear all history';
  clearBtn.appendChild(clearSpan);
  clearBtn.addEventListener('click', async () => { await clearAllConversations(); showHistory(); });
  clearLi.appendChild(clearBtn);
  list.appendChild(clearLi);

  const renderFiltered = (query) => {
    while (list.children.length > 2) list.removeChild(list.lastChild);
    const filtered = all.filter((c) => !query || c.title.toLowerCase().includes(query.toLowerCase()));
    for (const conv of filtered) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'action-item';
      btn.style.flexDirection = 'column';
      btn.style.alignItems = 'flex-start';
      const titleSpan = document.createElement('span');
      titleSpan.style.fontWeight = '500';
      titleSpan.textContent = conv.title;
      const metaSpan = document.createElement('span');
      metaSpan.style.fontSize = '11px';
      metaSpan.style.color = 'var(--muted)';
      metaSpan.textContent = `${new Date(conv.updatedAt).toLocaleString()} · ${conv.turns.length} turns`;
      btn.appendChild(titleSpan);
      btn.appendChild(metaSpan);
      btn.addEventListener('click', () => { browser.tabs.create({ url: 'https://duck.ai/' }); window.close(); });
      li.appendChild(btn);
      list.appendChild(li);
    }
  };
  renderFiltered('');
  searchInput.addEventListener('input', () => renderFiltered(searchInput.value));
  setTimeout(() => searchInput.focus(), 50);
}

function renderEmpty(message) {
  document.querySelector('.categories').hidden = true;
  document.getElementById('quick-actions-bar').hidden = true;
  document.getElementById('page-actions').hidden = true;
  document.getElementById('quick-actions').hidden = true;
  const actionsContainer = document.getElementById('actions-container');
  actionsContainer.hidden = false;
  document.getElementById('actions-title').textContent = t('popupHistory') || 'Conversation history';
  const list = document.getElementById('actions-list');
  while (list.firstChild) list.removeChild(list.firstChild);
  const li = document.createElement('li');
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.textContent = message;
  li.appendChild(div);
  list.appendChild(li);
}

function escapeText(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
