/**
 * Error handler — maps internal error codes to user-friendly,
 * localizable messages. Never exposes raw technical details.
 */

import { t } from '../utils/i18n.js';

/**
 * @typedef {Object} FriendlyError
 * @property {string} title
 * @property {string} message
 * @property {string} [code]
 * @property {boolean} [retryable]
 * @property {boolean} [openInDuckAi]
 */

const DEFAULT_ERROR = {
  titleKey: 'errorDefaultTitle',
  messageKey: 'errorDefaultMessage',
  retryable: true
};

const MAP = {
  duckai_network: {
    titleKey: 'errorNetworkTitle',
    messageKey: 'errorNetworkMessage',
    retryable: true
  },
  duckai_http: {
    titleKey: 'errorHttpTitle',
    messageKey: 'errorHttpMessage',
    retryable: true
  },
  duckai_no_token: {
    titleKey: 'errorNoTokenTitle',
    messageKey: 'errorNoTokenMessage',
    retryable: true
  },
  duckai_unauthorized: {
    titleKey: 'errorUnauthorizedTitle',
    messageKey: 'errorUnauthorizedMessage',
    retryable: true
  },
  duckai_rate_limit: {
    titleKey: 'errorRateLimitTitle',
    messageKey: 'errorRateLimitMessage',
    retryable: false
  },
  duckai_timeout: {
    titleKey: 'errorTimeoutTitle',
    messageKey: 'errorTimeoutMessage',
    retryable: true
  },
  duckai_empty_response: {
    titleKey: 'errorEmptyTitle',
    messageKey: 'errorEmptyMessage',
    retryable: true
  },
  duckai_empty_stream: {
    titleKey: 'errorEmptyTitle',
    messageKey: 'errorEmptyMessage',
    retryable: true
  },
  duckai_stream: {
    titleKey: 'errorStreamTitle',
    messageKey: 'errorStreamMessage',
    retryable: true
  },
  duckai_empty_request: {
    titleKey: 'errorEmptySelectionTitle',
    messageKey: 'errorEmptySelectionMessage',
    retryable: false
  },
  duckai_empty_history: {
    titleKey: 'errorNoHistoryTitle',
    messageKey: 'errorNoHistoryMessage',
    retryable: false
  },
  duckai_invalid_state: {
    titleKey: 'errorStateTitle',
    messageKey: 'errorStateMessage',
    retryable: false
  },
  duckai_unknown: {
    titleKey: 'errorDefaultTitle',
    messageKey: 'errorDefaultMessage',
    retryable: true
  }
};

/**
 * @param {Error & {code?: string, status?: number}} err
 * @returns {FriendlyError}
 */
export function toFriendlyError(err) {
  const code = err && err.code;
  const mapped = (code && MAP[code]) || DEFAULT_ERROR;
  return {
    title: t(mapped.titleKey),
    message: t(mapped.messageKey),
    code: code || 'duckai_unknown',
    retryable: !!mapped.retryable,
    openInDuckAi: true
  };
}
