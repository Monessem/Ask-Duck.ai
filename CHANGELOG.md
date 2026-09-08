# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.9.0] — 2026-09-08

### Security
- Background and content script now reject runtime messages that do not come from this extension or carry an unknown type.
- Page-level actions ask for confirmation before the page text is sent to Duck.ai, and `PRIVACY.md` now describes that flow.
- HTML sanitizer switched from a scheme blocklist to an allowlist (`http:`, `https:`, `mailto:`; `src` is limited to http/https), applied after stripping control characters.
- Imported backup files and settings patches go through a schema (`src/services/validation.js`): unknown keys dropped, types enforced, strings and lists capped.
- Page title, URL and description are sanitized, length-capped, and fenced in the prompt as data rather than instructions.
- `web_accessible_resources` reduced to the modules the content script actually loads.
- `notifications` permission removed (it was unused).

### Fixed
- Chromium: `chrome.*` is aliased to `browser.*` by `src/platform/polyfill.js`, which now actually loads in every context — the extension was broken on Chromium.
- Custom prompt context-menu entries were registered as `user-user-<id>` and always failed with "Unknown user prompt".
- Popup window fallback no longer reads `screen`, which does not exist in a service worker.
- Pending prompts are written through a queue (no lost entries), expire after 10 minutes, are capped at 20, and are purged by an alarm instead of a timer that a suspended worker never runs.
- Duck.ai tab reuse picks the most recently accessed tab instead of an arbitrary one.
- `historyMaxItems` no longer stores `NaN` when the field is cleared.

### Changed
- The Duck.ai injector polls only for a bounded window after a prompt arrives, and mutation-driven direction updates are coalesced per frame.
- Console logging is off by default behind a `DEBUG` flag.
- Dead code removed: `src/background/commands.js`, `src/content/floating-button.js`, `src/content/sidebar.js`, and the committed `.xpi`/`.zip`/`.crx` artifacts.
- Packaging is now `node scripts/build.mjs`, producing `dist/askduckai-<version>.xpi` and `dist/ask-duckai-chromium-<version>.zip` from an explicit file list with a per-target manifest.
- Added `npm run lint` (`scripts/check.mjs`) and `npm test` (`node --test`), both run in CI on every push and pull request.

## [1.0.0] — 2026-08-14

### Added
- Initial release.
- Six action categories: Common Questions, Translate, Grammar Helper, Critical Thinking, Code Helper, Chef Helper, Research Helper.
- 50+ prebuilt AI actions.
- Smart content-type detection (code, recipe, article, paragraph).
- Floating selection button next to selected text.
- Full right-click context menu hierarchy.
- Toolbar popup with categories, history, and shortcuts.
- Side response panel with streaming, Markdown rendering, code blocks, copy buttons.
- Continue-conversation support with follow-up questions.
- Settings page with General / AI / Privacy / Shortcuts / About tabs.
- Themes: System / Light / Dark with OS preference detection.
- Localization: English and Arabic (RTL).
- Manifest V3 with strict CSP.
- Isolated Duck.ai integration module (unofficial, public endpoints).
- Privacy-by-default: history off, no telemetry, single-host permission.
- Keyboard shortcuts: `Ctrl+Shift+D` (open assistant), `Ctrl+Shift+Y` (open settings).
- Accessibility: keyboard nav, ARIA, focus management, reduced-motion support.
- README, PRIVACY, LICENSE, ARCHITECTURE docs.
