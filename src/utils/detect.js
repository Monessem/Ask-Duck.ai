/**
 * Content type detection (v2.0)
 * ------------------------------------------------------------------
 * Detects the type of selected content and returns a prioritized
 * list of suggested categories.
 *
 * Detection rules:
 *   Code       → [code, common, translate]
 *   Recipe     → [chef, common, translate]
 *   Article    → [research, common, summary, translate]
 *   Paragraph  → [grammar, translate, common, summary]
 *   Unknown    → [common]
 */

/**
 * @typedef {Object} DetectionResult
 * @property {'code'|'recipe'|'article'|'paragraph'|'unknown'} type
 * @property {string[]} suggestedCategories - Prioritized list of category IDs
 * @property {number} confidence - 0..1
 */

const CODE_STRONG_SIGNALS = [
  /(\bfunction\b|\bdef\b|\bclass\b|\bimport\b|\brequire\b|\breturn\b|\bconst\b|\blet\b|\bvar\b)/,
  /(\{[\s\S]*\}|\([\s\S]*\)\s*=>)/,
  /(=>|->|::|\.\.\.|&&|\|\|)/,
  /(public\s+class|private\s+static|export\s+default|namespace\s+\w+)/,
  /<\/?[a-zA-Z][\s\S]*>/,
  /(^|\s)#(include|define|ifdef|ifndef|endif)\b/,
  /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN)\b/i,
  /^\s*\/{2,}.*$/m,
  /^\s*\/\*[\s\S]*?\*\//m,
  /\bprintf\s*\(|\bconsole\.\b|\bSystem\.out\.|document\.getElementById/
];

const RECIPE_SIGNALS = [
  /\b(recipe|ingredients|cups?|tablespoons?|teaspoons?|grams?|ounces?|preheat|bake|cook|simmer|saut[ée]|whisk|knead)\b/i,
  /\b\d+\s*(?:cups?|tbsp|tsp|g|kg|oz|lb|ml|l)\b/i,
  /\b(serve|garnish|season with|salt and pepper|olive oil)\b/i
];

const ARTICLE_SIGNALS = [
  /\b(according to|reported|study|research|study found|analysis|published)\b/i,
  /\b\d{4}\b/,
  /\b(Mr\.|Mrs\.|Dr\.|Sen\.|Rep\.)\s[A-Z]/,
  /\b(president|senator|government|policy|economic|industry|company|spokesperson)\b/i
];

/**
 * Detect content type from a raw text selection.
 * Returns a prioritized list of suggested categories.
 * @param {string} text
 * @returns {DetectionResult}
 */
export function detectContentType(text) {
  if (!text || !text.trim()) {
    return { type: 'unknown', suggestedCategories: ['common'], confidence: 0 };
  }

  const sample = text.length > 4000 ? text.slice(0, 4000) : text;
  const wordCount = sample.split(/\s+/).filter(Boolean).length;
  const sentenceCount = (sample.match(/[.!?]\s/g) || []).length;

  // ---- Code detection (strongest) ----
  let codeScore = 0;
  for (const re of CODE_STRONG_SIGNALS) {
    if (re.test(sample)) codeScore += 1;
  }
  if (/(;\s*\n\s*\w)/.test(sample)) codeScore += 1;
  if (/[{}();]/.test(sample) && wordCount > 5) codeScore += 1;
  if (codeScore >= 3) {
    return {
      type: 'code',
      suggestedCategories: ['code', 'common', 'translate'],
      confidence: Math.min(0.6 + codeScore * 0.08, 0.95)
    };
  }

  // ---- Recipe detection ----
  let recipeScore = 0;
  for (const re of RECIPE_SIGNALS) {
    if (re.test(sample)) recipeScore += 1;
  }
  if (recipeScore >= 2) {
    return {
      type: 'recipe',
      suggestedCategories: ['chef', 'common', 'translate'],
      confidence: Math.min(0.55 + recipeScore * 0.1, 0.9)
    };
  }

  // ---- Article detection ----
  let articleScore = 0;
  for (const re of ARTICLE_SIGNALS) {
    if (re.test(sample)) articleScore += 1;
  }
  if (wordCount > 80 && sentenceCount > 3) articleScore += 1;
  if (wordCount > 250) articleScore += 1;
  if (articleScore >= 3) {
    return {
      type: 'article',
      suggestedCategories: ['research', 'common', 'summary', 'translate'],
      confidence: Math.min(0.5 + articleScore * 0.08, 0.85)
    };
  }

  // ---- Paragraph (short prose) ----
  if (wordCount >= 5 && wordCount <= 120 && sentenceCount <= 4) {
    return {
      type: 'paragraph',
      suggestedCategories: ['grammar', 'translate', 'common', 'summary'],
      confidence: 0.5
    };
  }

  // ---- Fallback ----
  return {
    type: wordCount > 0 ? 'paragraph' : 'unknown',
    suggestedCategories: ['common'],
    confidence: 0.3
  };
}
