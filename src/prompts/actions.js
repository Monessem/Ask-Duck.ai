/**
 * Action Definitions (v3.0)
 * ------------------------------------------------------------------
 * All instructions are ONE LINE — just describing what's needed.
 * The prompt builder prepends only the instruction + the text.
 */

/** @typedef {'common'|'translate'|'grammar'|'critical'|'code'|'chef'|'research'|'summary'|'learning'|'work'|'seo'|'security'} ActionCategory */

/** @type {ActionCategory[]} */
export const CATEGORY_ORDER = [
  'common', 'translate', 'grammar', 'critical', 'code', 'chef', 'research',
  'summary', 'learning', 'work', 'seo', 'security'
];

/** @type {{id: ActionCategory, labelKey: string, defaultLabel: string, icon: string}[]} */
export const CATEGORIES = [
  { id: 'common', labelKey: 'categoryCommon', defaultLabel: 'Common Questions', icon: '💭' },
  { id: 'summary', labelKey: 'categorySummary', defaultLabel: 'Quick Summary', icon: '🗂️' },
  { id: 'translate', labelKey: 'categoryTranslate', defaultLabel: 'Translate', icon: '🌍' },
  { id: 'grammar', labelKey: 'categoryGrammar', defaultLabel: 'Grammar Helper', icon: '📄' },
  { id: 'critical', labelKey: 'categoryCritical', defaultLabel: 'Critical Thinking', icon: '🔍' },
  { id: 'code', labelKey: 'categoryCode', defaultLabel: 'Code Helper', icon: '🖥️' },
  { id: 'learning', labelKey: 'categoryLearning', defaultLabel: 'Learning Helper', icon: '🎓' },
  { id: 'work', labelKey: 'categoryWork', defaultLabel: 'Work & Productivity', icon: '💼' },
  { id: 'chef', labelKey: 'categoryChef', defaultLabel: 'Chef Helper', icon: '🥘' },
  { id: 'research', labelKey: 'categoryResearch', defaultLabel: 'Research Helper', icon: '🔬' },
  { id: 'seo', labelKey: 'categorySeo', defaultLabel: 'SEO & Marketing', icon: '🎯' },
  { id: 'security', labelKey: 'categorySecurity', defaultLabel: 'Security Analysis', icon: '🔒' }
];

