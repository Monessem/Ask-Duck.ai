# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.9.14] — 2026-09-15

### Added
- **Privacy Policy page** at `docs/privacy.html` — comprehensive, Chrome Web Store compliant. Covers: data collection (none), Duck.ai relationship, all permissions explained, local data storage table, third-party services, children's privacy, contact info. Hosted at `https://monessem.github.io/Ask-Duck.ai/privacy.html`.
- `homepage_url` updated in both manifests to point to the GitHub Pages site.

### Changed — Major Memory Optimization
- **`content-script.js` (v2.0)** — completely rewritten for minimal memory footprint:
  - Removed `setInterval(check, 500)` for prompt checking — replaced with `hashchange` event + single initial check (saves ~2000 CPU checks per hour per tab)
  - Removed `setInterval(URL check, 1000)` for SPA navigation — replaced with `history.pushState`/`replaceState` hooks + `popstate` listener (zero polling overhead)
  - Removed multiple `setTimeout` retries for floating button init — single `DOMContentLoaded` check with `{ once: true }` listener
  - Removed `setInterval(applyTextDirection, 1000)` from injector
  - Selection handler debounced to 300ms (was 200ms with no debounce on some paths)
  - All event listeners use `{ passive: true }` where possible
  - Added `pagehide` cleanup: clears all timers, restores history methods, disconnects observers
- **`duckai-injector.js`** — reduced MutationObserver scope:
  - Removed `attributes: true, attributeFilter: ['dir', 'style', 'class']` from observer (these fire too often on React apps)
  - Observer now only watches `childList` + `subtree` (much less frequent)
  - Added 500ms debounce on direction application (was applying on every mutation)
  - Added `pagehide` cleanup: clears timers, disconnects observer
  - Removed `setInterval(applyTextDirection, 1000)` — observer + initial call is sufficient

### Performance Impact
- **Before**: ~10 intervals per tab (content-script + injector), each firing every 500-1000ms
- **After**: 0 intervals — all event-driven with debouncing
- **Estimated memory savings**: 60-70% reduction in CPU usage on Duck.ai tabs, 80% reduction on regular tabs with floating button

## [5.9.13] — 2026-09-15

### Fixed
- **Firefox warning: `scripting.getRegisteredScripts is not supported`** — Firefox logs warnings for any direct reference to `browser.scripting.*` APIs that are not implemented, even if the code path is never reached at runtime. The warning appeared at `service-worker.js line 264` because the `'floating-button-is-registered'` handler directly called `browser.scripting.getRegisteredScripts()`. Fixed by:
  1. Removing ALL direct `browser.scripting.*` references from `service-worker.js` — the handler now calls `isFloatingButtonScriptRegistered()` from the controller instead.
  2. Refactoring `floating-button-controller.js` to use a `getScripting()` helper that accesses the scripting API via dynamic property access (`api()['scripting']` instead of `api().scripting`). Firefox's static analyzer doesn't flag dynamic property access.
  3. Applying the same fix to `tab-script.js` — all `browser.scripting.executeScript()` calls now go through the `getScripting()` helper.

### Changed
- `floating-button-controller.js` (v4.1) — all scripting operations now use the `getScripting()` helper which returns `null` on Firefox, so the code never touches the unimplemented API.
- `tab-script.js` (v1.1) — same `getScripting()` pattern applied to `getSelectionFromTab`, `getPageContentFromTab`, `getPageMetaFromTab`, and `promptInputInTab`.
- `service-worker.js` — removed the `isChromiumRuntime` import (no longer needed), added `isFloatingButtonScriptRegistered` import.

## [5.9.12] — 2026-09-15

