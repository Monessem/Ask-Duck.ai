/**
 * Content type detection (v3.0)
 * ------------------------------------------------------------------
 * Detects the type of selected content and returns a prioritized
 * list of suggested categories. ALL 12 built-in categories can be
 * suggested by at least one content type, so smart detection
 * reaches the full surface of the extension.
 *
 * Detection rules:
 *   Code        → [code, common, translate]
 *   Recipe      → [chef, common, translate]
 *   Article     → [research, common, summary, translate]
 *   Email/Work  → [work, common, summary, translate]
 *   Argument    → [critical, common, summary, translate]
 *   Learning    → [learning, common, summary, translate]
 *   Marketing   → [seo, common, summary, translate]
 *   Security    → [security, common, summary, translate]
 *   Short prose → [grammar, translate, common, summary]
 *   Long prose  → [summary, common, grammar, translate]
 *   Unknown     → [common]
 */

/**
 * @typedef {Object} DetectionResult
 * @property {'code'|'recipe'|'article'|'work'|'argument'|'learning'|'marketing'|'security'|'paragraph'|'long-prose'|'unknown'} type
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

const WORK_SIGNALS = [
  /\b(dear\s+(team|all|colleagues|sir|madam)|hi\s+team|hello\s+team|regards|sincerely|best\s*regards|thanks\s+in\s+advance)\b/i,
  /\b(meeting|agenda|minutes|action\s+items?|deadline|milestone|deliverables?|stakeholders?|kickoff|follow[- ]up)\b/i,
  /\b(project|sprint|backlog|ticket|issue|epic|story\s+points?|roadmap|status\s+update|standup|scrum)\b/i,
  /\b\d+\s*(?:am|pm)\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday)\b/i
];

const ARGUMENT_SIGNALS = [
  /\b(claim|argue|argument|thesis|hypothesis|premise|conclusion)\b/i,
  /\b(therefore|thus|hence|consequently|because|since|due to|as a result)\b/i,
  /\b(however|but|nevertheless|on the other hand|conversely|whereas|although)\b/i,
  /\b(should|ought to|must|need to|it is clear that|it follows that)\b/i,
  /\b(prove|disprove|refute|support|undermine|evidence|warrant|justify)\b/i
];

const LEARNING_SIGNALS = [
  /\b(lecture|tutorial|lesson|syllabus|course|curriculum|homework|assignment|exercise|quiz|exam|test)\b/i,
  /\b(definition|concept|theorem|formula|equation|example|exercise|practice|study\s+guide)\b/i,
  /\b(chapter\s+\d+|page\s+\d+|figure\s+\d+|table\s+\d+)\b/i,
  /\b(remember|memorize|understand|explain|describe|compare|contrast|analyze)\b/i,
  /\b(what\s+is|why\s+does|how\s+does|when\s+did|who\s+was)\b/i
];

const MARKETING_SIGNALS = [
  /\b(brand|audience|target\s+market|demographic|campaign|advertis\w+|marketing|seo|sem|ctr|cpc|cpm|roi)\b/i,
  /\b(hashtag|engagement|reach|impressions|conversion|landing\s+page|call\s+to\s+action|cta|value\s+proposition)\b/i,
  /\b(facebook|twitter|instagram|linkedin|tiktok|youtube|pinterest|snapchat)\b/i,
  /\b(launch|promote|promot\w+|discount|coupon|sale|deal|offer)\b/i,
  /\b(keyword|tagline|slogan|tagline|buzzword|positioning|messaging)\b/i
];

const SECURITY_SIGNALS = [
  /\b(password|passcode|pin\s+code|secret\s+key|api\s+key|access\s+token|refresh\s+token)\b/i,
  /\b(phishing|scam|fraud|malware|ransomware|trojan|virus|spyware|adware)\b/i,
  /\b(vulnerability|exploit|cve[- ]?\d*|injection|xss|csrf|sqli|buffer\s+overflow|privilege\s+escalation)\b/i,
  /\b(https?:\/\/[^\s]+|click\s+here|verify\s+your\s+account|confirm\s+your\s+identity)\b/i,
  /\b(encrypt|decrypt|hash|salt|cipher|tls|ssl|certificate|public\s+key|private\s+key)\b/i,
  /\b(suspicious|unauthorized|breach|leak|compromised|hacked|stolen)\b/i
];

/**
 * Count how many signals in `patterns` match `sample`.
 * @param {RegExp[]} patterns
 * @param {string} sample
 * @returns {number}
 */
