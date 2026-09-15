/**
 * Duck.ai Models
 * ------------------------------------------------------------------
 * This module lists the AI models exposed by the Duck.ai web app at
 * https://duck.ai. The IDs are the same strings the Duck.ai web app
 * sends to its own backend in the `model` field of the chat request.
 *
 * IMPORTANT: Duck.ai does NOT publish an official, documented public
 * API for browser extensions. The model identifiers below were
 * observed by inspecting the public Duck.ai web app traffic. They are
 * therefore UNOFFICIAL and may change without notice. The extension
 * is designed to fail gracefully if a model id becomes invalid.
 * ------------------------------------------------------------------
 */

/**
 * @typedef {Object} DuckAIModel
 * @property {string} id           - Model identifier sent to Duck.ai
 * @property {string} label        - Human readable label (EN)
 * @property {string} labelKey     - i18n message key
 * @property {string} provider     - Backend provider name
 * @property {boolean} [default]   - Whether this is the default model
 * @property {string} [description]- Short description
 */

/** @type {DuckAIModel[]} */
export const DUCKAI_MODELS = [
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    labelKey: 'modelGpt4oMini',
    provider: 'OpenAI',
    default: true,
    description: 'Fast and efficient for everyday tasks'
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    labelKey: 'modelGpt4o',
    provider: 'OpenAI',
    description: 'Higher quality reasoning'
  },
  {
    id: 'o3-mini',
    label: 'o3-mini',
    labelKey: 'modelO3Mini',
    provider: 'OpenAI',
    description: 'Compact reasoning model'
  },
  {
    id: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    labelKey: 'modelClaudeHaiku',
    provider: 'Anthropic',
    description: 'Fast and capable'
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    labelKey: 'modelClaudeSonnet',
    provider: 'Anthropic',
    description: 'Strong reasoning and writing'
  },
  {
    id: 'llama-3.1-70b-instant',
    label: 'Llama 3.1 70B',
    labelKey: 'modelLlama',
    provider: 'Meta',
    description: 'Open source, balanced'
  },
  {
    id: 'mixtral-8x7b-32768',
    label: 'Mixtral 8x7B',
    labelKey: 'modelMixtral',
    provider: 'Mistral',
    description: 'Open source MoE'
  }
];

/**
 * Returns the default model id.
 * @returns {string}
 */
export function getDefaultModelId() {
  const found = DUCKAI_MODELS.find((m) => m.default);
  return found ? found.id : DUCKAI_MODELS[0].id;
}

/**
 * Look up a model by id; falls back to the default.
 * @param {string} id
 * @returns {DuckAIModel}
 */
export function getModel(id) {
  return (
    DUCKAI_MODELS.find((m) => m.id === id) ||
    DUCKAI_MODELS.find((m) => m.default) ||
    DUCKAI_MODELS[0]
  );
}