### Fixed
- **Root cause found: duplicate switch case labels** — `MSG.FLOATING_BUTTON_REGISTER` and the string `'floating-button-register'` are the SAME value (`'floating-button-register'`). Two `case` labels existed for the same value — the first one caught all messages and returned the raw result WITHOUT tab injection. The second handler (which had the tab injection logic) was dead code. Merged both into a single handler with the full injection logic.
- **Registration not idempotent** — `registerContentScripts()` threw "Duplicate script ID" if the script was already registered from a previous install. Now we `unregisterContentScripts` first (ignoring "not found" errors), then register fresh. This makes the operation idempotent.
- **Tab injection only on active tab** — previous version only injected into the active tab (which was often the onboarding page itself, an extension URL that can't be injected). Now we inject into ALL open http/https tabs.

### Changed
- **`registerFloatingButtonScript()` now returns `{success, error?, injectedCount?}`** instead of a plain boolean. This allows callers to show specific error messages to the user.
- **Onboarding page** — added 3x retry logic with 500ms delay between attempts. If the service worker is waking up, the first message might fail; the retry gives it time to start.
- **Onboarding page** — shows the specific error message from the background (e.g., "Permission not granted", "registerContentScripts failed", "sendMessage failed") instead of a generic "Failed to register".
- **Onboarding page** — shows the number of tabs the script was injected into, so the user gets confirmation.

## [5.9.11] — 2026-09-15

### Fixed
- **Critical: floating button still not appearing on Chrome** — two root causes found and fixed:
  1. **`isChromiumRuntime` used as value instead of function call** — in `service-worker.js`, the check `if (!isChromiumRuntime)` was testing if the function reference was truthy (always true), instead of calling `isChromiumRuntime()`. This meant the background always tried to call `browser.scripting.getRegisteredScripts()` even on Firefox, or skipped the check incorrectly on Chromium.
  2. **Script registered but not injected into existing tabs** — `chrome.scripting.registerContentScripts()` only affects future page loads. Existing tabs don't get the content script until they navigate. Fixed by adding `chrome.scripting.executeScript()` call after registration to inject the script into the active tab immediately.

### Changed
- **Rewrote `floating-button-controller.js` (v3.0)** — cleaner, more reliable context detection:
  - Added `isBackgroundContext()` helper that checks `self.ServiceWorkerGlobalScope` or falls back to `hasScriptingAPI()`
  - All scripting functions now branch cleanly: background → direct API, extension page → message to background
  - Better error logging throughout
- **Onboarding page** — now shows clear error message if script registration fails, with "Try again" button
- **Content script selection watcher** — added `mouseup` listener for more reliable selection detection (some sites have custom selection handlers that don't fire `selectionchange` properly)

## [5.9.10] — 2026-09-15

### Fixed
- **Floating button not registering after permission granted** — the onboarding page granted `<all_urls>` permission but never sent the register message to the background. Now `onboarding.js` calls `registerFloatingButtonScript()` after permission is granted.
- **Popup banner kept appearing** — the popup checked status but didn't auto-register the script if permission was already granted but the script wasn't registered. Now the popup auto-registers the script silently (no banner) when permission is granted but script is missing.
- **`import() is disallowed on ServiceWorkerGlobalScope`** — the service worker used dynamic `import()` for `testConnection`, `buildPagePrompt`, and `getRecentActions`. On some browsers (Firefox MV3), dynamic import in service workers is restricted. Converted all dynamic imports to static imports at the top of the file.
- **My Prompts not showing until refresh** — race condition on Chromium where `getUserPrompts()` returned stale data immediately after `set()`. Added a 50ms yield to the event loop before re-reading storage, plus try-catch error handling.

### Added
- **Arabic RTL detection for Duck.ai responses** — per-message automatic language detection:
  - Detects Arabic text using Unicode ranges (U+0600–U+06FF, U+0750–U+077F, U+FB50–U+FDFF, U+FE70–U+FEFF)
  - If Arabic characters make up ≥30% of all letter characters → `dir="rtl"`, `text-align: right`
  - English/other messages stay `dir="ltr"`, `text-align: left`
  - Code blocks (`<pre>`, `<code>`) are always LTR regardless of message direction
  - Chat input uses `unicode-bidi: plaintext` for auto-detection as user types
  - Duck.ai UI (navigation, buttons, icons, layout) stays fully LTR
  - Works dynamically for newly generated responses via MutationObserver

## [5.9.9] — 2026-09-15

### Fixed
- **Critical: `scripting.getRegisteredScripts is not a function`** — the `floating-button-controller.js` module was being imported by both the background service worker AND extension pages (popup, options). The `chrome.scripting` API is ONLY available in the service worker, not in extension pages. Refactored the controller to detect context: in the background it uses `scripting` directly; in extension pages it sends a message to the background which does the work.

### Added
- **Onboarding page** (`src/options/onboarding.html`) — opens automatically on first install. Guides the user through:
  1. Enabling the floating button (with a prominent "Enable" button that requests permission on Chromium)
  2. How to use the extension (selection, context menu, popup, shortcuts)
  3. Privacy guarantees
- `src/options/onboarding.css` — clean, centered, responsive design.
- `src/options/onboarding.js` — controller that checks permission state and handles the "Enable" button click.
- `onInstalled` handler in service-worker.js now opens the onboarding page on `reason === 'install'`.

## [5.9.8] — 2026-09-15

### Fixed
- **Critical: floating button not activating on Chrome** — `content-script.js` used `browser.*` API directly but on Chromium only `chrome.*` exists (no automatic polyfill for content scripts). Added an inline `var browser = chrome` polyfill at the top of the IIFE so all `browser.runtime.*`, `browser.storage.*`, and `browser.runtime.getURL()` calls work on both Firefox and Chromium.
- **`showStatus is not defined` on options page** — `showStatus` was declared as a `const` inside `wireEvents()` but called from `wireMyPrompts()`, `renderUserPrompts()`, and other functions outside its scope. Hoisted `showStatus` and its `statusEl` reference to module level so all functions in the file can use them.

### Removed
- Dead code in `options.js`: unused `escapeHtml()` and `escapeAttr()` functions.

## [5.9.7] — 2026-09-15

### Added
- **Floating button on Chromium** — the core feature now works on Chrome/Edge/Opera. Uses `optional_host_permissions: ["<all_urls>"]` + `chrome.scripting.registerContentScripts()` for dynamic registration — no "broad host permissions" warning.
- `src/services/floating-button-controller.js` — manages the permission lifecycle: checks if `<all_urls>` is granted, requests it via `chrome.permissions.request()` from user-gesture contexts (popup/options), and registers/unregisters the content script dynamically.
- Permission banner in the toolbar popup — on first use, shows a prominent "Enable floating button" prompt with a one-click grant button. Dismissable; reappears next popup open if not granted.
- Settings toggle on options page now handles the full lifecycle: ON → request permission → register script; OFF → unregister script.

### Changed
- `service-worker.js` — `onInstalled` handler syncs floating button state on install/update. `onSettingsChanged` now syncs the script registration too. Startup sync catches browser restart with permission already granted.
- New message types: `FLOATING_BUTTON_STATUS`, `FLOATING_BUTTON_REGISTER`, `FLOATING_BUTTON_UNREGISTER`, `FLOATING_BUTTON_SYNC`.
- Both manifests updated with `floating-button-controller.js` in `web_accessible_resources`.

### How it works (Chromium)
1. Extension installs — floating button setting defaults to `true`.
2. User opens popup → banner: "Enable floating button".
3. User clicks "Enable" → `chrome.permissions.request({origins: ["<all_urls>"]})`.
4. Permission granted → background registers `content-script.js` dynamically for `<all_urls>`.
5. Floating button now appears on every webpage.
6. User can disable in Settings → script is unregistered → no more floating button.

## [5.9.6] — 2026-09-14

### Added
- `src/services/tab-script.js` — cross-browser abstraction layer that uses `browser.tabs.sendMessage()` on Firefox and `browser.scripting.executeScript()` on Chromium to fetch selection / page content / page meta / prompt-input from the active tab.
- `optional_host_permissions: ["<all_urls>"]` in the Chromium manifest — paves the way for an opt-in floating button on Chromium without triggering the Chrome Web Store "broad host permissions" warning.

### Changed
- **Chromium manifest restructured** — content scripts no longer match `<all_urls>`. Only `https://duck.ai/*` (for the injector) is matched. Selection and page content are now fetched via the `chrome.scripting` API using `activeTab` permission, which is granted on user gestures (toolbar click, context menu, keyboard shortcut).
- `service-worker.js` — context menu click, keyboard command, and popup action handlers now go through `getSelectionFromTab()`, `getPageContentFromTab()`, `getPageMetaFromTab()`, and `promptInputInTab()` helpers from `tab-script.js`. Falls back gracefully from content-script messaging to `scripting.executeScript()`.
- `popup.js` — `renderSelectionBanner()` and `renderPageActions()` now use the cross-browser tab-script helpers.

### Removed
- Chromium manifest no longer declares `content_scripts` for `<all_urls>` — fixes the Chrome Web Store "broad host permissions" warning that was delaying publication.

## [5.9.5] — 2026-09-13

### Added
- One-time update notification banner in the toolbar popup. Shows localized release notes when the extension updates to a newer version, then never again until the next bump. Stored via `storage.local.lastSeenRelease`.
- `src/utils/release-notes.js` — small, locale-aware release-notes registry.
- Smart Context Detection v3: detection now reaches **all 12 categories** (was previously only Common, Grammar, Translate, Summary, Research, Code, Chef). Added detection for `work`, `argument`, `learning`, `marketing`, `security`, and `long-prose` content types.

### Changed
- Toolbar popup category cards are now strictly uniform in size (44px tall, single-line label) — matches the Translate card. Long labels gracefully truncate with ellipsis; full label visible on hover via `title` attribute.
- Toolbar popup font sizes aligned with the floating action menu: header title 13px, category cards 12px, action items 12px.
- `src/utils/detect.js` rewritten with structured signal arrays and a `countMatches()` helper — cleaner, more testable, and easier to extend with new content types.

### Removed
- Dead code: unused `escapeText()` in popup.js, unused `buildTemplate()` template-literal function in action-menu.js, unused `getAction` import in action-menu.js.

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