/** @type {{id: string, category: ActionCategory, labelKey: string, defaultLabel: string, instruction: string, needsInput?: boolean, inputLabelKey?: string, inputDefault?: string}[]} */
export const ACTIONS = [
  // ---------- 💭 Common Questions ----------
  { id: 'common.think', category: 'common', labelKey: 'actionThink', defaultLabel: 'What do you think of this?', instruction: 'Share your perspective on this content.' },
  { id: 'common.factcheck', category: 'common', labelKey: 'actionFactCheck', defaultLabel: 'Fact check', instruction: 'Fact-check the claims in this content.' },
  { id: 'common.eli5', category: 'common', labelKey: 'actionEli5', defaultLabel: "Explain like I'm five", instruction: 'Explain this in simple terms a child would understand.' },
  { id: 'common.debate', category: 'common', labelKey: 'actionDebate', defaultLabel: 'Debate', instruction: 'Present arguments for and against this.' },
  { id: 'common.tldr', category: 'common', labelKey: 'actionTldr', defaultLabel: 'TL;DR', instruction: 'Summarize this in 2-3 sentences.' },

  // ---------- 🗂️ Quick Summary ----------
  { id: 'summary.general', category: 'summary', labelKey: 'actionSummaryGeneral', defaultLabel: 'Summarize', instruction: 'Summarize this.' },
  { id: 'summary.one', category: 'summary', labelKey: 'actionSummaryOne', defaultLabel: 'One-sentence summary', instruction: 'Summarize this in exactly one sentence.' },
  { id: 'summary.points', category: 'summary', labelKey: 'actionSummaryPoints', defaultLabel: 'Key points', instruction: 'List 3-5 key points from this.' },
  { id: 'summary.actions', category: 'summary', labelKey: 'actionSummaryActions', defaultLabel: 'Action items', instruction: 'Extract actionable to-do items from this.' },
  { id: 'summary.matrix', category: 'summary', labelKey: 'actionSummaryMatrix', defaultLabel: 'Decision matrix', instruction: 'Create a decision matrix with pros and cons for each option.' },

  // ---------- 🌍 Translate ----------
  { id: 'translate', category: 'translate', labelKey: 'actionTranslate', defaultLabel: 'Translate', instruction: 'Translate this into {{input}}.', needsInput: true, inputLabelKey: 'actionTranslateLanguage', inputDefault: 'English' },

  // ---------- 📄 Grammar Helper ----------
  { id: 'grammar.correct', category: 'grammar', labelKey: 'actionGrammarCorrect', defaultLabel: 'Correct grammar', instruction: 'Fix grammar, spelling, and punctuation in this.' },
  { id: 'grammar.longer', category: 'grammar', labelKey: 'actionGrammarLonger', defaultLabel: 'Make text longer', instruction: 'Expand this to roughly double its length.' },
  { id: 'grammar.shorter', category: 'grammar', labelKey: 'actionGrammarShorter', defaultLabel: 'Make text shorter', instruction: 'Condense this to roughly half its length.' },
  { id: 'grammar.professional', category: 'grammar', labelKey: 'actionGrammarProfessional', defaultLabel: 'Make text more professional', instruction: 'Rewrite this in a professional, formal tone.' },
  { id: 'grammar.less_professional', category: 'grammar', labelKey: 'actionGrammarLessProfessional', defaultLabel: 'Make text less professional', instruction: 'Rewrite this in a casual, friendly tone.' },
  { id: 'grammar.clear', category: 'grammar', labelKey: 'actionGrammarClear', defaultLabel: 'Rewrite clearly', instruction: 'Rewrite this to be clearer and easier to read.' },
  { id: 'grammar.style', category: 'grammar', labelKey: 'actionGrammarStyle', defaultLabel: 'Improve writing style', instruction: 'Improve the writing style of this.' },
  { id: 'grammar.spelling', category: 'grammar', labelKey: 'actionGrammarSpelling', defaultLabel: 'Fix spelling', instruction: 'Fix only spelling mistakes in this.' },

  // ---------- 🔍 Critical Thinking ----------
  { id: 'critical.question', category: 'critical', labelKey: 'actionCriticalQuestion', defaultLabel: 'Question me', instruction: 'Ask 3-5 thought-provoking questions about this.' },
  { id: 'critical.istrue', category: 'critical', labelKey: 'actionCriticalIsTrue', defaultLabel: 'Is this true?', instruction: 'Evaluate whether the claims in this are true, false, or unverifiable.' },
  { id: 'critical.assumptions', category: 'critical', labelKey: 'actionCriticalAssumptions', defaultLabel: 'Find assumptions', instruction: 'Identify the implicit assumptions in this.' },
  { id: 'critical.challenge', category: 'critical', labelKey: 'actionCriticalChallenge', defaultLabel: 'Challenge this idea', instruction: 'Present the strongest objections to this.' },
  { id: 'critical.perspective', category: 'critical', labelKey: 'actionCriticalPerspective', defaultLabel: 'New perspective', instruction: 'Offer a fresh perspective on this.' },
  { id: 'critical.counterarguments', category: 'critical', labelKey: 'actionCriticalCounterarguments', defaultLabel: 'Give counterarguments', instruction: 'List the strongest counterarguments to this.' },
  { id: 'critical.fallacies', category: 'critical', labelKey: 'actionCriticalFallacies', defaultLabel: 'Identify logical fallacies', instruction: 'Identify any logical fallacies in this.' },
  { id: 'critical.missing', category: 'critical', labelKey: 'actionCriticalMissing', defaultLabel: 'What am I missing?', instruction: 'Identify what is missing from this.' },

  // ---------- 🖥️ Code Helper ----------
  { id: 'code.debug', category: 'code', labelKey: 'actionCodeDebug', defaultLabel: 'Debug code', instruction: 'Find and fix bugs in this code.' },
  { id: 'code.improve', category: 'code', labelKey: 'actionCodeImprove', defaultLabel: 'Improve this code', instruction: 'Improve this code for readability and correctness.' },
  { id: 'code.wrong', category: 'code', labelKey: 'actionCodeWrong', defaultLabel: "What's wrong in this code?", instruction: 'List the problems in this code.' },
  { id: 'code.what', category: 'code', labelKey: 'actionCodeWhat', defaultLabel: 'What does this code do?', instruction: 'Explain what this code does.' },
  { id: 'code.dangerous', category: 'code', labelKey: 'actionCodeDangerous', defaultLabel: 'Is this code dangerous?', instruction: 'Assess whether this code is dangerous or insecure.' },
  { id: 'code.clean', category: 'code', labelKey: 'actionCodeClean', defaultLabel: 'Clean code', instruction: 'Refactor this code for cleanliness without changing behavior.' },
  { id: 'code.explain', category: 'code', labelKey: 'actionCodeExplain', defaultLabel: 'Explain this code', instruction: 'Explain this code step by step.' },
  { id: 'code.optimize', category: 'code', labelKey: 'actionCodeOptimize', defaultLabel: 'Optimize this code', instruction: 'Optimize this code for performance.' },
  { id: 'code.comments', category: 'code', labelKey: 'actionCodeComments', defaultLabel: 'Add comments', instruction: 'Add clear comments to this code.' },
  { id: 'code.convert', category: 'code', labelKey: 'actionCodeConvert', defaultLabel: 'Convert to another programming language', instruction: 'Convert this code to {{input}}.', needsInput: true, inputLabelKey: 'actionCodeConvertLang', inputDefault: 'Python' },

  // ---------- 🎓 Learning Helper ----------
  { id: 'learning.quiz', category: 'learning', labelKey: 'actionLearningQuiz', defaultLabel: 'Create a quiz', instruction: 'Create a 5-question quiz from this content with answers.' },
  { id: 'learning.flashcards', category: 'learning', labelKey: 'actionLearningFlashcards', defaultLabel: 'Flashcards', instruction: 'Create flashcards (term: definition) for key concepts in this.' },
  { id: 'learning.teach', category: 'learning', labelKey: 'actionLearningTeach', defaultLabel: 'Teach back', instruction: 'Explain this as if teaching a beginner step by step.' },
  { id: 'learning.exercise', category: 'learning', labelKey: 'actionLearningExercise', defaultLabel: 'Practice exercise', instruction: 'Create a practice exercise based on this.' },
  { id: 'learning.mnemonic', category: 'learning', labelKey: 'actionLearningMnemonic', defaultLabel: 'Memory mnemonic', instruction: 'Create a mnemonic device to help remember the key concepts.' },

  // ---------- 💼 Work & Productivity ----------
  { id: 'work.email', category: 'work', labelKey: 'actionWorkEmail', defaultLabel: 'Email reply', instruction: 'Write a professional email reply to this.' },
  { id: 'work.meeting', category: 'work', labelKey: 'actionWorkMeeting', defaultLabel: 'Meeting notes', instruction: 'Summarize this as structured meeting notes with decisions and action items.' },
  { id: 'work.plan', category: 'work', labelKey: 'actionWorkPlan', defaultLabel: 'Action plan', instruction: 'Create a step-by-step action plan based on this.' },
  { id: 'work.status', category: 'work', labelKey: 'actionWorkStatus', defaultLabel: 'Status update', instruction: 'Write a project status update based on this.' },
  { id: 'work.pitch', category: 'work', labelKey: 'actionWorkPitch', defaultLabel: 'Pitch deck outline', instruction: 'Create a pitch deck outline from this.' },

  // ---------- 🥘 Chef Helper ----------
  { id: 'chef.recipe', category: 'chef', labelKey: 'actionChefRecipe', defaultLabel: 'Recipe ideas', instruction: 'Suggest 3-5 recipe ideas related to this.' },
  { id: 'chef.substitutes', category: 'chef', labelKey: 'actionChefSubstitutes', defaultLabel: 'Ingredients substitutes', instruction: 'Suggest substitutes for ingredients in this.' },
  { id: 'chef.story', category: 'chef', labelKey: 'actionChefStory', defaultLabel: "What's this dish's story?", instruction: 'Tell the history and origin of this dish.' },
  { id: 'chef.nutrition', category: 'chef', labelKey: 'actionChefNutrition', defaultLabel: 'Nutrition info', instruction: 'Provide approximate nutrition info for this.' },
  { id: 'chef.safety', category: 'chef', labelKey: 'actionChefSafety', defaultLabel: 'Food safety', instruction: 'Provide food safety guidance for this.' },
  { id: 'chef.cooking', category: 'chef', labelKey: 'actionChefCooking', defaultLabel: 'Cooking instructions', instruction: 'Provide step-by-step cooking instructions for this.' },
  { id: 'chef.healthier', category: 'chef', labelKey: 'actionChefHealthier', defaultLabel: 'Make it healthier', instruction: 'Suggest how to make this healthier.' },
  { id: 'chef.vegetarian', category: 'chef', labelKey: 'actionChefVegetarian', defaultLabel: 'Vegetarian alternative', instruction: 'Suggest a vegetarian alternative to this.' },
  { id: 'chef.shopping', category: 'chef', labelKey: 'actionChefShopping', defaultLabel: 'Shopping ingredients', instruction: 'Create a shopping list from this.' },

  // ---------- 🔬 Research Helper ----------
  { id: 'research.sources', category: 'research', labelKey: 'actionResearchSources', defaultLabel: 'Find sources', instruction: 'Suggest reputable source types to learn more about this.' },
  { id: 'research.analyze', category: 'research', labelKey: 'actionResearchAnalyze', defaultLabel: 'Analyze data', instruction: 'Analyze the data or statistics in this.' },
  { id: 'research.deepdive', category: 'research', labelKey: 'actionResearchDeepDive', defaultLabel: 'Deep dive', instruction: 'Provide a deep-dive analysis of this.' },
  { id: 'research.news', category: 'research', labelKey: 'actionResearchNews', defaultLabel: 'Latest news', instruction: 'Summarize what recent developments to look for on this topic.' },
  { id: 'research.summarize', category: 'research', labelKey: 'actionResearchSummarize', defaultLabel: 'Summarize research', instruction: 'Summarize this as a research brief.' },
  { id: 'research.compare', category: 'research', labelKey: 'actionResearchCompare', defaultLabel: 'Compare sources', instruction: 'Compare viewpoints on this topic.' },
  { id: 'research.opposing', category: 'research', labelKey: 'actionResearchOpposing', defaultLabel: 'Find opposing views', instruction: 'Identify opposing views to this.' },
  { id: 'research.evidence', category: 'research', labelKey: 'actionResearchEvidence', defaultLabel: 'Explain the evidence', instruction: 'Explain the evidence relevant to this.' },
  { id: 'research.questions', category: 'research', labelKey: 'actionResearchQuestions', defaultLabel: 'Generate research questions', instruction: 'Generate 5-7 research questions from this.' },

  // ---------- 🎯 SEO & Marketing ----------
  { id: 'seo.keywords', category: 'seo', labelKey: 'actionSeoKeywords', defaultLabel: 'SEO keywords', instruction: 'Extract SEO keywords from this.' },
  { id: 'seo.meta', category: 'seo', labelKey: 'actionSeoMeta', defaultLabel: 'Meta description', instruction: 'Write an SEO meta description for this.' },
  { id: 'seo.social', category: 'seo', labelKey: 'actionSeoSocial', defaultLabel: 'Social media post', instruction: 'Write a social media post based on this.' },
  { id: 'seo.adcopy', category: 'seo', labelKey: 'actionSeoAdcopy', defaultLabel: 'Ad copy', instruction: 'Write ad copy based on this.' },
  { id: 'seo.hashtags', category: 'seo', labelKey: 'actionSeoHashtags', defaultLabel: 'Hashtag suggestions', instruction: 'Suggest relevant hashtags for this.' },

  // ---------- 🔒 Security Analysis ----------
  { id: 'security.phishing', category: 'security', labelKey: 'actionSecurityPhishing', defaultLabel: 'Phishing check', instruction: 'Check if this text is a phishing attempt or scam.' },
  { id: 'security.privacy', category: 'security', labelKey: 'actionSecurityPrivacy', defaultLabel: 'Privacy audit', instruction: 'Identify personal or sensitive information exposed in this.' },
  { id: 'security.password', category: 'security', labelKey: 'actionSecurityPassword', defaultLabel: 'Password strength', instruction: 'Analyze the strength of passwords mentioned in this.' },
  { id: 'security.vuln', category: 'security', labelKey: 'actionSecurityVuln', defaultLabel: 'Vulnerability scan', instruction: 'Scan this code for security vulnerabilities.' }
];

