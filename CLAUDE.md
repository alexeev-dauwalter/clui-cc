# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Clui CC — macOS-native Electron overlay (floating panel) wrapping `claude -p` CLI in a desktop chat UI with multi-tab sessions, permission approval, voice input, and a skills marketplace.

## Commands

```bash
npm run dev       # Dev mode with hot reload (electron-vite)
npm run build     # Production build (no packaging)
npm run dist      # Build + package as macOS .app → release/
npm run preview   # Preview built artifacts
npm run doctor    # Environment diagnostic (Claude CLI, Whisper, Node, Python)
```

Debug env vars: `CLUI_DEBUG=1` (verbose log to ~/.clui-debug.log), `CLUI_SPACES_DEBUG=1` (window/space transitions).

## Architecture

Three-process Electron model:

**Main process** (`src/main/`) — session lifecycle, subprocess management, permission hooks:
- `control-plane.ts` — single authority for tab lifecycle, state machine (connecting → idle → running → completed/failed/dead), request queue with backpressure (max 32), requestId deduplication
- `run-manager.ts` — spawns `claude -p --output-format stream-json` per prompt, manages stdio/stderr ring buffers
- `event-normalizer.ts` — stateless mapper: raw ClaudeEvent NDJSON → NormalizedEvent[]
- `hooks/permission-server.ts` — HTTP server on 127.0.0.1:19836 intercepting PreToolUse hooks; approves/denies Bash, Edit, Write, WebSearch; auto-approves safe read-only Bash commands; 5-min deny-by-default timeout; per-run tokens + per-launch app secret
- `stream-parser.ts` — line-by-line NDJSON parser with incomplete-line buffering
- `cli-env.ts` — discovers PATH from interactive login shell (nvm/asdf), removes CLAUDECODE env var from child processes
- `marketplace/catalog.ts` — fetches plugin metadata from 3 Anthropic GitHub repos, 5-min TTL cache
- `skills/installer.ts` — auto-installs bundled skills to ~/.claude/skills/, atomic install via tmp+rename

**Renderer** (`src/renderer/`) — React 19 + Zustand + Tailwind CSS 4:
- `stores/sessionStore.ts` — single Zustand store: tabs[], activeTabId, marketplace state, theme; all UI state flows through here
- `hooks/useClaudeEvents.ts` — subscribes to IPC events, RAF-batches text_chunk events to prevent render thrashing
- `hooks/useHealthReconciliation.ts` — polls tabHealth() every 1.5s to reconcile renderer with backend
- `theme.ts` — dual oklch palettes (dark/light), Zustand theme store, CSS custom properties sync (--clui-*)

**Preload** (`src/preload/index.ts`) — contextBridge exposing typed `window.clui` API (CluiAPI interface in shared/types.ts).

**Shared** (`src/shared/types.ts`) — discriminated union types for ClaudeEvent, NormalizedEvent, TabState, TabStatus, IPC channel definitions.

## Data Flow

1. User prompt → IPC → ControlPlane → RunManager spawns `claude -p` subprocess
2. NDJSON stdout → StreamParser → EventNormalizer → ControlPlane broadcasts via IPC
3. useClaudeEvents receives events → RAF-batches text chunks → dispatches to Zustand store → React re-renders
4. Tool calls trigger HTTP POST to PermissionServer → renderer shows PermissionCard → user Allow/Deny → HTTP response back to CLI

## Key Conventions

- **TypeScript strict mode** throughout; discriminated unions for all event types
- **Zustand narrow selectors** to prevent unnecessary re-renders (e.g., `useSessionStore(s => s.tabs.find(...))`)
- **No telemetry** — all data local; only outbound: raw.githubusercontent.com for marketplace catalog
- **macOS-specific**: NSPanel window (non-activating, joins all spaces), transparent + click-through toggling, global shortcut ⌥+Space
- **React 19 functional components** with hooks only; no class components
- **Tailwind 4** with Vite integration for styling; theme tokens via CSS custom properties prefixed `--clui-*`

## Stack

Electron 35 · React 19 · TypeScript 5.7 · Zustand 5 · Tailwind CSS 4.2 · Framer Motion 12 · electron-vite 3 · electron-builder 26 · node-pty 1.1
