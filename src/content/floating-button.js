/**
 * Floating selection button
 * ------------------------------------------------------------------
 * Shows a small Duck.ai button near the current text selection.
 * Clicking it opens the action menu / response panel.
 *
 * The button is injected into the page DOM (shadow DOM-isolated
 * from page styles) and repositioned on every selectionchange.
 */

import { isUnsupportedPage, debounce } from '../utils/helpers.js';
import { getSettings } from '../services/settings.js';
import { detectContentType } from '../utils/detect.js';

const BUTTON_ID = 'duckai-floating-button';

/** @type {ShadowRoot|null} */
let root = null;
/** @type {HTMLElement|null} */
let host = null;

/**
 * Inject the floating button host + shadow DOM. Safe to call once
 * at content script init.
 */
export function ensureFloatingButton() {
  if (host) return;
  if (isUnsupportedPage()) return;

  host = document.createElement('div');
  host.id = BUTTON_ID;
  host.style.all = 'initial';
  host.style.position = 'absolute';
  host.style.zIndex = '2147483646';
  host.style.top = '0';
  host.style.left = '0';
  host.style.display = 'none';
  host.style.pointerEvents = 'none';

  root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      :host { all: initial; direction: ltr; }
      button {
        all: initial;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: #1f2937;
        color: #fff;
        border-radius: 999px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.08);
        transition: transform 80ms ease, background 120ms ease;
        pointer-events: auto;
        user-select: none;
      }
      button:hover { background: #111827; transform: translateY(-1px); }
      button:active { transform: translateY(0); }
      button .logo-img {
        width: 16px; height: 16px;
        border-radius: 50%;
        object-fit: contain;
      }
      button .label { font-weight: 500; }
      @media (prefers-reduced-motion: reduce) {
        button { transition: none; }
        button:hover { transform: none; }
      }
    </style>
    <button type="button" aria-label="Ask Duck.ai">
      <img class="logo-img" alt="" aria-hidden="true" />
      <span class="label">Ask Duck.ai</span>
    </button>
  `;

  const btn = root.querySelector('button');
  // Set the logo image source.
  const logoImg = root.querySelector('.logo-img');
  if (logoImg) {
    logoImg.src = browser.runtime.getURL('icons/icon-48.png');
  }
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const selection = getCurrentSelection();
    if (selection) {
      const detection = detectContentType(selection);
      window.dispatchEvent(new CustomEvent('duckai:floating-click', {
        detail: { selection, suggestedCategory: detection.suggestedCategory }
      }));
    }
    hide();
  });
  btn.addEventListener('mousedown', (e) => {
    // Prevent the mousedown from clearing the selection.
    e.preventDefault();
  });

  document.documentElement.appendChild(host);
}

/**
 * Show the button at a position relative to the current selection.
 * @param {{x: number, y: number}} coords
 */
export function showAt({ x, y }) {
  if (!host) return;
  host.style.display = 'block';
  // Position so the button sits just above the selection end.
  const rect = host.getBoundingClientRect();
  const btnWidth = rect.width || 110;
  const btnHeight = rect.height || 32;
  let left = x - btnWidth / 2;
  let top = y - btnHeight - 8;
  // Clamp to viewport
  left = Math.max(8, Math.min(left, window.innerWidth - btnWidth - 8));
  top = Math.max(8, top);
  host.style.transform = `translate(${left}px, ${top}px)`;
}

export function hide() {
  if (!host) return;
  host.style.display = 'none';
}

/**
 * Read the current window selection as a trimmed string.
 * @returns {string}
 */
export function getCurrentSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return '';
  const text = sel.toString().trim();
  return text;
}

/**
 * Compute the screen coordinates of the end of the current
 * selection, suitable for positioning the floating button.
 *
 * @returns {{x: number, y: number}|null}
 */
export function getSelectionCoords() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0).cloneRange();
  // Collapse to end
  range.collapse(false);
  let rect = range.getBoundingClientRect();
  if (!rect || (rect.left === 0 && rect.top === 0)) {
    // Fallback: use the bounding rect of the full range
    rect = sel.getRangeAt(0).getBoundingClientRect();
  }
  if (!rect) return null;
  return {
    x: rect.left + window.scrollX + rect.width / 2,
    y: rect.top + window.scrollY
  };
}

/**
 * Wire up the selection-based show/hide logic. Should be called
 * once at content script init.
 */
export function attachSelectionWatcher() {
  if (isUnsupportedPage()) return;
  const onSelectionChange = debounce(async () => {
    const settings = await getSettings();
    if (!settings.floatingButton) {
      hide();
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      hide();
      return;
    }
    const text = sel.toString().trim();
    if (!text || text.length < 2) {
      hide();
      return;
    }
    // Skip if the selection is inside an input/textarea/contenteditable.
    const anchor = sel.anchorNode;
    if (anchor) {
      const el = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        // Still show, but tag the event so the menu can warn about inputs.
      }
    }
    const coords = getSelectionCoords();
    if (!coords) return;
    // Delay slightly so the user can finish selecting.
    setTimeout(() => {
      const stillSel = window.getSelection();
      if (!stillSel || stillSel.isCollapsed) return;
      showAt(coords);
    }, 250);
  }, 200);

  document.addEventListener('selectionchange', onSelectionChange);
  // Hide on scroll / resize.
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide);
}
