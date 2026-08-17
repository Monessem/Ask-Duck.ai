/**
 * Action menu — a compact floating panel that appears near the
 * selection when the user clicks the floating Duck.ai button.
 *
 * Shows categories + actions. When the user picks an action, sends
 * the selection + action to the background, which builds the prompt
 * and launches Duck.ai in a new tab.
 *
 * Injected as a Shadow DOM so page CSS cannot leak in.
 */

import { CATEGORIES, getActionsByCategory, TRANSLATE_LANGUAGES, getAction } from '../prompts/actions.js';
import { detectContentType } from '../utils/detect.js';
import { getSettings } from '../services/settings.js';
import { onSettingsChanged } from '../services/settings.js';
import { getUserPrompts } from '../services/user-prompts.js';
import { resolveTheme } from '../utils/theme.js';
import { t } from '../utils/i18n.js';
import { MSG } from '../background/messaging.js';

const MENU_HOST_ID = 'duckai-action-menu-host';

let root = null;
let host = null;
let currentSelection = '';

export function ensureMenu() {
  if (host) return;
  host = document.createElement('div');
  host.id = MENU_HOST_ID;
  host.style.all = 'initial';
  host.style.position = 'absolute';
  host.style.zIndex = '2147483647';
  host.style.top = '0';
  host.style.left = '0';
  host.style.display = 'none';
  host.style.pointerEvents = 'none';

  root = host.attachShadow({ mode: 'open' });
  // Build DOM using DOM API (AMO compliant — no innerHTML with dynamic values).
  buildMenuDOM(root);
  document.documentElement.appendChild(host);

  // Set the logo image source (header).
  const logoImg = root.querySelector('.logo-img');
  if (logoImg) {
    logoImg.src = browser.runtime.getURL('icons/icon-48.png');
  }
  // Set the logo image source (footer button).
  const footerLogoImg = root.querySelector('.footer-logo-img');
  if (footerLogoImg) {
    footerLogoImg.src = browser.runtime.getURL('icons/icon-48.png');
  }

  wireEvents();
  applyTheme();
  onSettingsChanged(() => applyTheme());
}

