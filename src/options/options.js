/**
 * Options page controller
 */

import { getSettings, setSettings, resetSettings } from '../services/settings.js';
import { testConnection } from '../services/duckai/duckai-client.js';
import { ACTIONS, CATEGORIES, TRANSLATE_LANGUAGES } from '../prompts/actions.js';
import { clearAll } from '../services/storage.js';
import { clearAllConversations } from '../services/history.js';
import { getCustomPrompts, setCustomPrompt, resetCustomPrompt, resetAllCustomPrompts } from '../services/custom-prompts.js';
import { getUserPrompts, addUserPrompt, updateUserPrompt, deleteUserPrompt } from '../services/user-prompts.js';
import { exportToFile, importFromFile } from '../services/import-export.js';
import { applyTheme } from '../utils/theme.js';
import { applyDocumentDirection, t } from '../utils/i18n.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  applyDocumentDirection();
  localizePage();
  await applyTheme(document.documentElement);
  await loadSettings();
  populateDefaultActionSelect();
  populateDefaultLanguageSelect();
  populatePromptCategoryFilter();
  await renderCustomPrompts();
  await renderUserPrompts();
  wireMyPrompts();
  wireEvents();
  wireTabs();
}

function localizePage() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (el.children.length === 0) {
      el.textContent = t(key);
    } else {
      const firstChild = el.firstChild;
      if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
        firstChild.nodeValue = t(key) + ' ';
      }
    }
  });
}

async function loadSettings() {
  const s = await getSettings();
  document.getElementById('floatingButton').checked = s.floatingButton;
  document.getElementById('contextMenu').checked = s.contextMenu;
  document.getElementById('defaultAction').value = s.defaultActionId;
  document.getElementById('defaultLanguage').value = s.defaultLanguage;
  document.querySelector(`input[name="theme"][value="${s.theme}"]`).checked = true;
  const displayRadio = document.querySelector(`input[name="displayMode"][value="${s.displayMode || 'sidebar'}"]`);
  if (displayRadio) displayRadio.checked = true;
  document.getElementById('autoSubmit').checked = s.autoSubmit !== false;
  document.getElementById('responseLanguage').value = s.responseLanguage || 'auto';
  document.getElementById('textDirection').value = s.textDirection || 'auto';
  document.getElementById('smartDetection').checked = s.smartDetection === true;
  document.getElementById('historyEnabled').checked = s.historyEnabled;
  document.getElementById('historyMaxItems').value = s.historyMaxItems;
}

function populateDefaultActionSelect() {
  const sel = document.getElementById('defaultAction');
  sel.innerHTML = '';
  for (const cat of CATEGORIES) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = `${cat.icon} ${t(cat.labelKey) || cat.defaultLabel}`;
    if (cat.id === 'translate') {
      const opt = document.createElement('option');
      opt.value = 'translate';
      opt.textContent = t('actionTranslate') || 'Translate';
      optgroup.appendChild(opt);
    } else {
      for (const action of ACTIONS.filter((a) => a.category === cat.id)) {
        const opt = document.createElement('option');
        opt.value = action.id;
        opt.textContent = t(action.labelKey) || action.defaultLabel;
        optgroup.appendChild(opt);
      }
    }
    sel.appendChild(optgroup);
  }
}

function populateDefaultLanguageSelect() {
  const sel = document.getElementById('defaultLanguage');
  sel.innerHTML = '';
  for (const lang of TRANSLATE_LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = `${lang.flag} ${t(lang.labelKey) || lang.defaultLabel}`;
    sel.appendChild(opt);
  }
}

function wireTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${target}`);
      });
    });
  });
}

function wireEvents() {
  const status = document.getElementById('status');
  const showStatus = (msg, kind) => {
    status.textContent = msg;
    status.className = 'status ' + (kind || '');
    setTimeout(() => { status.textContent = ''; status.className = 'status'; }, 3000);
  };

  const save = async (patch) => {
    await setSettings(patch);
    showStatus(t('statusSaved') || 'Saved', 'success');
  };

  document.getElementById('floatingButton').addEventListener('change', (e) => save({ floatingButton: e.target.checked }));
  document.getElementById('contextMenu').addEventListener('change', (e) => save({ contextMenu: e.target.checked }));
  document.getElementById('defaultAction').addEventListener('change', (e) => save({ defaultActionId: e.target.value }));
  document.getElementById('defaultLanguage').addEventListener('change', (e) => save({ defaultLanguage: e.target.value }));
  document.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener('change', async (e) => {
    await save({ theme: e.target.value });
    await applyTheme(document.documentElement);
  }));
  document.querySelectorAll('input[name="displayMode"]').forEach((r) => r.addEventListener('change', (e) => save({ displayMode: e.target.value })));
  document.getElementById('autoSubmit').addEventListener('change', (e) => save({ autoSubmit: e.target.checked }));
  document.getElementById('responseLanguage').addEventListener('change', (e) => save({ responseLanguage: e.target.value }));
  document.getElementById('textDirection').addEventListener('change', (e) => save({ textDirection: e.target.value }));
  document.getElementById('smartDetection').addEventListener('change', (e) => save({ smartDetection: e.target.checked }));
  document.getElementById('historyEnabled').addEventListener('change', (e) => save({ historyEnabled: e.target.checked }));
  document.getElementById('historyMaxItems').addEventListener('change', (e) => save({ historyMaxItems: Math.max(5, parseInt(e.target.value, 10)) }));

  document.getElementById('testConnection').addEventListener('click', async () => {
    const result = document.getElementById('testResult');
    const btn = document.getElementById('testConnection');
    result.textContent = '...';
    result.style.color = '';
    btn.disabled = true;
    try {
      const r = await testConnection();
      result.textContent = r.ok ? (t('testOk') || 'OK') : (t('testFail') || 'Failed');
      result.style.color = r.ok ? 'var(--accent)' : 'var(--danger)';
    } catch (err) {
      result.textContent = t('testFail') || 'Failed';
      result.style.color = 'var(--danger)';
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('clearHistory').addEventListener('click', async () => {
    if (!confirm(t('confirmClearHistory') || 'Clear all conversation history?')) return;
    await clearAllConversations();
    showStatus(t('statusHistoryCleared') || 'History cleared', 'success');
  });

  document.getElementById('clearAll').addEventListener('click', async () => {
    if (!confirm(t('confirmClearAll') || 'Remove ALL extension data? This cannot be undone.')) return;
    await clearAll();
    showStatus(t('statusAllCleared') || 'All data cleared', 'success');
    setTimeout(() => location.reload(), 800);
  });

  // Export / Import
  document.getElementById('export-data').addEventListener('click', async () => {
    try {
      await exportToFile();
      showStatus(t('statusExported') || 'Export started', 'success');
    } catch (err) {
      showStatus(t('statusExportFailed') || 'Export failed: ' + err.message, 'error');
    }
  });

  document.getElementById('import-merge').addEventListener('click', async () => {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    if (!file) { showStatus(t('statusNoFile') || 'Please choose a file', 'error'); return; }
    try {
      await importFromFile(file, true);
      showStatus(t('statusImported') || 'Imported (merged)', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      showStatus(t('statusImportFailed') || 'Import failed: ' + err.message, 'error');
    }
  });

  document.getElementById('import-replace').addEventListener('click', async () => {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    if (!file) { showStatus(t('statusNoFile') || 'Please choose a file', 'error'); return; }
    if (!confirm(t('confirmImportReplace') || 'This will REPLACE all existing data. Continue?')) return;
    try {
      await importFromFile(file, false);
      showStatus(t('statusImported') || 'Imported (replaced)', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      showStatus(t('statusImportFailed') || 'Import failed: ' + err.message, 'error');
    }
  });

  document.getElementById('reset').addEventListener('click', async () => {
    if (!confirm(t('confirmReset') || 'Reset settings to defaults?')) return;
    await resetSettings();
    await loadSettings();
    showStatus(t('statusReset') || 'Reset complete', 'success');
  });

  // Support tab
  const openSupportBtn = document.getElementById('open-support-page');
  if (openSupportBtn) {
    openSupportBtn.addEventListener('click', () => {
      browser.tabs.create({ url: browser.runtime.getURL('src/support/support.html') });
    });
  }

  // Custom Prompts tab
  document.getElementById('prompt-category-filter').addEventListener('change', () => renderCustomPrompts());
  document.getElementById('reset-all-prompts').addEventListener('click', async () => {
    if (!confirm(t('confirmResetAllPrompts') || 'Reset ALL custom prompts to defaults?')) return;
    await resetAllCustomPrompts();
    await renderCustomPrompts();
    showStatus(t('statusPromptsReset') || 'All prompts reset', 'success');
  });
}

// ---- Custom Prompts ----

function populatePromptCategoryFilter() {
  const sel = document.getElementById('prompt-category-filter');
  // Keep the "All" option, add categories.
  for (const cat of CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${t(cat.labelKey) || cat.defaultLabel}`;
    sel.appendChild(opt);
  }
}

