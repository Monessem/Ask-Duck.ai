/**
 * Duck.ai Service
 * ------------------------------------------------------------------
 * High-level facade over the Duck.ai client. Provides:
 *   - Conversation state management
 *   - Streaming chat with optional history
 *   - Token refresh / retry logic
 *   - Abort control for in-flight requests
 *
 * This is the ONLY module the rest of the extension should call
 * when it needs AI completion. The actual HTTP/SSE implementation
 * lives in `duckai-client.js` and can be swapped out without
 * touching anything else.
 * ------------------------------------------------------------------
 */

import { chat, invalidateToken, testConnection, DuckAIError } from './duckai-client.js';
import { getDefaultModelId, getModel } from './models.js';

/** @typedef {import('./duckai-client.js').ChatMessage} ChatMessage */

/**
 * @typedef {Object} ConversationTurn
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {number} timestamp
 * @property {string} [actionId]
 */

export class DuckAIService {
  constructor() {
    /** @type {ConversationTurn[]} */
    this.history = [];
    /** @type {AbortController|null} */
    this._activeController = null;
  }

  /**
   * Reset the in-memory conversation history.
   */
  reset() {
    this.cancel();
    this.history = [];
  }

  /**
   * Cancel any in-flight chat request.
   */
  cancel() {
    if (this._activeController) {
      try {
        this._activeController.abort();
      } catch {
        /* noop */
      }
      this._activeController = null;
    }
  }

  /**
   * Send a chat message and stream the response.
   *
   * @param {Object} params
   * @param {string} params.prompt        - Fully constructed user prompt
   * @param {string} [params.model]       - Model id
   * @param {string} [params.actionId]    - Action that triggered this turn
   * @param {boolean} [params.continueConversation] - Include prior history
   * @param {(chunk: string, full: string) => void} [params.onChunk]
   * @param {number} [params.timeoutMs]
   * @returns {Promise<string>} The assistant's full response text.
   */
  async send({
    prompt,
    model,
    actionId,
    continueConversation = false,
    onChunk,
    timeoutMs
  }) {
    if (!prompt || typeof prompt !== 'string') {
      throw new DuckAIError('Empty prompt', { code: 'duckai_empty_request' });
    }

    this.cancel();
    this._activeController = new AbortController();

    // Build message list. We do NOT inject a system message via the API
    // (Duck.ai does not accept a separate system role for anonymous
    // sessions). The system framing is baked into the user prompt by the
    // prompt builder to keep control over instruction precedence.
    /** @type {ChatMessage[]} */
    let messages = [];
    if (continueConversation && this.history.length > 0) {
      messages = this.history.map((t) => ({ role: t.role, content: t.content }));
    }
    messages.push({ role: 'user', content: prompt });

    const modelId = model || getDefaultModelId();

    let fullText = '';
    try {
      fullText = await chat({
        messages,
        model: modelId,
        onChunk: (chunk, full) => {
          fullText = full;
          if (onChunk) onChunk(chunk, full);
        },
        signal: this._activeController.signal,
        timeoutMs
      });
    } catch (err) {
      // On auth failure, the client already attempted a retry. If we
      // still fail, propagate the structured error.
      throw err;
    } finally {
      this._activeController = null;
    }

    // Record turn in history.
    const now = Date.now();
    this.history.push({ role: 'user', content: prompt, timestamp: now, actionId });
    this.history.push({ role: 'assistant', content: fullText, timestamp: now + 1 });

    // Cap history length to keep memory bounded.
    if (this.history.length > 40) {
      this.history = this.history.slice(-40);
    }

    return fullText;
  }

  /**
   * Regenerate the last assistant response by removing it and the
   * preceding user turn, then re-sending.
   *
   * @param {Object} [opts]
   * @param {(chunk: string, full: string) => void} [opts.onChunk]
   * @param {string} [opts.model]
   * @param {number} [opts.timeoutMs]
   * @returns {Promise<string>}
   */
  async regenerate({ onChunk, model, timeoutMs } = {}) {
    if (this.history.length < 2) {
      throw new DuckAIError('Nothing to regenerate', { code: 'duckai_empty_history' });
    }
    // Remove last assistant + user turns.
    const lastUser = this.history[this.history.length - 2];
    const lastAssistant = this.history[this.history.length - 1];
    if (lastUser.role !== 'user' || lastAssistant.role !== 'assistant') {
      throw new DuckAIError('Conversation state is invalid', { code: 'duckai_invalid_state' });
    }
    this.history = this.history.slice(0, -2);

    return this.send({
      prompt: lastUser.content,
      model: model || lastUser.model,
      actionId: lastUser.actionId,
      continueConversation: this.history.length > 0,
      onChunk,
      timeoutMs
    });
  }

  /**
   * Return a snapshot of the current conversation history.
   * @returns {ConversationTurn[]}
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Replace the conversation history (used when restoring from
   * persistent storage).
   * @param {ConversationTurn[]} turns
   */
  setHistory(turns) {
    this.history = Array.isArray(turns) ? [...turns] : [];
  }
}

/**
 * Singleton instance shared across the extension.
 * @type {DuckAIService}
 */
let _instance = null;

/**
 * @returns {DuckAIService}
 */
export function getDuckAIService() {
  if (!_instance) _instance = new DuckAIService();
  return _instance;
}

export { invalidateToken, testConnection, getModel, getDefaultModelId, DuckAIError };
