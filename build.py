#!/usr/bin/env python3
"""
Build script for Ask Duck.ai — generates Chromium and Firefox packages.

Usage:
  python3 build.py              # Build both
  python3 build.py chromium     # Build Chromium only
  python3 build.py firefox      # Build Firefox only

Output:
  build/chromium/               # Chromium build directory
  build/firefox/                # Firefox build directory
  ask-duckai-chromium-<ver>.zip # Chromium package
  ask-duckai-firefox-<ver>.zip  # Firefox package
"""

import os
import shutil
import json
import zipfile
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.join(ROOT, 'build')
SRC_DIR = os.path.join(ROOT, 'src')
LOCALES_DIR = os.path.join(ROOT, '_locales')
ICONS_DIR = os.path.join(ROOT, 'icons')
DOCS_DIR = os.path.join(ROOT, 'docs')

EXCLUDE = {
    '.git', '.gitignore', '.DS_Store', 'node_modules', 'build',
    'scripts', '*.swp', '*.zip', '*.xpi', '.env', 'package-lock.json',
    '*.py', 'manifest.chromium.json'
}

def should_exclude(name):
    for ex in EXCLUDE:
        if ex.startswith('*'):
            if name.endswith(ex[1:]):
                return True
        elif name == ex:
            return True
    return False

def copy_tree(src, dst):
    if not os.path.exists(dst):
        os.makedirs(dst)
    for item in os.listdir(src):
        if should_exclude(item):
            continue
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            copy_tree(s, d)
        else:
            shutil.copy2(s, d)

def replace_firefox_mentions(chromium_dir):
    """
    Replace 'Firefox' with 'browser extension' in the Chromium build.
    Only modifies files in the Chromium build directory.
    """
    replacements = [
        ('Firefox extension', 'browser extension'),
        ('Firefox Extension', 'Browser Extension'),
        ('Firefox Add-ons', 'Chrome Web Store'),
        ('Firefox manages keyboard shortcuts', 'The browser manages keyboard shortcuts'),
        ('Firefox MV3', 'MV3'),
        ('about:addons', 'chrome://extensions'),
        ('about:debugging', 'chrome://extensions'),
        ('addons.mozilla.org/firefox/addon/duckai-assistant/', 'chromewebstore.google.com'),
        ('from Firefox to', 'from your browser to'),
        ('open-source Firefox extension', 'open-source browser extension'),
        ('a Firefox extension', 'a browser extension'),
        ('critical for Firefox MV3', 'critical for MV3'),
        ('directly from Firefox', 'directly from your browser'),
        ('Firefox shortcut management', 'browser shortcut management'),
        ("Firefox's `__MSG_*` system", 'the browser `__MSG_*` system'),
        ('Manifest V3, Firefox target', 'Manifest V3, Chromium target'),
        ('Open Firefox.', 'Open your browser.'),
        ('click **This Firefox**', 'click **Extensions**'),
        ('This Firefox → **Load Temporary Add-on…**', 'Extensions → **Load unpacked**'),
        ('Load Temporary Add-on…', 'Load unpacked'),
        ('select `manifest.json`', 'select the build folder'),
        ('Temporary add-ons are removed when Firefox closes', 'Unpacked extensions are removed when the browser closes'),
        ('Firefox 115+', 'Chrome 110+ / Edge 110+ / Opera 96+'),
        ('Firefox loads manifest-declared', 'The browser loads manifest-declared'),
        ('so Firefox permits', 'so the browser permits'),
        ('Firefox target', 'Chromium target'),
        ('in Firefox', 'in your browser'),
        ('by Firefox', 'by the browser'),
        ('Firefox will pick up', 'The browser will pick up'),
        ('Firefox limitation', 'browser limitation'),
        ('internal Firefox pages', 'internal browser pages'),
        ('in Firefox.', 'in your browser.'),
        ('Firefox Browser', 'Browser'),
        ('unloaded by Firefox', 'unloaded by the browser'),
        ("Firefox's `__MSG_key__`", 'the browser `__MSG_key__`'),
        ('runs in Firefox', 'runs in the browser'),
        ('temporary add-on in Firefox', 'unpacked extension in your browser'),
        ('**This Firefox**', '**Extensions**'),
        ('This Firefox', 'Extensions'),
    ]
    
    for root, dirs, files in os.walk(chromium_dir):
        for file in files:
            if file.endswith(('.js', '.html', '.css', '.json', '.md')):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    modified = False
                    for old, new in replacements:
                        if old in content:
                            content = content.replace(old, new)
                            modified = True
                    
                    if modified:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                except Exception as e:
                    print(f"  Warning: could not process {file_path}: {e}")

