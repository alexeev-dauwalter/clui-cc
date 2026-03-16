# Clui CC — Command Line User Interface for Claude Code

A lightweight, transparent desktop overlay for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) on macOS. Clui CC wraps the Claude Code CLI in a floating pill interface with multi-tab sessions, a permission approval UI, voice input, and a skills marketplace.

## Demo

[![Watch the demo](https://img.youtube.com/vi/NqRBIpaA4Fk/maxresdefault.jpg)](https://www.youtube.com/watch?v=NqRBIpaA4Fk)

<p align="center"><a href="https://www.youtube.com/watch?v=NqRBIpaA4Fk">▶ Watch the full demo on YouTube</a></p>

## Features

- **Floating overlay** — transparent, click-through window that stays on top. Toggle with `Alt+Space`.
- **Multi-tab sessions** — each tab spawns its own `claude -p` process with independent session state.
- **Permission approval UI** — intercepts tool calls via PreToolUse HTTP hooks so you can review and approve/deny from the UI.
- **Conversation history** — browse and resume past Claude Code sessions.
- **Skills marketplace** — install plugins from Anthropic's GitHub repos without leaving Clui CC.
- **Voice input** — local speech-to-text via Whisper (no cloud transcription).
- **File & screenshot attachments** — paste images or attach files directly.
- **Dual theme** — dark/light mode with system-follow option.

## Quick Start (Recommended)

Copy and run these commands one at a time:

```bash
git clone https://github.com/lcoutodemos/clui-cc.git
cd clui-cc
./start.command
```

`start.command` runs environment checks first and prints exact fix commands if something is missing. If checks pass, it installs dependencies, builds, and launches the app.

To close the app:

```bash
./stop.command
```

You can also double-click `start.command` and `stop.command` from Finder.

Toggle the overlay: **Alt+Space** (or **Cmd+Shift+K** as fallback).

## Prerequisites (Detailed)

You need **macOS 13+**. Then install these one at a time — copy each command and paste it into Terminal.

**Step 1.** Install Xcode Command Line Tools (needed to compile native modules):

```bash
xcode-select --install
```

**Step 2.** Install Node.js (recommended: current LTS such as 20 or 22; minimum supported: 18). Download from [nodejs.org](https://nodejs.org), or use Homebrew:

```bash
brew install node
```

Verify it's on your PATH:

```bash
node --version
```

**Step 3.** Make sure Python has `setuptools` (needed by the native module compiler). On Python 3.12+ this is missing by default:

```bash
python3 -m pip install --upgrade pip setuptools
```

**Step 4.** Install Claude Code CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

**Step 5.** Authenticate Claude Code (follow the prompts that appear):

```bash
claude
```

**Step 6.** Verify Claude Code is working (should print `2.1.x` or higher):

```bash
claude --version
```

**Optional:** Install Whisper for voice input:

```bash
brew install whisper-cli
```

> **No API keys or `.env` file required.** Clui CC uses your existing Claude Code CLI authentication (Pro/Team/Enterprise subscription).

## Development

### Hot Reload

If you are actively developing:

```bash
npm install
```

```bash
npm run dev
```

Renderer changes update instantly. Main-process changes require restarting `npm run dev`.

### Production Build

```bash
npm run build
```

```bash
npx electron .
```

## Architecture

Clui CC is an Electron app with three layers:

```
┌─────────────────────────────────────────────────┐
│  Renderer (React 19 + Zustand + Tailwind CSS 4) │
│  Components, theme, state management             │
├─────────────────────────────────────────────────┤
│  Preload (window.clui bridge)                    │
│  Secure IPC surface between renderer and main    │
├─────────────────────────────────────────────────┤
│  Main Process                                    │
│  ControlPlane → RunManager → claude -p (NDJSON)  │
│  PermissionServer (HTTP hooks on 127.0.0.1)      │
│  Marketplace catalog (GitHub raw fetch + cache)   │
└─────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full deep-dive.

## Project Structure

```
src/
├── main/                   # Electron main process
│   ├── claude/             # ControlPlane, RunManager, EventNormalizer
│   ├── hooks/              # PermissionServer (PreToolUse HTTP hooks)
│   ├── marketplace/        # Plugin catalog fetching + install
│   ├── skills/             # Skill auto-installer
│   └── index.ts            # Window creation, IPC handlers, tray
├── renderer/               # React frontend
│   ├── components/         # TabStrip, ConversationView, InputBar, etc.
│   ├── stores/             # Zustand session store
│   ├── hooks/              # Event listeners, health reconciliation
│   └── theme.ts            # Dual palette + CSS custom properties
├── preload/                # Secure IPC bridge (window.clui API)
└── shared/                 # Canonical types, IPC channel definitions
```

## How It Works

1. Each tab creates a `claude -p --output-format stream-json` subprocess.
2. NDJSON events are parsed by `RunManager` and normalized by `EventNormalizer`.
3. `ControlPlane` manages tab lifecycle (connecting → idle → running → completed/failed/dead).
4. Tool permission requests arrive via HTTP hooks to `PermissionServer` (localhost only).
5. The renderer polls backend health every 1.5s and reconciles tab state.
6. Sessions are resumed with `--resume <session-id>` for continuity.

## Network Behavior

Clui CC operates almost entirely offline. The only outbound network calls are:

| Endpoint | Purpose | Required |
|----------|---------|----------|
| `raw.githubusercontent.com/anthropics/*` | Marketplace catalog (cached 5 min) | No — graceful fallback |
| `api.github.com/repos/anthropics/*/tarball/*` | Skill auto-install on startup | No — skipped on failure |

No telemetry, analytics, or auto-update mechanisms. All core Claude Code interaction goes through the local CLI.

## Troubleshooting

**`npm install` fails with "gyp" or "make" errors**

Install Xcode Command Line Tools, then retry:

```bash
xcode-select --install
```

```bash
npm install
```

**`npm install` fails with `ModuleNotFoundError: No module named 'distutils'`**

Python 3.12+ removed `distutils`. Install `setuptools` to restore it:

```bash
python3 -m pip install --upgrade pip setuptools
```

```bash
npm install
```

If that still fails, install Python 3.11 and point npm to it:

```bash
brew install python@3.11
```

```bash
npm config set python $(brew --prefix python@3.11)/bin/python3.11
```

```bash
npm install
```

To undo the Python override later:

```bash
npm config delete python
```

**`npm install` fails with `fatal error: 'functional' file not found`**

Your C++ headers are broken. This usually means Xcode Command Line Tools need to be reinstalled.

First, check if they're installed:

```bash
xcode-select -p
```

```bash
xcrun --sdk macosx --show-sdk-path
```

If either command fails, or the error persists, reinstall them:

```bash
sudo rm -rf /Library/Developer/CommandLineTools
```

```bash
xcode-select --install
```

Then retry:

```bash
npm install
```

**`npm install` fails on `node-pty`**

`node-pty` is a native macOS module. It does not build on Linux or Windows. Make sure you have Xcode CLT and Python setuptools installed (see above).

**App launches but no Claude response**

Make sure the CLI is installed and authenticated:

```bash
claude --version
```

```bash
claude
```

**`Alt+Space` doesn't toggle the overlay**

Grant Accessibility permissions: System Settings → Privacy & Security → Accessibility. You can also try the fallback shortcut **Cmd+Shift+K**.

**Marketplace shows "Failed to load"**

This is normal when offline. The marketplace needs internet to fetch the catalog. All core features work without it.

**Window is invisible / no UI**

Try **Cmd+Shift+K** as an alternative toggle. Check if the app is running in the menu bar tray.

**Still stuck?**

Run the environment doctor to see what's wrong:

```bash
npm run doctor
```

This prints pass/fail for every dependency without changing anything on your system.

## Tested On

| Component | Version |
|-----------|---------|
| macOS | 15.x (Sequoia) |
| Node.js | 20.x LTS, 22.x |
| Python | 3.12 (with setuptools installed) |
| Electron | 33.x |
| Claude Code CLI | 2.1.71 |

## Known Limitations

- **macOS only** — transparent overlay, tray icon, and node-pty are macOS-specific. Windows/Linux support is not currently implemented.
- **Requires Claude Code CLI** — Clui CC is a UI layer, not a standalone AI client. You need an authenticated `claude` CLI.
- **Permission mode** — uses `--permission-mode default`. The PTY interactive transport is legacy and disabled by default.

## License

[MIT](LICENSE)
