# CollabSpace v2 — Release Notes

---

## M2 — Core Features (2026-04-09)

**Branch:** `feature/backend-expert/T-013-m2-core-features` -> `develop`

### What's New
- **Polls (FR-03)**: Create single-choice or multi-choice polls (2-10 options), real-time vote tallying via Yjs CRDT, bar chart results with percentages, any participant can close a poll
- **Planning Poker (FR-04)**: Start estimation rounds with optional topic, 3 card sets (Fibonacci, T-shirt, Powers of 2), hidden votes until revealed, consensus detection, average calculation (excludes non-numeric cards)
- **Shared Timer (FR-06)**: Synced countdown timer with 5 presets (1m/2m/5m/10m/15m), pause/resume/stop controls, visual progress bar, expiry alert with color changes, compact display in header
- **Quick Reactions (FR-07)**: 8 emoji reactions visible to all participants, transient display (3s), raise hand toggle persisted via awareness protocol
- **Tab Navigation**: Room view now has Chat/Polls/Poker/Timer tabs for switching between features
- **Reactions Bar**: Always-visible emoji reaction bar with raise hand at bottom of room

### Architecture
- All features use Yjs Y.Map/Y.Array for CRDT-synced state — zero conflict, zero coordination
- Poker/Timer/Reactions leverage awareness protocol for real-time transient state
- Each feature follows the hook pattern: lib/ (operations) -> hooks/ (reactive signals) -> components/ (UI)
- No new dependencies added — all features built on existing Yjs + Trystero stack

### Build Stats
- JS: 180KB (60KB gzipped)
- CSS: 23KB (5KB gzipped)
- Total gzipped: **65KB** (budget: 200KB)
- Tests: 25 passed, 0 failed (4 test files)

### Tasks Completed
T-013, T-014, T-015, T-016, T-017, T-018, T-019

---

## M1 — Walking Skeleton (2026-04-09)

**Branch:** `feature/backend-expert/T-001-m1-walking-skeleton` -> `develop`
**Commit:** `805d9c5`

### What's New
- **Project scaffolding**: Vite 6 + SolidJS + TypeScript + Tailwind CSS v4 + Vitest
- **P2P networking**: Trystero (Nostr strategy) with peer lifecycle, 10s disconnect grace period, 6-peer cap
- **CRDT state sync**: Yjs document with custom TrysteroProvider bridging Y.Doc over WebRTC data channels
- **Room codes**: Human-readable `adjective-noun-NNNN` format using `crypto.getRandomValues()`
- **Landing page**: Create room (one-click), join by code, display name persisted in localStorage
- **Room view**: Header with room code, copy invite link, leave button, connection status indicator
- **Participant list**: Colored dots, names, connected/disconnected status, count out of 6
- **Chat**: Real-time messages via Y.Array, system messages for join/leave, auto-scroll, Enter to send
- **Design system**: Tailwind v4 `@theme` tokens (primary/surface palette, participant colors), Button, Input, Card, Badge components
- **PWA**: Service worker with auto-update, manifest, precached assets (7 entries)
- **Deployment**: GitHub Actions workflow for GitHub Pages
- **Security**: No credentials in code, .gitignore covers secrets, hash-based routing preserves privacy

### Build Stats
- JS: 156KB (53KB gzipped)
- CSS: 18KB (4KB gzipped)
- Total gzipped: **57KB** (budget: 200KB)
- Tests: 4 passed, 0 failed

### Tasks Completed
T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010, T-011, T-012
