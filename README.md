# Ask Duck.ai

A polished, production-grade Firefox extension that lets you invoke **Duck.ai** on any selected webpage text — explain, translate, rewrite, analyze, research, and debug code directly from Firefox.

> **Not affiliated with DuckDuckGo.** This is an independent, open-source extension that uses Duck.ai's public web interface under the same terms as a regular visitor. See the [Disclaimer](#disclaimer) section.

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [How the Duck.ai Integration Works](#how-the-duckai-integration-works)
- [Project Structure](#project-structure)
- [Installation](#installation)
  - [Temporary install (for testing)](#temporary-install-for-testing)
  - [Permanent install (signed XPI)](#permanent-install-signed-xpi)
- [Development](#development)
- [Build Instructions](#build-instructions)
- [Usage](#usage)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Privacy](#privacy)
- [Permissions](#permissions)
- [Security Model](#security-model)
- [Localization](#localization)
- [Accessibility](#accessibility)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Disclaimer](#disclaimer)

## Features

- **Six action categories** with 50+ prebuilt actions:
  - 💭 Common Questions — TL;DR, ELI5, fact-check, debate, opinion
  - 🌍 Translate — 12 languages + custom language
  - 📄 Grammar Helper — correct, lengthen, shorten, formalize, rewrite, fix spelling
  - 🔍 Critical Thinking — assumptions, counterarguments, fallacies, new perspectives
  - 🖥 Code Helper — debug, improve, optimize, explain, convert, comment, security-check
  - 🥘 Chef Helper — recipes, substitutes, nutrition, food safety, vegetarian alternatives
  - 🔬 Research Helper — find sources, analyze data, deep dive, opposing views, evidence
- **Smart context detection** — automatically prioritizes the most relevant category based on what you selected (code, recipe, article, paragraph).
- **Floating selection button** — appears next to selected text; click it to open the action menu.
- **Right-click context menu** — full hierarchy: `Ask Duck.ai → Category → Action`.
- **Toolbar popup** — browse categories, run with default action, view history, jump to settings.
- **Response panel** — side panel with:
  - Streaming responses (live, token-by-token)
  - Markdown rendering (headings, lists, tables, blockquotes, links)
  - Fenced code blocks with per-block "Copy" button
  - Inline code styling
  - Copy response / Regenerate / New conversation / Open in Duck.ai
  - Loading and error states with friendly messages
- **Continue conversation** — ask follow-up questions; the assistant keeps context for the session.
- **Settings page** with tabs:
  - General — floating button, context menu, default action, default language, theme
  - AI — model, response length, temperature, timeout, connection test
  - Privacy — history toggle, history limits, clear history, clear all data, full data & permissions audit
  - Shortcuts — Firefox shortcut management instructions
  - About — integration documentation and disclaimer
- **Themes** — System / Light / Dark, with automatic OS preference detection.
- **Localization** — English and Arabic (with full RTL support). The UI is fully locale-aware via Firefox's `__MSG_*` system.
- **Privacy by default** — conversation history is **OFF** by default; no telemetry; selected text is sent only to `https://duck.ai/*`.
- **Manifest V3** with strict CSP, no `eval()`, no dynamic script execution, minimal permissions.

## How the Duck.ai Integration Works

**Duck.ai does not publish an official, documented public API** for browser extensions. This extension therefore talks to the **same public HTTP endpoints** the Duck.ai web app itself uses when you visit `https://duck.ai` in a browser.

The integration is fully isolated in [`src/services/duckai/`](src/services/duckai/):

```
src/services/duckai/
├── duckai-client.js   # HTTP + SSE transport
├── duckai-service.js  # Conversation state, retry, abort
└── models.js          # Model catalog (observed from the public web app)
```

### Protocol

1. **Get session token.** The extension performs `GET https://duck.ai/`. Duck.ai returns an anonymous session token in the `x-vqd-4` response header. This token is **not a user credential** — it is the same anonymous token the Duck.ai web app uses, and it is rotated by Duck.ai's server.

2. **Send chat request.** The extension POSTs to `https://duck.ai/chat` with:
   - Header `x-vqd-4: <token>`
   - JSON body `{ "model": "<id>", "messages": [...] }`

3. **Stream response.** Duck.ai responds with `text/event-stream` (Server-Sent Events). Each `data:` line contains a JSON object with a `message` field holding the cumulative assistant text. The extension streams chunks live into the response panel.

4. **Token caching.** The token is cached in memory for 30 minutes and invalidated on auth failure. **It is never persisted to disk.**

### Important caveats

- This integration is **UNOFFICIAL**. Duck.ai may change its protocol at any time. If that happens, only `src/services/duckai/` needs updating — the rest of the extension is provider-agnostic.
- No credentials, API keys, or personal information are sent.
- The extension does **not** impersonate DuckDuckGo or Duck.ai. The User-Agent is the browser's default.
- If Duck.ai is unreachable, the extension falls back to opening `https://duck.ai/` in a new tab with the prompt copied to the clipboard.

## Project Structure

```
duckai-assistant/
├── manifest.json              # Manifest V3, Firefox target
├── README.md
├── PRIVACY.md
├── LICENSE
├── _locales/
│   ├── en/messages.json       # English strings
│   └── ar/messages.json       # Arabic strings (RTL)
├── icons/                     # 16, 32, 48, 96, 128 PNG icons
├── docs/
│   └── ARCHITECTURE.md
└── src/
    ├── background/
    │   ├── service-worker.js  # Background entry; routes messages
    │   ├── context-menu.js    # Builds the right-click menu
    │   ├── commands.js        # Keyboard shortcut handler
    │   └── messaging.js       # Message type constants + helpers
    ├── content/
    │   ├── content-script.js  # Per-page entry; bridges background <-> UI
    │   ├── floating-button.js # The small "Ask Duck.ai" button near selections
    │   ├── response-panel.js  # The side panel UI (shadow DOM)
    │   └── content.css
    ├── popup/
    │   ├── popup.html
    │   ├── popup.css
    │   └── popup.js
    ├── options/
    │   ├── options.html
    │   ├── options.css
    │   └── options.js
    ├── services/
    │   ├── duckai/
    │   │   ├── duckai-client.js  # UNOFFICIAL Duck.ai HTTP/SSE client
    │   │   ├── duckai-service.js # Conversation state + retry
    │   │   └── models.js         # Model catalog
    │   ├── storage.js
    │   ├── settings.js
    │   ├── history.js
    │   └── error-handler.js
    ├── prompts/
    │   ├── prompt-builder.js  # Safe prompt construction (anti-injection)
    │   └── actions.js         # Action catalog
    ├── utils/
    │   ├── sanitize.js        # DOM + text sanitization
    │   ├── detect.js          # Content type detection
    │   ├── i18n.js            # Localization helpers
    │   ├── theme.js           # Theme application
    │   ├── markdown.js        # Minimal Markdown renderer
    │   └── helpers.js
    └── styles/
        └── shared.css
```

## Installation

### Temporary install (for testing)

Use this method to load the extension directly from source without signing it. Perfect for development and quick trials.

1. Open Firefox.
2. In the address bar, type `about:debugging` and press Enter.
3. In the left sidebar, click **This Firefox**.
4. Click the **Load Temporary Add-on…** button.
5. Select any file inside the `duckai-assistant/` folder — e.g. `manifest.json`.
6. The extension is now loaded. The Ask Duck.ai icon should appear in your toolbar.

> Temporary add-ons are removed when Firefox closes. To make the install permanent, see the next section.

### Permanent install (signed XPI)

To distribute the extension or install it permanently, it must be signed by Mozilla.

1. Build the package:
   ```bash
   cd duckai-assistant
   zip -r ../duckai-assistant-1.0.0.zip . -x "*.git*" "*.DS_Store"
   mv ../duckai-assistant-1.0.0.zip ../duckai-assistant-1.0.0.xpi
   ```
2. Submit the `.xpi` to <https://addons.mozilla.org/developers/>.
3. After Mozilla reviews and signs it, install from the Add-ons marketplace.

For self-distribution to a small audience, you can also use an **unlisted** signed XPI through the AMO developer hub.

## Development

### Requirements

- Firefox 115+ (ESR or current)
- No build step is required — the extension uses native ES modules and runs directly from source.
- Optional: Python 3 with Pillow if you want to regenerate icons (`scripts/make-icons.py`).

### Running locally

1. `git clone` this repository (or unzip the source).
2. Open `about:debugging` in Firefox → **This Firefox** → **Load Temporary Add-on…** → select `manifest.json`.
3. The extension loads. Use the toolbar icon, right-click selected text, or press `Ctrl+Shift+D`.

### Why the content script uses dynamic `import()`

Firefox loads manifest-declared content scripts as **classic scripts**, which means top-level `import`/`export` is not allowed. The extension works around this with a small bootstrap (`src/content/content-script.js`) that calls `import()` dynamically to load the real ES module (`src/content/content-main.js`). All module files needed by the content script are listed in `web_accessible_resources` in `manifest.json` so Firefox permits the dynamic import.

The background service worker and the popup/options pages use static imports normally, because:
- The background is declared with `"type": "module"` in the manifest.
- The popup/options HTML files use `<script type="module">`.

### Iterating

- Edit any file under `src/` or `_locales/`.
- In `about:debugging` → **This Firefox**, click **Reload** next to Ask Duck.ai.
- For content script changes, also reload the target webpage.

### Linting (optional)

The extension is written in vanilla ES2022+ JavaScript with JSDoc type annotations. To type-check:

```bash
# Install TypeScript once
npm install -g typescript

# Run a check
tsc --noEmit --allowJs --checkJs --target ES2022 --module ESNext \
    --moduleResolution bundler --strict \
    src/**/*.js
```

(Linting is optional — the extension runs without it.)

## Build Instructions

The extension has **no compile step** — what you see in `src/` is what runs in Firefox. To produce a distributable package:

```bash
# From the project root:
zip -r duckai-assistant-1.0.0.xpi . \
  -x "*.git*" "*.DS_Store" "*.swp" "node_modules/*" "scripts/*" "docs/*"

# Verify
unzip -l duckai-assistant-1.0.0.xpi | head
```

The `.xpi` is just a ZIP archive with the right structure. Mozilla signs it via AMO.

## Usage

### Basic flow

1. **Select text** on any webpage.
2. Either:
   - Wait for the **floating Duck.ai button** to appear, then click it; or
   - **Right-click** → **Ask Duck.ai** → choose a category → choose an action; or
   - Press **`Ctrl+Shift+D`** (or `Cmd+Shift+D` on macOS) to open with the default action; or
   - Click the **toolbar icon** to open the popup.
3. The **response panel** slides in from the right. The action selector is pre-populated based on what kind of content was detected.
4. Click **Run**. The response streams in live.
5. Use the toolbar at the top of the panel to:
   - Start a new conversation
   - Open Duck.ai in a new tab
   - Close the panel
6. Use the toolbar at the bottom of each assistant message to:
   - **Copy** the response
   - **Regenerate** the response
7. To **continue** the conversation, type a follow-up question in the composer at the bottom and press Enter (or click Send).

### Smart detection

The extension inspects the selected text and pre-selects the most relevant action category:

| Selected content looks like... | Pre-selected category |
|---|---|
| Source code | 🖥 Code Helper |
| A recipe | 🥘 Chef Helper |
| A long article | 🔬 Research Helper |
| A short paragraph | 📄 Grammar Helper |

You can always switch to any other category from the panel's action selector.

## Keyboard Shortcuts

| Action | Default |
|---|---|
| Open Duck.ai assistant with current selection | `Ctrl+Shift+D` (mac: `⌘+Shift+D`) |
| Open Duck.ai assistant settings | `Ctrl+Shift+Y` (mac: `⌘+Shift+Y`) |

To customize:

1. Open `about:addons`.
2. Click the gear icon → **Manage Extension Shortcuts**.
3. Find **Ask Duck.ai** and edit the shortcuts.

## Privacy

See [PRIVACY.md](PRIVACY.md) for the full privacy policy. Summary:

- Selected webpage text is sent **only** to `https://duck.ai/*`.
- No telemetry, no analytics, no third-party requests.
- Conversation history is **off by default**. When enabled, it is stored locally on your device only.
- The anonymous session token from Duck.ai is kept in memory and is never persisted.
- Settings are stored locally via `browser.storage.local`.
- You can clear all data from **Settings → Privacy → Clear all extension data**.

## Permissions

| Permission | Why |
|---|---|
| `contextMenus` | Adds the right-click "Ask Duck.ai" menu. |
| `storage` | Stores settings and (optionally) history locally. |
| `activeTab` | Reads the current tab's selection when you invoke the assistant. |
| `scripting` | Injects the content script on pages where it hasn't loaded yet (e.g. after SPA navigation). |
| `clipboardWrite` | Copies responses, code blocks, and prompts to the clipboard. |
| `notifications` | Reserved for optional status notifications. |
| `host: https://duck.ai/*` | Required to talk to Duck.ai. |

No other host permissions are requested. The extension does not access any other website's data.

## Security Model

- **Manifest V3** with strict Content Security Policy:
  ```
  script-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'
  ```
- No `eval()`, no dynamic `Function()`, no remote scripts.
- All HTML generated from AI responses is passed through a strict allowlist sanitizer (`src/utils/sanitize.js`) before insertion into the DOM.
- Selected webpage text is treated as **untrusted input** in prompts:
  - Sanitized (control chars stripped, Unicode normalized, bidi overrides removed, length capped).
  - Wrapped in clearly delimited `BEGIN/END UNTRUSTED WEBPAGE CONTENT` fences.
  - Assistant instructions are placed **before** the untrusted block so any "ignore previous instructions" inside the webpage text is interpreted as content, not as a command.
- The Duck.ai integration is isolated in `src/services/duckai/` so any future change to the protocol requires editing only that folder.
- The extension never impersonates DuckDuckGo or Duck.ai.

## Localization

The extension supports English (`en`) and Arabic (`ar`) out of the box. Arabic uses full RTL layout.

To add a new language:

1. Create `_locales/<code>/messages.json` (copy from `_locales/en/`).
2. Translate every `message` field.
3. Reload the extension. Firefox will pick up the new locale based on the user's browser language.

All UI strings use the `__MSG_key__` syntax in `manifest.json` and the `t('key')` helper in JavaScript.

## Accessibility

- Full keyboard navigation in popup, options, and response panel.
- ARIA roles: `dialog`, `tablist`, `tab`, `tabpanel`, `aria-live` for streaming responses.
- Visible focus outlines (`:focus-visible`).
- Sufficient color contrast in both light and dark themes.
- Respects `prefers-reduced-motion` — animations are disabled or shortened.
- RTL-aware layout for Arabic.

## Troubleshooting

**The floating button doesn't appear.**
- Make sure **Settings → General → Floating selection button** is on.
- Some pages (PDF viewer, internal Firefox pages, `about:*`) block content scripts. This is a Firefox limitation.

**Right-click menu is missing.**
- Make sure **Settings → General → Context menu** is on.
- The menu only appears when text is selected.

**Duck.ai returns an error.**
- Check your internet connection.
- Wait a few minutes — Duck.ai may be rate-limiting your session.
- Try the "Test connection" button in **Settings → AI**.
- As a fallback, use **Open in Duck.ai** to continue the conversation in a new tab.

**The response panel is empty.**
- Try a different model in **Settings → AI → Model**.
- Disable any aggressive privacy extensions (e.g. strict cookie blockers) that might block requests to `duck.ai`.

**Keyboard shortcuts don't work.**
- Another extension may have claimed the same shortcut. Reassign in `about:addons` → gear icon → **Manage Extension Shortcuts**.

## Contributing

Contributions are welcome. Please:

1. Open an issue describing the change you want to make.
2. Fork the repository and create a feature branch.
3. Make your changes. Keep the Duck.ai integration isolated in `src/services/duckai/`.
4. Test by loading as a temporary add-on in Firefox.
5. Submit a pull request.

Please do not introduce:
- Third-party dependencies (the extension is intentionally dependency-free).
- New host permissions (only `https://duck.ai/*` is allowed).
- Telemetry or analytics of any kind.
- Code that bypasses the sanitizer or prompt builder.

## License

MIT License. See [LICENSE](LICENSE).

## Disclaimer

This extension is **not affiliated with, endorsed by, or sponsored by DuckDuckGo**. "Duck.ai" and the DuckDuckGo name are trademarks of their respective owners. The extension uses Duck.ai's public web interface under the same terms as a regular visitor.

The extension does not:
- Impersonate DuckDuckGo or Duck.ai.
- Use any private or undocumented internal Duck.ai endpoint.
- Bypass authentication, rate limits, or access controls.
- Ship credentials, API keys, or tokens.

If DuckDuckGo publishes an official API in the future, the integration in `src/services/duckai/` should be updated to use it.
