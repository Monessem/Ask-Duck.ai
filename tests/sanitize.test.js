import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeHtml, isSafeUrl } from '../src/utils/sanitize.js';

test('safe schemes are accepted', () => {
  for (const url of ['https://a.test/x', 'http://a.test', 'mailto:a@b.test', '/relative', '#anchor']) {
    assert.equal(isSafeUrl(url), true, url);
  }
});

test('dangerous schemes are rejected', () => {
  const bad = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    '\u0001javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'about:blank'
  ];
  for (const url of bad) assert.equal(isSafeUrl(url), false, url);
});

test('non-strings and empty values are rejected', () => {
  for (const value of [null, undefined, 42, {}, '', '   ']) {
    assert.equal(isSafeUrl(value), false, String(value));
  }
});

test('embed schemes exclude mailto', () => {
  const embed = new Set(['http:', 'https:']);
  assert.equal(isSafeUrl('mailto:a@b.test', embed), false);
  assert.equal(isSafeUrl('https://a.test/i.png', embed), true);
});

test('escapeHtml neutralizes markup', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml(`"&'`), '&quot;&amp;&#39;');
  assert.equal(escapeHtml(null), '');
});