async function renderCustomPrompts() {
  const list = document.getElementById('prompts-list');
  const filter = document.getElementById('prompt-category-filter').value;
  const customPrompts = await getCustomPrompts();
  while (list.firstChild) list.removeChild(list.firstChild);

  const filtered = filter === 'all' ? ACTIONS : ACTIONS.filter((a) => a.category === filter);
  for (const action of filtered) {
    const cat = CATEGORIES.find((c) => c.id === action.category);
    const card = document.createElement('div');
    card.className = 'prompt-card';

    const isCustom = !!customPrompts[action.id];

    // Build card using DOM API.
    const header = document.createElement('div');
    header.className = 'prompt-card-header';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'prompt-card-title';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = t(action.labelKey) || action.defaultLabel;
    titleDiv.appendChild(titleSpan);
    if (isCustom) {
      const badge = document.createElement('span');
      badge.className = 'prompt-card-custom-badge';
      badge.textContent = 'Custom';
      titleDiv.appendChild(badge);
    }
    const catSpan = document.createElement('span');
    catSpan.className = 'prompt-card-category';
    catSpan.textContent = `${cat.icon} ${t(cat.labelKey) || cat.defaultLabel}`;
    header.appendChild(titleDiv);
    header.appendChild(catSpan);
    card.appendChild(header);

    const textarea = document.createElement('textarea');
    textarea.dataset.actionId = action.id;
    textarea.setAttribute('placeholder', action.instruction);
    textarea.setAttribute('rows', '3');
    textarea.value = customPrompts[action.id] || '';
    card.appendChild(textarea);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'prompt-card-actions';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary';
    resetBtn.dataset.reset = action.id;
    resetBtn.textContent = t('customPromptsReset') || 'Reset';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.dataset.save = action.id;
    saveBtn.textContent = t('customPromptsSave') || 'Save';
    actionsDiv.appendChild(resetBtn);
    actionsDiv.appendChild(saveBtn);
    card.appendChild(actionsDiv);

    saveBtn.addEventListener('click', async () => {
      const val = textarea.value.trim();
      await setCustomPrompt(action.id, val);
      showStatus(t('statusPromptSaved') || 'Prompt saved', 'success');
      await renderCustomPrompts();
    });

    resetBtn.addEventListener('click', async () => {
      await resetCustomPrompt(action.id);
      textarea.value = '';
      showStatus(t('statusPromptReset') || 'Prompt reset to default', 'success');
      await renderCustomPrompts();
    });

    list.appendChild(card);
  }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---- My Prompts (user custom prompts) ----

function wireMyPrompts() {
  const addBtn = document.getElementById('add-prompt-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const labelEl = document.getElementById('new-prompt-label');
      const instrEl = document.getElementById('new-prompt-instruction');
      const label = labelEl.value.trim();
      const instruction = instrEl.value.trim();
      if (!label || !instruction) {
        showStatus(t('myPromptsError') || 'Please enter both name and instruction', 'error');
        return;
      }
      await addUserPrompt(label, instruction);
      labelEl.value = '';
      instrEl.value = '';
      showStatus(t('myPromptsAdded') || 'Prompt added', 'success');
      await renderUserPrompts();
    });
  }
}

async function renderUserPrompts() {
  const list = document.getElementById('user-prompts-list');
  if (!list) return;
  const prompts = await getUserPrompts();
  while (list.firstChild) list.removeChild(list.firstChild);

  if (prompts.length === 0) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.style.cssText = 'text-align:center;padding:24px;color:var(--muted)';
    div.textContent = t('myPromptsEmpty') || 'No custom prompts yet. Add one above.';
    list.appendChild(div);
    return;
  }

  for (const p of prompts) {
    const card = document.createElement('div');
    card.className = 'prompt-card';

    // Build header using DOM API.
    const header = document.createElement('div');
    header.className = 'prompt-card-header';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'prompt-card-title';
    const labelInput = document.createElement('span');
    labelInput.textContent = p.label;
    labelInput.style.cursor = 'text';
    const badge = document.createElement('span');
    badge.className = 'prompt-card-custom-badge';
    badge.textContent = 'Custom';
    titleDiv.appendChild(labelInput);
    titleDiv.appendChild(badge);
    header.appendChild(titleDiv);
    card.appendChild(header);

    // Textarea for instruction.
    const ta = document.createElement('textarea');
    ta.dataset.id = p.id;
    ta.setAttribute('rows', '2');
    ta.style.cssText = 'width:100%;font:inherit;font-size:12px;padding:8px 10px;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:6px;resize:vertical;min-height:40px;font-family:"SFMono-Regular",Menlo,Consolas,monospace';
    ta.value = p.instruction;
    card.appendChild(ta);

    // Action buttons.
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'prompt-card-actions';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.dataset.delete = p.id;
    deleteBtn.textContent = t('myPromptsDelete') || 'Delete';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.dataset.save = p.id;
    saveBtn.textContent = t('myPromptsSave') || 'Save';
    actionsDiv.appendChild(deleteBtn);
    actionsDiv.appendChild(saveBtn);
    card.appendChild(actionsDiv);

    // Make label editable on click.
    labelInput.addEventListener('click', () => {
      const newLabel = prompt(t('myPromptsEditLabel') || 'Prompt name:', p.label);
      if (newLabel && newLabel.trim()) {
        labelInput.textContent = newLabel.trim();
        updateUserPrompt(p.id, newLabel.trim(), ta.value);
      }
    });

    saveBtn.addEventListener('click', async () => {
      await updateUserPrompt(p.id, labelInput.textContent, ta.value);
      showStatus(t('myPromptsSaved') || 'Prompt saved', 'success');
    });

    deleteBtn.addEventListener('click', async () => {
      if (confirm(t('myPromptsConfirmDelete') || 'Delete this prompt?')) {
        await deleteUserPrompt(p.id);
        await renderUserPrompts();
        showStatus(t('myPromptsDeleted') || 'Prompt deleted', 'success');
      }
    });

    list.appendChild(card);
  }
}
