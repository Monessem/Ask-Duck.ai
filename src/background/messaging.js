export const MSG = {
  SHOW_MENU: 'show-menu',
  GET_SELECTION: 'get-selection',
  GET_PAGE_CONTENT: 'get-page-content',
  GET_PAGE_META: 'get-page-meta',
  CONFIRM_PAGE_SEND: 'confirm-page-send',
  RUN_ACTION: 'run-action',
  PAGE_ACTION: 'page-action',
  ACTION_FROM_POPUP: 'action-from-popup',
  OPEN_IN_DUCKAI: 'open-in-duckai',
  PROMPT_INPUT: 'prompt-input',
  GET_RECENT_ACTIONS: 'get-recent-actions',
  SETTINGS_CHANGED: 'settings-changed'
};

/** Message types the background script accepts. */
export const BACKGROUND_MESSAGE_TYPES = new Set([
  MSG.RUN_ACTION,
  MSG.PAGE_ACTION,
  MSG.ACTION_FROM_POPUP,
  MSG.GET_SELECTION,
  MSG.OPEN_IN_DUCKAI,
  MSG.GET_RECENT_ACTIONS
]);

/** Message types a content script accepts from the background. */
export const CONTENT_MESSAGE_TYPES = new Set([
  MSG.GET_SELECTION,
  MSG.GET_PAGE_CONTENT,
  MSG.GET_PAGE_META,
  MSG.CONFIRM_PAGE_SEND,
  MSG.PROMPT_INPUT
]);