function buildTemplate() {
  return `
    <style>${menuCSS()}</style>
    <div class="menu" role="dialog" aria-label="Ask Duck.ai" hidden>
      <header class="menu-header">
        <div class="brand">
          <img class="logo-img" alt="" aria-hidden="true" />
          <span class="title">Ask Duck.ai</span>
        </div>
        <button class="icon-btn" data-action="close" title="Close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>

      <div class="selection-preview" hidden>
        <span class="selection-label"></span>
        <span class="selection-text"></span>
      </div>

      <div class="categories" role="tablist"></div>

      <div class="actions-container">
        <div class="custom-input-wrap" hidden>
          <input class="custom-input" type="text" placeholder="" aria-label="Custom input" />
          <button class="btn btn-primary custom-send" data-action="custom-send">Send</button>
        </div>
        <ul class="actions-list"></ul>
      </div>

      <footer class="menu-footer">
        <div class="footer-actions">
          <button class="footer-btn" data-action="open-duckai" title="Open Duck.ai">
            <img class="footer-logo-img" alt="" aria-hidden="true" /> Open in Duck.ai
          </button>
          <button class="bmac-btn" data-action="bmac" title="Buy Me a Coffee">
            ☕ Buy Me a Coffee
          </button>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Build the menu DOM using DOM API (AMO compliant).
 * Creates the same structure as buildTemplate() but without innerHTML.
 */
function buildMenuDOM(root) {
  // Style element.
  const style = document.createElement('style');
  style.textContent = menuCSS();
  root.appendChild(style);

  // Main menu container.
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Ask Duck.ai');
  menu.hidden = true;

  // Header.
  const header = document.createElement('header');
  header.className = 'menu-header';
  const brand = document.createElement('div');
  brand.className = 'brand';
  const logoImg = document.createElement('img');
  logoImg.className = 'logo-img';
  logoImg.setAttribute('alt', '');
  logoImg.setAttribute('aria-hidden', 'true');
  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = 'Ask Duck.ai';
  brand.appendChild(logoImg);
  brand.appendChild(title);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-btn';
  closeBtn.dataset.action = 'close';
  closeBtn.title = 'Close';
  closeBtn.setAttribute('aria-label', 'Close');
  const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  closeSvg.setAttribute('viewBox', '0 0 24 24');
  closeSvg.setAttribute('width', '16');
  closeSvg.setAttribute('height', '16');
  closeSvg.setAttribute('fill', 'none');
  closeSvg.setAttribute('stroke', 'currentColor');
  closeSvg.setAttribute('stroke-width', '2');
  const closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  closePath.setAttribute('d', 'M6 6l12 12M18 6L6 18');
  closeSvg.appendChild(closePath);
  closeBtn.appendChild(closeSvg);
  header.appendChild(brand);
  header.appendChild(closeBtn);
  menu.appendChild(header);

  // Selection preview.
  const preview = document.createElement('div');
  preview.className = 'selection-preview';
  preview.hidden = true;
  const previewLabel = document.createElement('span');
  previewLabel.className = 'selection-label';
  const previewText = document.createElement('span');
  previewText.className = 'selection-text';
  preview.appendChild(previewLabel);
  preview.appendChild(previewText);
  menu.appendChild(preview);

  // Categories container.
  const categories = document.createElement('div');
  categories.className = 'categories';
  categories.setAttribute('role', 'tablist');
  menu.appendChild(categories);

  // Actions container.
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'actions-container';
  const customInputWrap = document.createElement('div');
  customInputWrap.className = 'custom-input-wrap';
  customInputWrap.hidden = true;
  const customInput = document.createElement('input');
  customInput.className = 'custom-input';
  customInput.type = 'text';
  customInput.setAttribute('placeholder', '');
  customInput.setAttribute('aria-label', 'Custom input');
  const customSend = document.createElement('button');
  customSend.className = 'btn btn-primary custom-send';
  customSend.dataset.action = 'custom-send';
  customSend.textContent = 'Send';
  customInputWrap.appendChild(customInput);
  customInputWrap.appendChild(customSend);
  const actionsList = document.createElement('ul');
  actionsList.className = 'actions-list';
  actionsContainer.appendChild(customInputWrap);
  actionsContainer.appendChild(actionsList);
  menu.appendChild(actionsContainer);

  // Footer.
  const footer = document.createElement('footer');
  footer.className = 'menu-footer';
  const footerActions = document.createElement('div');
  footerActions.className = 'footer-actions';
  const openDuckAiBtn = document.createElement('button');
  openDuckAiBtn.className = 'footer-btn';
  openDuckAiBtn.dataset.action = 'open-duckai';
  openDuckAiBtn.title = 'Open Duck.ai';
  const footerLogoImg = document.createElement('img');
  footerLogoImg.className = 'footer-logo-img';
  footerLogoImg.setAttribute('alt', '');
  footerLogoImg.setAttribute('aria-hidden', 'true');
  openDuckAiBtn.appendChild(footerLogoImg);
  openDuckAiBtn.appendChild(document.createTextNode(' Open in Duck.ai'));
  const bmacBtn = document.createElement('button');
  bmacBtn.className = 'bmac-btn';
  bmacBtn.dataset.action = 'bmac';
  bmacBtn.title = 'Buy Me a Coffee';
  bmacBtn.textContent = '☕ Buy Me a Coffee';
  footerActions.appendChild(openDuckAiBtn);
  footerActions.appendChild(bmacBtn);
  footer.appendChild(footerActions);
  menu.appendChild(footer);

  root.appendChild(menu);
}

function menuCSS() {
  return `
    :host { all: initial; direction: ltr; }
    .menu { direction: ltr; }
    * { box-sizing: border-box; }
    .menu {
      pointer-events: auto;
      width: 360px;
      max-width: 92vw;
      max-height: 600px;
      background: var(--duckai-bg, #ffffff);
      color: var(--duckai-fg, #1f2937);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.08);
      border: 1px solid var(--duckai-border, #e5e7eb);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.95);
      opacity: 0;
      transition: transform 120ms ease, opacity 120ms ease;
    }
    .menu.open { transform: scale(1); opacity: 1; }
    .menu[hidden] { display: none; }

    .menu-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid var(--duckai-border, #e5e7eb);
      flex-shrink: 0;
    }
    .brand { display: flex; align-items: center; gap: 8px; }
    .logo-img {
      width: 24px; height: 24px;
      border-radius: 6px;
      flex-shrink: 0;
      object-fit: contain;
    }
    .title { font-weight: 600; font-size: 13px; }
    .icon-btn {
      background: transparent; color: inherit;
      border: none; padding: 4px; border-radius: 6px;
      cursor: pointer; line-height: 0;
    }
    .icon-btn:hover { background: var(--duckai-hover, #f3f4f6); }
    .icon-btn:focus-visible { outline: 2px solid var(--duckai-accent, #1f2937); outline-offset: 1px; }

    .selection-preview {
      padding: 8px 12px;
      background: var(--duckai-hover, #f9fafb);
      border-bottom: 1px solid var(--duckai-border, #e5e7eb);
      font-size: 11px;
    }
    .selection-label { color: var(--duckai-muted, #6b7280); display: block; margin-bottom: 2px; }
    .selection-text {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      word-break: break-word;
    }

    .categories {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 8px 10px;
      border-bottom: 1px solid var(--duckai-border, #e5e7eb);
      flex-shrink: 0;
    }
    .cat-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid var(--duckai-border, #d1d5db);
      background: transparent;
      color: var(--duckai-fg, #1f2937);
      cursor: pointer;
      font: inherit; font-size: 11px;
      white-space: nowrap;
    }
    .cat-pill:hover { background: var(--duckai-hover, #f3f4f6); }
    .cat-pill.active {
      background: var(--duckai-accent, #1f2937);
      color: #fff;
      border-color: var(--duckai-accent, #1f2937);
    }
    .cat-pill:focus-visible { outline: 2px solid var(--duckai-accent, #1f2937); outline-offset: 1px; }
    .cat-icon { font-size: 13px; line-height: 1; }

    .actions-container {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 6px 8px;
    }

    .custom-input-wrap {
      display: flex; gap: 6px;
      padding: 6px 4px 8px;
    }
    .custom-input-wrap[hidden] { display: none; }
    .custom-input {
      flex: 1;
      font: inherit; font-size: 12px;
      padding: 6px 8px;
      background: var(--duckai-input-bg, #ffffff);
      color: var(--duckai-fg, #1f2937);
      border: 1px solid var(--duckai-border, #d1d5db);
      border-radius: 6px;
    }
    .custom-input:focus { outline: 2px solid var(--duckai-accent, #1f2937); outline-offset: -1px; }

    .actions-list {
      list-style: none; margin: 0; padding: 0;
      display: flex; flex-direction: column; gap: 1px;
    }
    .action-item {
      display: flex; align-items: center; gap: 6px;
      width: 100%;
      text-align: start;
      background: transparent; color: inherit;
      border: none;
      padding: 7px 10px;
      border-radius: 6px;
      cursor: pointer;
      font: inherit; font-size: 12.5px;
    }
    .action-item:hover { background: var(--duckai-hover, #f3f4f6); }
    .action-item:focus-visible { outline: 2px solid var(--duckai-accent, #1f2937); outline-offset: 1px; }
    .action-item .arrow { margin-inline-start: auto; color: var(--duckai-muted, #9ca3af); font-size: 14px; }

    .menu-footer {
      flex-shrink: 0;
      padding: 6px 12px;
      border-top: 1px solid var(--duckai-border, #e5e7eb);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .footer-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .footer-btn {
      font: inherit; font-size: 10px; font-weight: 500;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--duckai-border, #d1d5db);
      background: var(--duckai-btn-bg, #ffffff);
      color: var(--duckai-fg, #1f2937);
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .footer-btn:hover { background: var(--duckai-hover, #f3f4f6); }
    .footer-logo-img {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      object-fit: contain;
    }
    .bmac-btn {
      font: inherit; font-size: 10px; font-weight: 600;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid #ffcf00;
      background: #ffdd00;
      color: #1f2937;
      cursor: pointer;
      white-space: nowrap;
    }
    .bmac-btn:hover { background: #ffcf00; }

    .btn {
      font: inherit; font-size: 12px;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--duckai-border, #d1d5db);
      background: var(--duckai-btn-bg, #ffffff);
      color: var(--duckai-fg, #1f2937);
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-primary {
      background: var(--duckai-accent, #1f2937);
      color: #fff;
      border-color: var(--duckai-accent, #1f2937);
    }
    .btn-primary:hover { background: var(--duckai-accent-hover, #111827); }

    /* Dark theme */
    :host([data-theme="dark"]) {
      --duckai-bg: #0f172a;
      --duckai-fg: #e5e7eb;
      --duckai-muted: #9ca3af;
      --duckai-border: #1f2937;
      --duckai-hover: #1f2937;
      --duckai-input-bg: #1f2937;
      --duckai-accent: #3b82f6;
      --duckai-accent-hover: #2563eb;
      --duckai-btn-bg: #1f2937;
    }
    :host([data-theme="light"]) {
      --duckai-bg: #ffffff;
      --duckai-fg: #1f2937;
      --duckai-muted: #6b7280;
      --duckai-border: #e5e7eb;
      --duckai-hover: #f3f4f6;
      --duckai-input-bg: #ffffff;
      --duckai-accent: #1f2937;
      --duckai-accent-hover: #111827;
      --duckai-btn-bg: #ffffff;
    }

    @media (prefers-reduced-motion: reduce) {
      .menu { transition: none; }
    }
  `;
}

function wireEvents() {
  const menu = root.querySelector('.menu');
  const closeBtn = root.querySelector('[data-action="close"]');
  const categoriesContainer = root.querySelector('.categories');
  const actionsList = root.querySelector('.actions-list');
  const customInputWrap = root.querySelector('.custom-input-wrap');
  const customInput = root.querySelector('.custom-input');
  const customSend = root.querySelector('[data-action="custom-send"]');

  closeBtn.addEventListener('click', () => closeMenu());

  // Buy Me a Coffee button.
  const bmacBtn = root.querySelector('[data-action="bmac"]');
  if (bmacBtn) {
    bmacBtn.addEventListener('click', () => {
      window.open('https://buymeacoffee.com/monessem', '_blank');
      closeMenu();
    });
  }

  // Open in Duck.ai button.
  const openDuckAiBtn = root.querySelector('[data-action="open-duckai"]');
  if (openDuckAiBtn) {
    openDuckAiBtn.addEventListener('click', () => {
      window.open('https://duck.ai/', '_blank');
      closeMenu();
    });
  }

  // Close on outside click.
  document.addEventListener('mousedown', (e) => {
    if (!host || host.style.display === 'none') return;
    if (host.contains(e.target)) return;
    closeMenu();
  }, true);

  // Close on Escape.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && host && host.style.display !== 'none') {
      closeMenu();
    }
  }, true);

  customSend.addEventListener('click', () => {
    const cat = getActiveCategory();
    const input = customInput.value.trim();
    if (!input) {
      customInput.focus();
      return;
    }
    sendAction(cat === 'translate' ? 'translate' : 'code.convert', input);
  });
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      customSend.click();
    }
  });

  // Populate categories.
  for (const cat of CATEGORIES) {
    const pill = document.createElement('button');
    pill.className = 'cat-pill';
    pill.type = 'button';
    pill.dataset.category = cat.id;
    pill.setAttribute('role', 'tab');
    pill.innerHTML = '';
    const pillIcon = document.createElement('span');
    pillIcon.className = 'cat-icon';
    pillIcon.setAttribute('aria-hidden', 'true');
    pillIcon.textContent = cat.icon;
    const pillLabel = document.createElement('span');
    pillLabel.textContent = t(cat.labelKey) || cat.defaultLabel;
    pill.appendChild(pillIcon);
    pill.appendChild(pillLabel);
    pill.addEventListener('click', () => selectCategory(cat.id));
    categoriesContainer.appendChild(pill);
  }

  // Add "My Prompts" category (dynamic, loaded from storage).
  const myPill = document.createElement('button');
  myPill.className = 'cat-pill';
  myPill.type = 'button';
  myPill.dataset.category = 'myprompts';
  myPill.setAttribute('role', 'tab');
  myPill.innerHTML = '';
  const myIcon = document.createElement('span');
  myIcon.className = 'cat-icon';
  myIcon.setAttribute('aria-hidden', 'true');
  myIcon.textContent = '⭐';
  const myLabel = document.createElement('span');
  myLabel.textContent = t('categoryMyPrompts') || 'My Prompts';
  myPill.appendChild(myIcon);
  myPill.appendChild(myLabel);
  myPill.addEventListener('click', () => selectCategory('myprompts'));
  categoriesContainer.appendChild(myPill);
}

/**
 * Reorder category pills so the suggested ones appear first.
 * All categories remain accessible — only the order changes.
 * @param {string[]} suggestedCatIds - Prioritized category IDs
 */
function reorderCategoryPills(suggestedCatIds) {
  const categoriesContainer = root.querySelector('.categories');
  if (!categoriesContainer) return;

  // Get all pill elements (excluding the "My Prompts" pill which stays at the end).
  const allPills = Array.from(categoriesContainer.querySelectorAll('.cat-pill'));
  const myPromptsPill = allPills.find((p) => p.dataset.category === 'myprompts');
  const otherPills = allPills.filter((p) => p.dataset.category !== 'myprompts');

  // Sort: suggested first (in order), then the rest in original order.
  const suggested = [];
  const rest = [];
  for (const pill of otherPills) {
    const idx = suggestedCatIds.indexOf(pill.dataset.category);
    if (idx >= 0) {
      suggested.push({ pill, order: idx });
    } else {
      rest.push(pill);
    }
  }
  suggested.sort((a, b) => a.order - b.order);

  // Remove all pills from DOM.
  while (categoriesContainer.firstChild) {
    categoriesContainer.removeChild(categoriesContainer.firstChild);
  }

  // Re-append in new order: suggested first, then rest, then My Prompts.
  for (const s of suggested) {
    categoriesContainer.appendChild(s.pill);
  }
  for (const p of rest) {
    categoriesContainer.appendChild(p);
  }
  if (myPromptsPill) {
    categoriesContainer.appendChild(myPromptsPill);
  }
}

function getActiveCategory() {
  const active = root.querySelector('.cat-pill.active');
  return active ? active.dataset.category : 'common';
}

/**
 * Render user custom prompts in the actions list.
 */
async function renderMyPrompts(actionsList) {
  actionsList.innerHTML = '';
  const prompts = await getUserPrompts();
  if (prompts.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = '';
    const div = document.createElement('div');
    div.style.cssText = 'padding:16px;text-align:center;color:var(--duckai-muted);font-size:11px';
    div.textContent = t('myPromptsEmptyMenu') || 'No custom prompts yet. Add them in Settings → My Prompts.';
    li.appendChild(div);
    actionsList.appendChild(li);
    return;
  }
  for (const p of prompts) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'action-item';
    btn.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = `⭐ ${p.label}`;
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '\u203a';
    btn.appendChild(span);
    btn.appendChild(arrow);
    btn.addEventListener('click', () => sendAction(p.id));
    li.appendChild(btn);
    actionsList.appendChild(li);
  }
}

function selectCategory(categoryId) {
  // Update active pill.
  root.querySelectorAll('.cat-pill').forEach((p) => {
    p.classList.toggle('active', p.dataset.category === categoryId);
  });

  const actionsList = root.querySelector('.actions-list');
  const customInputWrap = root.querySelector('.custom-input-wrap');
  const customInput = root.querySelector('.custom-input');
  while (actionsList.firstChild) actionsList.removeChild(actionsList.firstChild);
  customInputWrap.hidden = true;

  if (categoryId === 'myprompts') {
    // Load user custom prompts dynamically.
    renderMyPrompts(actionsList);
    return;
  }

  if (categoryId === 'translate') {
    // Show language options with flags.
    for (const lang of TRANSLATE_LANGUAGES) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'action-item';
      btn.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = `${lang.flag} ${t(lang.labelKey) || lang.defaultLabel}`;
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '\u203a';
    btn.appendChild(span);
    btn.appendChild(arrow);
      btn.addEventListener('click', () => sendAction('translate', t(lang.labelKey) || lang.defaultLabel));
      li.appendChild(btn);
      actionsList.appendChild(li);
    }
    // "Choose language" option.
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'action-item';
    btn.innerHTML = '';
    const chooseSpan = document.createElement('span');
    chooseSpan.textContent = t('actionTranslateChoose') || 'Choose language...';
    const chooseArrow = document.createElement('span');
    chooseArrow.className = 'arrow';
    chooseArrow.textContent = '\u203a';
    btn.appendChild(chooseSpan);
    btn.appendChild(chooseArrow);
    btn.addEventListener('click', () => {
      customInputWrap.hidden = false;
      customInput.placeholder = 'e.g. Swedish, Hindi, Vietnamese...';
      customInput.focus();
    });
    li.appendChild(btn);
    actionsList.appendChild(li);
  } else {
    const actions = getActionsByCategory(categoryId);
    for (const action of actions) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'action-item';
      btn.innerHTML = '';
      const actSpan = document.createElement('span');
      actSpan.textContent = t(action.labelKey) || action.defaultLabel;
      const actArrow = document.createElement('span');
      actArrow.className = 'arrow';
      actArrow.textContent = '\u203a';
      btn.appendChild(actSpan);
      btn.appendChild(actArrow);
      if (action.needsInput) {
        btn.addEventListener('click', () => {
          customInputWrap.hidden = false;
          customInput.placeholder = action.id === 'code.convert'
            ? 'Target language (e.g. Python, Rust, Go)'
            : 'Target value';
          customInput.dataset.actionId = action.id;
          customInput.focus();
        });
      } else {
        btn.addEventListener('click', () => sendAction(action.id));
      }
      li.appendChild(btn);
      actionsList.appendChild(li);
    }
  }
}

/**
 * Send the action to the background, which builds the prompt and
 * launches Duck.ai (sidebar or new tab based on settings).
 *
 * @param {string} actionId
 * @param {string} [input]
 */
async function sendAction(actionId, input) {
  if (!currentSelection) {
    return;
  }
  try {
    await browser.runtime.sendMessage({
      type: MSG.RUN_ACTION,
      payload: {
        actionId,
        selection: currentSelection,
        input: input || null,
        sourceUrl: location.href,
        senderTabId: null // background will use sender.tab.id
      }
    });
  } catch (err) {
    console.warn('Ask Duck.ai: failed to send action', err);
  }
  closeMenu();
}

/**
 * Open the menu near the given coordinates.
 *
 * @param {Object} opts
 * @param {string} opts.selection
 * @param {string} [opts.suggestedCategory]
 * @param {{x: number, y: number}} [opts.coords]
 */
export async function openMenu(opts) {
  ensureMenu();
  currentSelection = opts.selection || '';

  const menu = root.querySelector('.menu');

  // Show selection preview.
  const preview = root.querySelector('.selection-preview');
  const previewText = root.querySelector('.selection-text');
  if (currentSelection) {
    previewText.textContent = currentSelection.slice(0, 120) + (currentSelection.length > 120 ? '\u2026' : '');
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }

  // Smart detection: if enabled, auto-select the best category
  // and reorder category pills so detected ones appear first.
  let smartDetection = false;
  try {
    const settings = await getSettings();
    smartDetection = settings.smartDetection === true;
  } catch (e) {}

  if (smartDetection) {
    const detection = detectContentType(currentSelection);
    const suggestedCats = detection.suggestedCategories || ['common'];
    const firstCat = suggestedCats[0];

    // Reorder category pills — put suggested ones first.
    reorderCategoryPills(suggestedCats);

    // Select the top suggested category.
    selectCategory(firstCat);

    console.log('[Ask Duck.ai] Smart detection:', detection.type, '→ categories:', suggestedCats.join(', '), 'confidence:', detection.confidence);
  } else {
    selectCategory('common');
  }

  // ---- Smart positioning based on viewport ----
  host.style.display = 'block';
  // Temporarily show to measure.
  menu.hidden = false;
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;

  const coords = opts.coords || { x: vw / 2, y: vh / 2 };
  // Default: below-right of the selection point.
  let left = coords.x + 8;
  let top = coords.y + 8;

  // If menu would overflow right, open to the left of the point.
  if (left + rect.width > vw - margin) {
    left = coords.x - rect.width - 8;
  }
  // If menu would overflow bottom, open above.
  if (top + rect.height > vh - margin) {
    top = coords.y - rect.height - 8;
  }

  // Clamp to viewport with margin.
  left = Math.max(margin, Math.min(left, vw - rect.width - margin));
  top = Math.max(margin, Math.min(top, vh - rect.height - margin));

  // Account for scroll.
  left += window.scrollX;
  top += window.scrollY;

  host.style.transform = `translate(${left}px, ${top}px)`;

  void menu.offsetWidth; // force reflow
  menu.classList.add('open');
}

export function closeMenu() {
  if (!host) return;
  const menu = root.querySelector('.menu');
  menu.classList.remove('open');
  setTimeout(() => {
    host.style.display = 'none';
    menu.hidden = true;
  }, 120);
}

async function applyTheme() {
  if (!host) return;
  const settings = await getSettings();
  const resolved = resolveTheme(settings.theme);
  host.setAttribute('data-theme', resolved);
}
