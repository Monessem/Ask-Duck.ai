# Privacy Policy — Ask Duck.ai

**Last updated:** 2026-08-14

This document explains, in plain language, what data the Ask Duck.ai extension processes, where it goes, and how you can control it.

## TL;DR

- The extension sends your **selected webpage text** to **Duck.ai only** — when and only when you trigger an action.
- **No telemetry, no analytics, no third-party requests.**
- Conversation history is **off by default**. When you enable it, it stays on your device.
- An anonymous session token is fetched from Duck.ai at runtime and kept in memory only — it is never written to disk.
- You can clear all data at any time from **Settings → Privacy**.

## What data is processed

### 1. Selected webpage text

- **What:** the text you highlight on a webpage before invoking the assistant.
- **Where it goes:** sent only to `https://duck.ai/*` as part of a chat prompt.
- **When:** only when you explicitly trigger an action (right-click menu, floating button, keyboard shortcut, or popup).
- **How long retained by Duck.ai:** governed by Duck.ai's own privacy policy. The extension has no control over Duck.ai's retention.
- **Sanitization:** before being sent, the text is sanitized — control characters, zero-width characters, and Unicode bidi overrides are stripped, and the text is capped at 12,000 characters.

### 2. Action choice

- **What:** which action you picked (e.g. "Explain like I'm five", "Translate to French").
- **Where it goes:** incorporated into the prompt sent to Duck.ai.
- **Local processing:** the action label is also used locally to render the user message bubble in the response panel.

### 3. Conversation history (optional)

- **What:** the prompts and responses exchanged during a session.
- **Where it stays:** on your device, via `browser.storage.local`. Never uploaded.
- **Default:** OFF.
- **Limit:** you can configure the maximum number of stored conversations (default: 50).
- **Clearing:** Settings → Privacy → Clear conversation history.

### 4. Settings

- **What:** your preferences (theme, model, language, etc.).
- **Where:** on your device, via `browser.storage.local`. Never uploaded.

### 5. Anonymous Duck.ai session token

- **What:** an anonymous token returned by Duck.ai in the `x-vqd-4` HTTP response header.
- **Where:** in-memory only. Never written to disk, never sent anywhere except back to `https://duck.ai/*`.
- **Lifetime:** cached for 30 minutes; discarded on extension reload or browser restart.
- **Not a credential:** the token does not identify you and is rotated by Duck.ai.

## What data is NOT processed

- Browsing history.
- Page contents beyond the text you explicitly select.
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
| `notifications` | Reserved for optional status notifications (not currently used). |
| `host: https://duck.ai/*` | Required to talk to Duck.ai. |

The extension does **not** request:
- `<all_urls>` host permission (we use `activeTab` + `scripting` instead).
- `webRequest` or `webRequestBlocking`.
- `tabs` (we only need the active tab via `activeTab`).
- `cookies`.
- `history` or `bookmarks`.
- Any access to other websites' data.

## Data flow

```
User selects text on webpage
        │
        ▼
User invokes an action
        │
        ▼
Content script reads selection (activeTab permission)
        │
        ▼
Background service builds a safe prompt
        │
        ▼
Background service sends HTTPS POST to https://duck.ai/chat
        │
        ▼
Duck.ai streams response back
        │
        ▼
Response panel renders it (sanitized)
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
