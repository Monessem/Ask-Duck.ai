# Privacy Policy — Ask Duck.ai

**Last updated:** 2026-09-08

This document explains, in plain language, what data the Ask Duck.ai extension processes, where it goes, and how you can control it.

## TL;DR

- The extension sends your **selected webpage text** to **Duck.ai only** — when and only when you trigger an action.
- The page-level actions ("Send this page", "Summarize this page") send the **visible text of the page**, and always ask for your confirmation first.
- **No telemetry, no analytics, no third-party requests.**
- Conversation history is **off by default**. When you enable it, it stays on your device.
- The prompt is delivered by opening Duck.ai in a tab and filling the chat box — the extension holds no account and no API key.
- You can clear all data at any time from **Settings → Privacy**.

## What data is processed

### 1. Selected webpage text

- **What:** the text you highlight on a webpage before invoking the assistant.
- **Where it goes:** sent only to `https://duck.ai/*` as part of a chat prompt.
- **When:** only when you explicitly trigger an action (right-click menu, floating button, keyboard shortcut, or popup).
- **How long retained by Duck.ai:** governed by Duck.ai's own privacy policy. The extension has no control over Duck.ai's retention.
- **Sanitization:** before being sent, the text is sanitized — control characters, zero-width characters, and Unicode bidi overrides are stripped, and the text is capped at 12,000 characters.

### 2. Page text (page-level actions only)

- **What:** the page title, URL, meta description and up to 6,000 characters of the page's visible text.
- **When:** only for the page-level actions, and only after you accept the confirmation dialog that states how much text will be sent.
- **Where it goes:** into the prompt opened in Duck.ai, nowhere else.
- **Sanitization:** same treatment as a selection, and the page content is fenced in the prompt as data rather than instructions.

### 3. Action choice

- **What:** which action you picked (e.g. "Explain like I'm five", "Translate to French").
- **Where it goes:** incorporated into the prompt sent to Duck.ai.
- **Local processing:** the action label is also used locally to render the user message bubble in the response panel.

### 4. Conversation history (optional)

- **What:** the prompts and responses exchanged during a session.
- **Where it stays:** on your device, via `browser.storage.local`. Never uploaded.
- **Default:** OFF.
- **Limit:** you can configure the maximum number of stored conversations (default: 50).
- **Clearing:** Settings → Privacy → Clear conversation history.

### 5. Settings

- **What:** your preferences (theme, model, language, etc.).
- **Where:** on your device, via `browser.storage.local`. Never uploaded.

### 6. Pending prompt

- **What:** the prompt awaiting delivery to a Duck.ai tab.
- **Where:** `browser.storage.local`, keyed by a random id passed in the tab's URL fragment.
- **Lifetime:** deleted as soon as the Duck.ai tab consumes it, and in any case after 10 minutes; at most 20 prompts are kept.

## What data is NOT processed

- Browsing history.
- Page contents, unless you select text or confirm a page-level action.
- Form inputs, cookies, or local storage of any website.
- Your DuckDuckGo account (the extension does not use accounts; Duck.ai itself is anonymous).
- Telemetry, analytics, crash reports, or usage statistics.
- Third-party services — there are none.

## Permissions

| Permission | Why |
|---|---|
| `contextMenus` | Adds the right-click "Ask Duck.ai" menu. |
| `storage` | Stores settings and (optionally) history locally. |
| `activeTab` | Reads the current tab's selection when you invoke the assistant. |
| `scripting` | Injects the content script on pages where it hasn't loaded yet. |
| `clipboardWrite` | Copies responses, code blocks, and prompts to the clipboard. |
| `tabs` | Finds or opens the Duck.ai tab the prompt is delivered to. |
| `downloads` | Saves the settings/prompts backup file you export. |
| `alarms` | Purges expired pending prompts from local storage. |
| `host: https://duck.ai/*` | Required to open and drive Duck.ai. |

The content script is declared for all sites (`<all_urls>` under `content_scripts`) because the selection button and the right-click actions must work on any page. It only reads a selection or page text when you invoke an action; nothing is read or sent in the background.

The extension does **not** request:
- `webRequest` or `webRequestBlocking`.
- `cookies`.
- `history` or `bookmarks`.
- Any host permission other than `https://duck.ai/*`.

## Data flow

```
User selects text (or confirms a page-level action)
        │
        ▼
User invokes an action
        │
        ▼
Content script reads the selection / page text
        │
        ▼
Background builds a sanitized prompt and stores it locally
        │
        ▼
Background opens https://duck.ai/#p=<id>
        │
        ▼
Injector fills the prompt into the Duck.ai chat box and deletes it from storage
        │
        ▼
(Optional) Conversation saved to local storage
```

No step in this flow sends data anywhere except `https://duck.ai/*`.

## How to clear your data

| Action | Where |
|---|---|
| Clear conversation history | Settings → Privacy → Clear conversation history |
| Clear all extension data (settings + history) | Settings → Privacy → Clear all extension data |
| Disable history collection | Settings → Privacy → Store conversation history locally (toggle off) |
| Remove the extension entirely | about:addons → Ask Duck.ai → Remove |

Removing the extension deletes all locally stored data automatically.

## Children's privacy

The extension does not knowingly collect any personal data from anyone, including children. Duck.ai itself is governed by DuckDuckGo's privacy policy.

## Changes to this policy

Material changes will be noted in the project's CHANGELOG and reflected in the "Last updated" date above.

## Contact

For privacy questions or concerns, please open an issue in the project's source repository.
