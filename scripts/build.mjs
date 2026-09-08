#!/usr/bin/env node
/**
 * Build the distributable packages.
 *
 *   node scripts/build.mjs            -> both targets
 *   node scripts/build.mjs firefox    -> dist/askduckai-<version>.xpi
 *   node scripts/build.mjs chrome     -> dist/ask-duckai-chromium-<version>.zip
 *
 * Only the files listed in INCLUDE are packaged, so build output,
 * tooling and docs can never leak into a release archive. The manifest
 * is rewritten per target: Firefox MV3 wants `background.scripts`,
 * Chromium wants `background.service_worker`.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// Directories and files that make up the extension itself.
const INCLUDE = ['manifest.json', 'LICENSE', 'PRIVACY.md', '_locales', 'icons', 'src'];

function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
}

function firefoxManifest(manifest) {
  return manifest;
}

function chromeManifest(manifest) {
  const out = { ...manifest };
  // Chromium only accepts a single service worker module.
  out.background = { service_worker: manifest.background.scripts[0], type: 'module' };
  delete out.browser_specific_settings;
  return out;
}

const TARGETS = {
  firefox: { dir: 'firefox', ext: 'xpi', name: (v) => `askduckai-${v}.xpi`, manifest: firefoxManifest },
  chrome: { dir: 'chrome', ext: 'zip', name: (v) => `ask-duckai-chromium-${v}.zip`, manifest: chromeManifest }
};

function copyInto(stageDir) {
  for (const entry of INCLUDE) {
    const from = path.join(ROOT, entry);
    if (!fs.existsSync(from)) throw new Error(`Missing packaged path: ${entry}`);
    fs.cpSync(from, path.join(stageDir, entry), { recursive: true });
  }
}

function build(targetName, version) {
  const target = TARGETS[targetName];
  const stage = path.join(DIST, target.dir);
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });

  copyInto(stage);
  fs.writeFileSync(
    path.join(stage, 'manifest.json'),
    JSON.stringify(target.manifest(readManifest()), null, 2) + '\n'
  );

  const archive = path.join(DIST, target.name(version));
  fs.rmSync(archive, { force: true });
  // -X drops platform extra fields so archives are reproducible.
  execFileSync('zip', ['-q', '-r', '-X', archive, '.'], { cwd: stage });
  return archive;
}

const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = requested.length ? requested : Object.keys(TARGETS);
for (const name of targets) {
  if (!TARGETS[name]) {
    console.error(`Unknown target: ${name} (expected: ${Object.keys(TARGETS).join(', ')})`);
    process.exit(1);
  }
}

const version = readManifest().version;
fs.mkdirSync(DIST, { recursive: true });
for (const name of targets) {
  const archive = build(name, version);
  console.log(`${name}: ${path.relative(ROOT, archive)} (${fs.statSync(archive).size} bytes)`);
}