/** @type {{code: string, labelKey: string, defaultLabel: string, flag: string}[]} */
export const TRANSLATE_LANGUAGES = [
  { code: 'ar', labelKey: 'langArabic', defaultLabel: 'Arabic', flag: '🇸🇦' },
  { code: 'en', labelKey: 'langEnglish', defaultLabel: 'English', flag: '🇬🇧' },
  { code: 'fr', labelKey: 'langFrench', defaultLabel: 'French', flag: '🇫🇷' },
  { code: 'de', labelKey: 'langGerman', defaultLabel: 'German', flag: '🇩🇪' },
  { code: 'es', labelKey: 'langSpanish', defaultLabel: 'Spanish', flag: '🇪🇸' },
  { code: 'it', labelKey: 'langItalian', defaultLabel: 'Italian', flag: '🇮🇹' },
  { code: 'pt', labelKey: 'langPortuguese', defaultLabel: 'Portuguese', flag: '🇵🇹' },
  { code: 'tr', labelKey: 'langTurkish', defaultLabel: 'Turkish', flag: '🇹🇷' },
  { code: 'zh', labelKey: 'langChinese', defaultLabel: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', labelKey: 'langJapanese', defaultLabel: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', labelKey: 'langKorean', defaultLabel: 'Korean', flag: '🇰🇷' },
  { code: 'ru', labelKey: 'langRussian', defaultLabel: 'Russian', flag: '🇷🇺' }
];

export function getAction(id) {
  return ACTIONS.find((a) => a.id === id);
}

export function getActionsByCategory(category) {
  return ACTIONS.filter((a) => a.category === category);
}

export function getLanguageLabel(code) {
  const found = TRANSLATE_LANGUAGES.find((l) => l.code === code);
  return found ? found.defaultLabel : code;
}
