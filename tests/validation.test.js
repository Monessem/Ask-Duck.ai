import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SETTINGS,
  LIMITS,
  sanitizeImportPayload,
  sanitizeSettingsPatch
} from '../src/services/validation.js';

test('settings patch drops unknown keys and wrong types', () => {
  const out = sanitizeSettingsPatch({
    theme: 'dark',
    autoSubmit: 'yes',
    __proto__: { polluted: true },
    unknownKey: 1
  });
  assert.deepEqual(out, { theme: 'dark' });
});

test('settings patch rejects values outside the enum', () => {
  assert.deepEqual(sanitizeSettingsPatch({ theme: 'neon' }), {});
  assert.deepEqual(sanitizeSettingsPatch({ displayMode: 'popup' }), {});
});

test('settings patch clamps integers and ignores NaN', () => {
  assert.deepEqual(sanitizeSettingsPatch({ historyMaxItems: 1 }), { historyMaxItems: 5 });
  assert.deepEqual(sanitizeSettingsPatch({ historyMaxItems: 10_000 }), {
    historyMaxItems: LIMITS.HISTORY_MAX_ITEMS
  });
  assert.deepEqual(sanitizeSettingsPatch({ historyMaxItems: '' }), {});
});

test('settings patch caps string length', () => {
  const out = sanitizeSettingsPatch({ defaultActionId: 'x'.repeat(500) });
  assert.equal(out.defaultActionId.length, LIMITS.ACTION_ID);
});

test('every default has a schema entry', () => {
  const patched = sanitizeSettingsPatch(DEFAULT_SETTINGS);
  assert.deepEqual(patched, DEFAULT_SETTINGS);
});

test('import payload rejects non-objects', () => {
  assert.throws(() => sanitizeImportPayload(null), /Invalid data format/);
  assert.throws(() => sanitizeImportPayload('{}'), /Invalid data format/);
  assert.throws(() => sanitizeImportPayload([]), /Invalid data format/);
});

test('import payload normalizes prompts and drops junk', () => {
  const out = sanitizeImportPayload({
    settings: { theme: 'light', nope: 1 },
    customPrompts: { 'common.eli5': '  explain  ', bad: 42 },
    userPrompts: [
      { label: ' L ', instruction: ' I ' },
      { label: '', instruction: 'no label' },
      'not an object'
    ],
    recentActions: ['a', 5, '', 'b']
  });

  assert.deepEqual(out.settings, { theme: 'light' });
  assert.deepEqual(out.customPrompts, { 'common.eli5': 'explain' });
  assert.deepEqual(out.userPrompts, [{ label: 'L', instruction: 'I' }]);
  assert.deepEqual(out.recentActions, ['a', 'b']);
});

test('import payload truncates oversized collections', () => {
  const many = Array.from({ length: LIMITS.USER_PROMPTS + 50 }, (_, i) => ({
    label: `l${i}`,
    instruction: 'x'.repeat(LIMITS.INSTRUCTION + 100)
  }));
  const out = sanitizeImportPayload({ userPrompts: many });
  assert.equal(out.userPrompts.length, LIMITS.USER_PROMPTS);
  assert.equal(out.userPrompts[0].instruction.length, LIMITS.INSTRUCTION);
});
