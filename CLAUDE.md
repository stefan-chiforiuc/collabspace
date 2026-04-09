# CollabSpace v2 — Claude Code Project Guide

## Project Overview
CollabSpace v2 is a zero-infrastructure P2P collaboration PWA. Static site only, no custom servers. Full requirements in `requirements-v2.md`.

## Tech Stack
- **Framework:** SolidJS or Svelte 5
- **Networking:** Trystero (Nostr strategy) — zero-config P2P signaling
- **State Sync:** Yjs (CRDT)
- **Rich Text:** TipTap + Yjs binding
- **Styling:** UnoCSS or Tailwind CSS
- **Build:** Vite + vite-plugin-pwa
- **Testing:** Vitest + Playwright
- **Deployment:** GitHub Pages / Cloudflare Pages

## Agent System
This project uses a multi-agent workflow. Agents are in `.claude/agents/`:

| Agent | Role |
|-------|------|
| `project-manager` | Oversees all work, manages tasks, coordinates agents |
| `devils-advocate` | Challenges PM decisions, ensures sound reasoning |
| `architect` | Architecture oversight, security enforcement, credential scanning |
| `backend-expert` | P2P networking, Yjs state, PWA, service worker |
| `frontend-expert` | UI components, responsive layout, accessibility |
| `uiux-designer` | Design system, visual QA, UX flows |
| `qa-agent` | Testing, bug reports, performance/security testing |

## Memory System (Local Vector DB)
All agents share a **semantic memory database** at `.claude/memory-db/`. It uses:
- **Vectra** — local JSON-based vector DB (no server, pure JS)
- **Transformers.js** — local embeddings via `all-MiniLM-L6-v2` model (no API keys)

### Memory Commands
```bash
# Add a memory
node .claude/memory-db/memory-store.mjs add --type <type> --agent <agent> --content "..." --summary "..." --tags "t1,t2"

# Semantic search (natural language)
node .claude/memory-db/memory-store.mjs search --query "what framework?" --limit 5

# List with filters
node .claude/memory-db/memory-store.mjs list --type bug --agent qa-agent

# Update
node .claude/memory-db/memory-store.mjs update --id mem-xxx --status resolved

# Delete
node .claude/memory-db/memory-store.mjs delete --id mem-xxx

# Stats
node .claude/memory-db/memory-store.mjs summary

# Export
node .claude/memory-db/memory-store.mjs export --format json
```

### Memory Types
`decision`, `task`, `bug`, `design`, `security`, `architecture`, `feedback`, `requirement`, `release`, `context`

### Agent Rules for Memory
- **Before starting work**: search memory for relevant context (`search --query`)
- **After completing work**: add a memory summarizing what was done and any decisions made
- **When finding bugs**: add a `bug` memory before reporting to PM
- **When making decisions**: add a `decision` memory with rationale
- **When resolving issues**: update the memory status to `resolved`

## Key Commands (`.claude/commands/`)
- `/task-create` — Create a task
- `/task-update` — Update task status
- `/task-list` — View task board
- `/assign` — Assign task to agent
- `/consult-challenger` — Challenge a decision
- `/status-report` — Full project status
- `/release-notes` — Update release notes
- `/security-scan` — Scan for credentials/vulnerabilities
- `/arch-review` — Architecture compliance check
- `/design-review` — Visual QA review
- `/run-tests` — Execute test suite
- `/bug-report` — File a bug
- `/memory-add` — Store a memory in the vector DB
- `/memory-search` — Semantic search across memories
- `/memory-summary` — Memory database statistics

## Project Files
- `tasks.md` — Task board with status tracking
- `release-notes.md` — Completed work log
- `requirements-v2.md` — Full project requirements (source of truth)
- `.claude/memory-db/vectra-data/` — Vector memory database (auto-managed)

## Core Principles
1. **Zero custom servers** — Trystero + free public infrastructure only
2. **Static deployment** — Push to GitHub, done forever
3. **Leaderless CRDT** — Yjs handles all state sync, no host needed
4. **Ephemeral sessions** — Nothing persists after last peer leaves
5. **Radically simple** — 4-5 features done excellently
6. **PWA-first** — Installable, offline landing page

## Security Rules
- NEVER commit credentials, API keys, tokens, or secrets
- Sanitize all user input (especially chat markdown → HTML)
- Hash-based routing only (server never sees room IDs)
- No analytics, tracking, or cookies
- WebRTC DTLS encryption must be maintained
