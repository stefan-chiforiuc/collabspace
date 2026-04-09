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
| `code-reviewer` | Reviews code, runs QA pipeline, auto-commits when all checks pass |

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

## Git Flow (MANDATORY for all agents)

All agents MUST use git-flow. Never commit directly to `main` or `develop`.

### Branch Model
```
main          ← production releases only
develop       ← integration branch, all features merge here
feature/*     ← agent work branches: feature/<agent>/<task-id>-<desc>
release/*     ← release prep branches
hotfix/*      ← urgent fixes from main
```

### Agent Workflow (PR-Based)
```
1. /git-start <agent> <task-id> "<desc>"     — Create feature branch
2. Work, commit frequently on the feature branch
3. /review-and-commit                         — Run QA checks, commit, create PR
4. /pr-review <PR-number>                     — PM + Architect review the PR
5. If approved → PR merged to develop
6. /git-release start <version>               — Create release branch
7. /git-release finish <version>              — Merge to main (triggers deploy)
8. /test-live                                 — Verify the live deployment
```

**Important:** Features are NEVER merged directly. All merges happen via reviewed Pull Requests.

### PR Checks (run automatically via GitHub Actions)
1. **Type check** — `npx tsc -b`
2. **Tests** — `npx vitest run`
3. **Build** — `npm run build`
4. **Bundle size** — check against 200KB budget

### Git Flow Commands
- `/git-start` — Create feature branch for an agent + task
- `/git-finish` — Push branch and create a Pull Request
- `/git-sync` — Rebase current branch onto develop
- `/git-status` — Show all branches and working tree
- `/git-release` — Start/finish release branches
- `/pr-review` — PM + Architect review a PR (approve/reject/merge)
- `/resolve-conflicts` — Intelligent conflict resolution
- `/pre-merge-check` — Run validation suite manually

### Conflict Resolution Rules
- NEVER delete functionality — keep additions from both sides
- Combine imports, keep all new functions, merge config carefully
- Validate with tests after resolving
- Escalate to PM if >5 files conflict or architecture-critical files are involved

## All Commands (`.claude/commands/`)

**Task Management:**
`/task-create`, `/task-update`, `/task-list`, `/assign`, `/status-report`, `/release-notes`

**Git Flow:**
`/git-start`, `/git-finish`, `/git-sync`, `/git-status`, `/git-release`, `/resolve-conflicts`, `/pre-merge-check`

**Deployment:**
- Live app: `https://stefan-chiforiuc.github.io/collabspace/`
- Deploy triggers on push to `main` via `.github/workflows/deploy.yml`
- PR checks run on every PR via `.github/workflows/pr-checks.yml`

**Review & Testing:**
`/review-and-commit`, `/pr-review`, `/security-scan`, `/arch-review`, `/design-review`, `/run-tests`, `/test-live`, `/bug-report`, `/consult-challenger`

**Memory:**
`/memory-add`, `/memory-search`, `/memory-summary`

## Project Files
- `tasks.md` — Task board with status tracking
- `release-notes.md` — Completed work log
- `requirements-v2.md` — Full project requirements (source of truth)
- `.claude/memory-db/vectra-data/` — Vector memory database (auto-managed)
- `.claude/memory-db/git-flow-helper.sh` — Git flow automation script

## Release Notes (MANDATORY)

**Every commit or merge to `develop` or `main` MUST include an update to `release-notes.md`.**

When updating release notes, include:
- **What's New** — bullet list of features, fixes, and changes
- **Build Stats** — JS size, CSS size, test counts
- **Tasks Completed** — task IDs that were finished
- Any bug fixes, new commands, architecture changes, or deployment info

This ensures a complete audit trail of all work done on the project.

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
