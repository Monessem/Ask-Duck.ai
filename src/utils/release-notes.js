/**
 * Release notes — short, localized changelog entries per version.
 * ------------------------------------------------------------------
 * Used by the popup to display a one-time banner when the extension
 * is updated to a newer version. The banner is shown only once per
 * version (tracked via storage.local key `lastSeenRelease`).
 *
 * Format:
 *   { version: { title: { en, ar }, body: { en, ar } } }
 *
 * Only include the most recent versions (last ~5).
 * Keep body text short — it appears in a compact banner.
 */

export const RELEASE_NOTES = {
  '5.9.14': {
    title: {
      en: 'Updated to v5.9.14',
      ar: 'تم التحديث إلى v5.9.14'
    },
    body: {
      en: 'Published privacy policy. Major memory optimization — removed all polling intervals, debounced observers.',
      ar: 'تم نشر سياسة الخصوصية. تحسين كبير للذاكرة — إزالة كل polling intervals، وdebounce للمراقبين.'
    }
  },
  '5.9.13': {
    title: {
      en: 'Updated to v5.9.13',
      ar: 'تم التحديث إلى v5.9.13'
    },
    body: {
      en: 'Fixed Firefox warning about scripting API. All browser.scripting references now use dynamic property access.',
      ar: 'إصلاح تحذير فايرفوكس عن scripting API. كل مراجع browser.scripting تستخدم وصولاً ديناميكياً للخصائص.'
    }
  },
  '5.9.12': {
    title: {
      en: 'Updated to v5.9.12',
      ar: 'تم التحديث إلى v5.9.12'
    },
    body: {
      en: 'Bulletproof floating button: idempotent registration, inject into ALL tabs, retry logic. Detailed error reporting.',
      ar: 'زر عائم مضاد للأعطال: تسجيل idempotent، حقن في كل التبويبات، إعادة محاولة. تقارير أخطاء تفصيلية.'
    }
  },
  '5.9.11': {
    title: {
      en: 'Updated to v5.9.11',
      ar: 'تم التحديث إلى v5.9.11'
    },
    body: {
      en: 'Critical fix: floating button now works on Chrome! Auto-injects into active tab after permission grant — no refresh needed.',
      ar: 'إصلاح جوهري: الزر العائم يشتغل الآن على كروم! يُحقن تلقائياً في التبويب النشط بعد منح الصلاحية — بدون الحاجة لتحديث الصفحة.'
    }
  },
  '5.9.10': {
    title: {
      en: 'Updated to v5.9.10',
      ar: 'تم التحديث إلى v5.9.10'
    },
    body: {
      en: 'Fixed: floating button now registers correctly. Fixed: test connection error. Arabic RTL detection for Duck.ai responses.',
      ar: 'إصلاح: تسجيل الزر العائم يعمل الآن. إصلاح: خطأ اختبار الاتصال. كشف تلقائي للعربية واتجاه RTL لردود Duck.ai.'
    }
  },
  '5.9.9': {
    title: {
      en: 'Updated to v5.9.9',
      ar: 'تم التحديث إلى v5.9.9'
    },
    body: {
      en: 'Fixed: floating button now activates correctly on Chrome. New onboarding page on first install.',
      ar: 'إصلاح: الزر العائم يتفعّل الآن بشكل صحيح على كروم. صفحة ترحيب جديدة عند أول تثبيت.'
    }
  },
  '5.9.8': {
    title: {
      en: 'Updated to v5.9.8',
      ar: 'تم التحديث إلى v5.9.8'
    },
    body: {
      en: 'Critical fix: floating button now activates correctly on Chrome. Fixed showStatus error in options page.',
      ar: 'إصلاح جوهري: الزر العائم يتفعّل الآن بشكل صحيح على كروم. إصلاح خطأ showStatus في صفحة الإعدادات.'
    }
  },
  '5.9.7': {
    title: {
      en: 'Updated to v5.9.7',
      ar: 'تم التحديث إلى v5.9.7'
    },
    body: {
      en: 'Floating button now works on Chrome — grants site access on first use. Settings toggle controls it.',
      ar: 'زر الإجراءات العائم يشتغل الآن على كروم — يطلب صلاحية الوصول للمواقع عند أول استخدام. تحكّم كامل من الإعدادات.'
    }
  },
  '5.9.6': {
    title: {
      en: 'Updated to v5.9.6',
      ar: 'تم التحديث إلى v5.9.6'
    },
    body: {
      en: 'Chrome Web Store ready — no more broad host permission warning. Cross-browser tab scripting via activeTab.',
      ar: 'جاهز للرفع على Chrome Web Store — اتشال تحذير أذونات المضيف الواسعة. حقن متعدد المتصفحات عبر activeTab.'
    }
  },
  '5.9.5': {
    title: {
      en: 'Updated to v5.9.5',
      ar: 'تم التحديث إلى v5.9.5'
    },
    body: {
      en: 'Uniform category cards, one-time update banner, cleaner code, security hardening.',
      ar: 'كروت فئات موحَّدة الحجم، إشعار تحديث يظهر مرّة واحدة، كود أنظف، وتحسينات أمنية.'
    }
  },
  '5.9.4': {
    title: {
      en: 'Updated to v5.9.4',
      ar: 'تم التحديث إلى v5.9.4'
    },
    body: {
      en: 'RTL improvements, popup polish, smart detection refinements.',
      ar: 'تحسينات دعم الكتابة من اليمين، تحسينات البوب‑أب، وتحسينات الكشف الذكي.'
    }
  },
  '5.9.3': {
    title: {
      en: 'Updated to v5.9.3',
      ar: 'تم التحديث إلى v5.9.3'
    },
    body: {
      en: 'Cross-browser (Firefox + Chromium), smart context detection, AMO compliance.',
      ar: 'دعم متصفّحات متعدّدة (فايرفوكس + كروميوم)، كشف ذكي للسياق، وتوافق مع AMO.'
    }
  }
};

/**
 * Get the release notes for a specific version, in the user's locale.
 * Falls back to English if the locale is not available.
 *
 * @param {string} version
 * @param {string} [locale='en'] - e.g. 'en', 'ar'
 * @returns {{title: string, body: string}|null}
 */
export function getReleaseNotes(version, locale = 'en') {
  const notes = RELEASE_NOTES[version];
  if (!notes) return null;
  const lang = (locale || 'en').startsWith('ar') ? 'ar' : 'en';
  return {
    title: notes.title[lang] || notes.title.en,
    body: notes.body[lang] || notes.body.en
  };
}
