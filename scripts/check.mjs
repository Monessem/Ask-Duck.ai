#!/usr/bin/env node
/**
 * Static checks that replace a full linter setup for this
 * zero-dependency extension:
 *
 *   1. every JS file parses,
 *   2. every relative import resolves,
 *   3. every path referenced by the manifest exists,
 *   4. manifest and package.json versions agree,
 *   5. modules reachable from a content script are web-accessible,
 *   6. no debugger/eval/innerHTML-with-interpolation slips in.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const fail = (msg) => errors.push(msg);
const rel = (p) => path.relative(ROOT, p);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const jsFiles = walk(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'));
const toolingFiles = walk(path.join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs'));
const parseFiles = [...jsFiles, ...toolingFiles];

// ---- 1. syntax ----------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'askduckai-check-'));
for (const file of parseFiles) {
  const copy = path.join(tmp, 'check.mjs');
  fs.writeFileSync(copy, fs.readFileSync(file));
  try {
    execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' });
  } catch (e) {
    fail(`syntax error in ${rel(file)}\n${e.stderr?.toString().trim()}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });

// ---- 2. imports resolve -------------------------------------------
const IMPORT_RE = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;
function importsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  return [...src.matchAll(IMPORT_RE)].map((m) => path.resolve(path.dirname(file), m[1]));
}
for (const file of parseFiles) {
  for (const target of importsOf(file)) {
    if (!fs.existsSync(target)) fail(`${rel(file)} imports missing ${rel(target)}`);
  }
}

// ---- 3./4. manifest ------------------------------------------------
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  fail(`version mismatch: manifest ${manifest.version} vs package.json ${pkg.version}`);
}

const manifestPaths = [
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  ...(manifest.background?.scripts || []),
  manifest.background?.service_worker,
  ...(manifest.content_scripts || []).flatMap((cs) => cs.js || []),
  ...(manifest.web_accessible_resources || []).flatMap((war) => war.resources || [])
].filter(Boolean);
for (const p of manifestPaths) {
  if (!fs.existsSync(path.join(ROOT, p))) fail(`manifest references missing file: ${p}`);
}

// ---- 5. web-accessible closure -------------------------------------
const war = new Set((manifest.web_accessible_resources || []).flatMap((w) => w.resources || []));
const contentEntries = [...war].filter((r) => r.endsWith('.js')).map((r) => path.join(ROOT, r));
const seen = new Set();
const queue = [...contentEntries];
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file) || !fs.existsSync(file)) continue;
  seen.add(file);
  for (const target of importsOf(file)) {
    if (!war.has(rel(target))) {
      fail(`${rel(target)} is imported by web-accessible ${rel(file)} but is not in web_accessible_resources`);
    }
    queue.push(target);
  }
}

// ---- 6. banned patterns ---------------------------------------------
const BANNED = [
  [/\beval\s*\(/, 'eval()'],
  [/new\s+Function\s*\(/, 'new Function()'],
  [/\bdebugger\b/, 'debugger statement'],
  [/\.innerHTML\s*=\s*[`'"][^`'"]*\$\{/, 'innerHTML with interpolation']
];
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  src.split('\n').forEach((line, i) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
    for (const [re, label] of BANNED) {
      if (re.test(line)) fail(`${rel(file)}:${i + 1} uses ${label}`);
    }
  });
}

if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`✓ checks passed (${parseFiles.length} JS files)`);
