# CollabSpace v2 — Task Board

## Legend
- `new` — Not started
- `working:<agent>` — In progress by named agent
- `review` — Awaiting review
- `done` — Completed

---

## Milestone M1 — Walking Skeleton

| ID | Title | Status | Agent | Priority | Milestone | Notes |
|----|-------|--------|-------|----------|-----------|-------|
| T-001 | Project scaffolding (Vite + SolidJS/Svelte + TypeScript) | new | backend-expert | must | M1 | Init repo, Vite config, PWA plugin, Tailwind/UnoCSS |
| T-002 | Trystero P2P networking setup | new | backend-expert | must | M1 | Nostr strategy, room creation, peer lifecycle |
| T-003 | Yjs document structure + sync over Trystero | new | backend-expert | must | M1 | Full Y.Doc schema per requirements |
| T-004 | Room code generation (adjective-noun-NNNN) | new | backend-expert | must | M1 | Human-readable, unguessable |
| T-005 | Landing page (create/join room) | new | frontend-expert | must | M1 | One-click create, join by code or link |
| T-006 | Room view + participant list | new | frontend-expert | must | M1 | Names, colors, status indicators |
| T-007 | Basic chat over Yjs | new | backend-expert | must | M1 | Messages in Y.Array, system messages |
| T-008 | Chat UI component | new | frontend-expert | must | M1 | Message list, input, sender info |
| T-009 | Design system + tokens | new | uiux-designer | must | M1 | Colors, typography, spacing, component specs |
| T-010 | PWA manifest + service worker | new | backend-expert | must | M1 | vite-plugin-pwa config, offline landing |
| T-011 | Static deployment setup (GitHub Pages) | new | backend-expert | must | M1 | GitHub Actions workflow |
| T-012 | Initial security review + .gitignore | new | architect | must | M1 | Ensure no credentials, proper gitignore |

## Milestone M2 — Core Features

| ID | Title | Status | Agent | Priority | Milestone | Notes |
|----|-------|--------|-------|----------|-----------|-------|
| T-013 | Polls — backend logic (create/vote/close) | new | backend-expert | must | M2 | Y.Map operations per FR-03 |
| T-014 | Polls — UI component | new | frontend-expert | must | M2 | Creation form, voting, results bar chart |
| T-015 | Planning Poker — backend logic | new | backend-expert | must | M2 | Vote/reveal/reset, card sets, consensus calc |
| T-016 | Planning Poker — UI component | new | frontend-expert | must | M2 | Card selection, reveal animation, results |
| T-017 | Shared Timer — backend + UI | new | backend-expert | should | M2 | Synced countdown, presets, alerts |
| T-018 | Quick Reactions + Raise Hand | new | frontend-expert | should | M2 | Transient reactions, persistent raise hand |
| T-019 | Polls + Poker design specs | new | uiux-designer | must | M2 | Detailed component designs |

## Milestone M3 — Collaborative Editing

| ID | Title | Status | Agent | Priority | Milestone | Notes |
|----|-------|--------|-------|----------|-----------|-------|
| T-020 | TipTap notepad + Yjs collaboration | new | backend-expert | must | M3 | FR-05, collaborative editing |
| T-021 | Notepad UI + multi-cursor awareness | new | frontend-expert | must | M3 | Cursor display, formatting toolbar |
| T-022 | Export functionality (Markdown, JSON, text) | new | backend-expert | should | M3 | Chat, polls, poker, notepad export |
| T-023 | Notepad design spec | new | uiux-designer | must | M3 | Editor chrome, toolbar, cursor styles |

## Milestone M4 — Polish

| ID | Title | Status | Agent | Priority | Milestone | Notes |
|----|-------|--------|-------|----------|-----------|-------|
| T-024 | Mobile-optimized UI | new | frontend-expert | must | M4 | 360px+ responsive, bottom nav |
| T-025 | Accessibility audit + fixes | new | frontend-expert | should | M4 | WCAG 2.1 AA compliance |
| T-026 | Optional room passwords | new | backend-expert | could | M4 | Client-side password check |
| T-027 | E2E test suite (Playwright) | new | qa-agent | should | M4 | Full feature coverage |
| T-028 | Performance audit | new | qa-agent | should | M4 | Bundle size, FMP, network throttling |
| T-029 | Final security audit | new | architect | must | M4 | Full credential + vulnerability scan |
| T-030 | Visual QA pass | new | uiux-designer | should | M4 | Full design compliance review |