def build_chromium():
    print("Building Chromium version...")
    chromium_dir = os.path.join(BUILD_DIR, 'chromium')
    
    chromium_manifest_src = os.path.join(ROOT, 'manifest.chromium.json')
    chromium_manifest_content = None
    if os.path.exists(chromium_manifest_src):
        with open(chromium_manifest_src) as f:
            chromium_manifest_content = f.read()
    
    if os.path.exists(chromium_dir):
        shutil.rmtree(chromium_dir)
    os.makedirs(chromium_dir)
    
    copy_tree(SRC_DIR, os.path.join(chromium_dir, 'src'))
    copy_tree(LOCALES_DIR, os.path.join(chromium_dir, '_locales'))
    copy_tree(ICONS_DIR, os.path.join(chromium_dir, 'icons'))
    
    if os.path.exists(DOCS_DIR):
        copy_tree(DOCS_DIR, os.path.join(chromium_dir, 'docs'))
    
    for f in ['LICENSE', 'README.md', 'PRIVACY.md', 'CHANGELOG.md']:
        src_file = os.path.join(ROOT, f)
        if os.path.exists(src_file):
            shutil.copy2(src_file, os.path.join(chromium_dir, f))
    
    if chromium_manifest_content:
        with open(os.path.join(chromium_dir, 'manifest.json'), 'w') as f:
            f.write(chromium_manifest_content)
    
    print("  Replacing Firefox mentions with browser extension...")
    replace_firefox_mentions(chromium_dir)
    
    manifest_path = os.path.join(chromium_dir, 'manifest.json')
    with open(manifest_path) as f:
        manifest = json.load(f)
    version = manifest['version']
    
    zip_name = f'ask-duckai-chromium-{version}.zip'
    zip_path = os.path.join(ROOT, zip_name)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(chromium_dir):
            for file in files:
                if should_exclude(file):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, chromium_dir)
                zf.write(file_path, arcname)
    
    print(f"  ✓ Chromium build: {chromium_dir}")
    print(f"  ✓ Chromium zip: {zip_path}")
    return zip_path

def build_firefox():
    print("Building Firefox version...")
    firefox_dir = os.path.join(BUILD_DIR, 'firefox')
    
    if os.path.exists(firefox_dir):
        shutil.rmtree(firefox_dir)
    os.makedirs(firefox_dir)
    
    for item in os.listdir(ROOT):
        if should_exclude(item) or item == 'build':
            continue
        s = os.path.join(ROOT, item)
        d = os.path.join(firefox_dir, item)
        if os.path.isdir(s):
            copy_tree(s, d)
        else:
            shutil.copy2(s, d)
    
    manifest_path = os.path.join(firefox_dir, 'manifest.json')
    with open(manifest_path) as f:
        manifest = json.load(f)
    version = manifest['version']
    
    zip_name = f'ask-duckai-firefox-{version}.zip'
    zip_path = os.path.join(ROOT, zip_name)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(firefox_dir):
            for file in files:
                if should_exclude(file):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, firefox_dir)
                zf.write(file_path, arcname)
    
    print(f"  ✓ Firefox build: {firefox_dir}")
    print(f"  ✓ Firefox zip: {zip_path}")
    return zip_path

def main():
    target = sys.argv[1] if len(sys.argv) > 1 else 'all'
    
    if target in ('all', 'chromium'):
        build_chromium()
    if target in ('all', 'firefox'):
        build_firefox()
    
    print("\nDone!")

if __name__ == '__main__':
    main()