function countMatches(patterns, sample) {
  let n = 0;
  for (const re of patterns) {
    if (re.test(sample)) n += 1;
  }
  return n;
}

/**
 * Detect content type from a raw text selection.
 * Returns a prioritized list of suggested categories.
 *
 * Every category is reachable:
 *   - Code Helper via `code`
 *   - Chef Helper via `recipe`
 *   - Research Helper via `article`
 *   - Work & Productivity via `work`
 *   - Critical Thinking via `argument`
 *   - Learning Helper via `learning`
 *   - SEO & Marketing via `marketing`
 *   - Security Analysis via `security`
 *   - Grammar Helper via `paragraph`
 *   - Quick Summary via `long-prose`
 *   - Common Questions via any (always present as fallback)
 *   - Translate via any (always present as a useful secondary)
 *
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

  // ---- Code detection (strongest — most unambiguous) ----
  let codeScore = countMatches(CODE_STRONG_SIGNALS, sample);
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
  const recipeScore = countMatches(RECIPE_SIGNALS, sample);
  if (recipeScore >= 2) {
    return {
      type: 'recipe',
      suggestedCategories: ['chef', 'common', 'translate'],
      confidence: Math.min(0.55 + recipeScore * 0.1, 0.9)
    };
  }

  // ---- Security detection (specific keywords, high signal) ----
  const securityScore = countMatches(SECURITY_SIGNALS, sample);
  if (securityScore >= 2) {
    return {
      type: 'security',
      suggestedCategories: ['security', 'common', 'summary', 'translate'],
      confidence: Math.min(0.55 + securityScore * 0.08, 0.9)
    };
  }

  // ---- Marketing / SEO detection ----
  const marketingScore = countMatches(MARKETING_SIGNALS, sample);
  if (marketingScore >= 2) {
    return {
      type: 'marketing',
      suggestedCategories: ['seo', 'common', 'summary', 'translate'],
      confidence: Math.min(0.55 + marketingScore * 0.08, 0.88)
    };
  }

  // ---- Learning / educational content ----
  const learningScore = countMatches(LEARNING_SIGNALS, sample);
  if (learningScore >= 2) {
    return {
      type: 'learning',
      suggestedCategories: ['learning', 'common', 'summary', 'translate'],
      confidence: Math.min(0.55 + learningScore * 0.08, 0.88)
    };
  }

  // ---- Work / email / project content ----
  const workScore = countMatches(WORK_SIGNALS, sample);
  if (workScore >= 2) {
    return {
      type: 'work',
      suggestedCategories: ['work', 'common', 'summary', 'translate'],
      confidence: Math.min(0.55 + workScore * 0.08, 0.88)
    };
  }

  // ---- Argument / opinion / debate content ----
  const argumentScore = countMatches(ARGUMENT_SIGNALS, sample);
  if (argumentScore >= 3) {
    return {
      type: 'argument',
      suggestedCategories: ['critical', 'common', 'summary', 'translate'],
      confidence: Math.min(0.5 + argumentScore * 0.08, 0.85)
    };
  }

  // ---- Article detection (news / research / long-form) ----
  let articleScore = countMatches(ARTICLE_SIGNALS, sample);
  if (wordCount > 80 && sentenceCount > 3) articleScore += 1;
  if (wordCount > 250) articleScore += 1;
  if (articleScore >= 3) {
    return {
      type: 'article',
      suggestedCategories: ['research', 'common', 'summary', 'translate'],
      confidence: Math.min(0.5 + articleScore * 0.08, 0.85)
    };
  }

  // ---- Short prose (paragraph) — likely needs grammar/translation help ----
  if (wordCount >= 5 && wordCount <= 120 && sentenceCount <= 4) {
    return {
      type: 'paragraph',
      suggestedCategories: ['grammar', 'translate', 'common', 'summary'],
      confidence: 0.5
    };
  }

  // ---- Long prose without specific signals → summarize first ----
  if (wordCount > 120) {
    return {
      type: 'long-prose',
      suggestedCategories: ['summary', 'common', 'grammar', 'translate'],
      confidence: 0.45
    };
  }

  // ---- Fallback ----
  return {
    type: wordCount > 0 ? 'paragraph' : 'unknown',
    suggestedCategories: ['common'],
    confidence: 0.3
  };
}
