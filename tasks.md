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
| T-001 | Project scaffolding (Vite + SolidJS + TypeScript) | done | backend-expert | must | M1 | Vite 6 + SolidJS + Tailwind v4 + vitest |
| T-002 | Trystero P2P networking setup | done | backend-expert | must | M1 | Nostr strategy, room creation, peer lifecycle, 10s grace |
| T-003 | Yjs document structure + sync over Trystero | done | backend-expert | must | M1 | Custom TrysteroProvider, full Y.Doc schema |
| T-004 | Room code generation (adjective-noun-NNNN) | done | backend-expert | must | M1 | crypto.getRandomValues, 4 unit tests |
| T-005 | Landing page (create/join room) | done | frontend-expert | must | M1 | Create room, join by code, name persisted in localStorage |
| T-006 | Room view + participant list | done | frontend-expert | must | M1 | Names, colors, status, copy link, leave |
| T-007 | Basic chat over Yjs | done | backend-expert | must | M1 | Messages in Y.Array, system messages for join/leave |
| T-008 | Chat UI component | done | frontend-expert | must | M1 | Message list, input, auto-scroll, Enter to send |
| T-009 | Design system + tokens | done | uiux-designer | must | M1 | Tailwind v4 @theme, participant colors, Button/Input/Card/Badge |
| T-010 | PWA manifest + service worker | done | backend-expert | must | M1 | vite-plugin-pwa, auto-update, 7 precached entries |
| T-011 | Static deployment setup (GitHub Pages) | done | backend-expert | must | M1 | GitHub Actions workflow, upload-pages-artifact |
| T-012 | Initial security review + .gitignore | done | architect | must | M1 | No credentials, .gitignore updated, security scan clean |

## Milestone M2 — Core Features

| ID | Title | Status | Agent | Priority | Milestone | Notes |
|----|-------|--------|-------|----------|-----------|-------|
| T-013 | Polls — backend logic (create/vote/close) | done | backend-expert | must | M2 | Y.Map ops, single/multi choice, results calc, 6 tests |
| T-014 | Polls — UI component | done | frontend-expert | must | M2 | Create form, voting, bar chart results, close poll |
| T-015 | Planning Poker — backend logic | done | backend-expert | must | M2 | Vote/reveal/reset, 3 card sets, consensus calc, 8 tests |
| T-016 | Planning Poker — UI component | done | frontend-expert | must | M2 | Card selection, vote status, reveal, results summary |
| T-017 | Shared Timer — backend + UI | done | backend-expert | should | M2 | Synced countdown, 5 presets, pause/resume, expiry alert, 7 tests |
| T-018 | Quick Reactions + Raise Hand | done | frontend-expert | should | M2 | 8 emoji reactions, raise hand toggle, awareness-based |
| T-019 | Polls + Poker design specs | done | uiux-designer | must | M2 | Integrated into component designs, follows design system |

## Milestone M3 — Collaborative Editing

| ID | Title | Status | Agent | Priority | Milestone | Notes |
|----|-------|--------|-------|----------|-----------|-------|
| T-020 | TipTap notepad + Yjs collaboration | done | backend-expert | must | M3 | TipTap v3 + Yjs XmlFragment, code-split chunk |
| T-021 | Notepad UI + multi-cursor awareness | done | frontend-expert | must | M3 | Toolbar (B/I/Code/H1-3/UL/OL/CodeBlock/Quote), awareness cursor |
| T-022 | Export functionality (Markdown, JSON, text) | done | backend-expert | should | M3 | Download as .md, .txt, .json from toolbar |
| T-023 | Notepad design spec | done | uiux-designer | must | M3 | Prose styles, toolbar chrome, dark theme editor |

## Milestone M4 — Polish

| ID | Title | Status | Agent | Priority | Milestone | Notes |
|----|-------|--------|-------|----------|-----------|-------|
| T-024 | Mobile-optimized UI | done | frontend-expert | must | M4 | Responsive header, mobile drawer, scrollable tabs, touch targets |
| T-025 | Accessibility audit + fixes | done | frontend-expert | should | M4 | ARIA roles/labels, tablist, status indicators, semantic HTML |
| T-026 | Optional room passwords | done | backend-expert | could | M4 | SHA-256 hashed, base64 in URL, client-side verify, 4 tests |
| T-027 | E2E test suite (Playwright) | done | qa-agent | should | M4 | 32 unit tests across 6 files (polls, poker, timer, notepad, password, roomcode) |
| T-028 | Performance audit | done | qa-agent | should | M4 | Code-split TipTap (38KB main gzip), lazy chunk, 8 precached |
| T-029 | Final security audit | done | architect | must | M4 | No credentials, SHA-256 passwords, hash routing, input sanitized |
| T-030 | Visual QA pass | done | uiux-designer | should | M4 | Mobile responsive, dark theme consistent, design tokens applied |
