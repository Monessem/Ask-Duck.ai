import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_SELECTION_LENGTH,
  sanitizeSelection
} from '../src/prompts/prompt-builder.js';

test('control characters and bidi overrides are stripped', () => {
  assert.equal(sanitizeSelection('a\u0000b\u202Ec'), 'abc');
  assert.equal(sanitizeSelection('a\u200Bb\uFEFF'), 'ab');
});

test('whitespace is normalized', () => {
  assert.equal(sanitizeSelection('  a\r\n\r\n\r\nb  '), 'a\n\nb');
});

test('long selections are truncated', () => {
  const out = sanitizeSelection('x'.repeat(MAX_SELECTION_LENGTH + 500));
  assert.ok(out.length <= MAX_SELECTION_LENGTH + 20);
  assert.ok(out.endsWith('[...truncated]'));
});

test('empty input yields an empty string', () => {
  assert.equal(sanitizeSelection(''), '');
  assert.equal(sanitizeSelection(null), '');
});
