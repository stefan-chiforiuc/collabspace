# CollabSpace v2 — Release Notes

---

## Fix: Dual-Strategy Signaling — MQTT + BitTorrent (2026-04-09)

### What's New
- **Replaced Nostr with MQTT + BitTorrent dual signaling**: Nostr relays were too unreliable. Now using two signaling strategies simultaneously for maximum connectivity
- **MQTT brokers** (primary): HiveMQ, EMQX, Mosquitto, Shiftr.io — enterprise-grade, near-100% uptime
- **BitTorrent trackers** (secondary): WebTorrent.dev, OpenWebTorrent — well-maintained torrent infrastructure
- **Dual-path discovery**: Both strategies run in parallel. Peers discover each other through whichever connects first. Messages are sent on both paths for reliability
- **Deduplicated peer events**: Even though peers may connect via both strategies, join/leave callbacks only fire once per peer

### Why This Works Better
| Strategy | Infrastructure | Uptime | Speed |
|----------|---------------|--------|-------|
| Nostr relays (old) | Volunteer-run | Unreliable | Variable |
| MQTT brokers (new) | Enterprise (HiveMQ, EMQX) | ~99.9% | Fast |
| BitTorrent trackers (new) | Well-funded projects | ~99% | Moderate |

### Build Stats
- Main JS: 472KB (146KB gzipped) — includes MQTT + torrent clients
- Unit tests: 32 passed, 0 failed
- Build: OK

---

## Fix: Nostr Relay Connectivity (2026-04-09)

### What's New
- **Explicit reliable Nostr relays**: Replaced trystero's random default relay selection with 10 known-reliable relays (relay.damus.io, nos.lol, relay.nostr.band, etc.)
- **Increased relay redundancy**: Connect to 7 of 10 relays simultaneously (up from default 5) so signaling works even if some relays are down
- **Root cause**: The default trystero relay pool includes many unreliable/offline relays. When the 5 randomly selected relays were mostly down, WebSocket signaling failed, preventing ICE candidate exchange, causing "ICE failed" WebRTC errors

### Build Stats
- Unit tests: 32 passed, 0 failed
- Build: OK

---

## M4++ — Mobile Fixes: Joining + Participant Drawer (2026-04-09)

### What's New
- **Mobile join fix**: Joiners stuck on "Connecting to room..." now have a 10-second timeout fallback — if P2P sync is slow (common on mobile), assume no password and let the joiner in
- **Mobile participant drawer**: Colored dots in the header show who's connected at a glance. Tap to open a slide-in drawer with the full participant list (name, color, status)
- **Drawer animations**: Smooth slide-in-left and fade-in animations for the mobile participant drawer
- **Better close button**: Proper X icon instead of text "x" in the drawer header

### Build Stats
- Main JS: 111KB (39KB gzipped)
- CSS: 27KB (6KB gzipped)
- Unit tests: 32 passed, 0 failed

---

## M4+ — P2P Sync Fix, PR Workflow, E2E Testing, Docker (2026-04-09)

### What's New
- **P2P Sync Fixed**: Bidirectional Yjs sync — both peers now send sync step 1 with retry logic. Second person joining a room now correctly receives all shared state (chat, polls, poker, timer, notepad)
- **Password Gate**: Joiners are now prompted for the room password before seeing room content. Wrong password is rejected, correct password grants access
- **Creator Flow Fix**: Room creators without a password no longer get stuck on "Connecting to room..." screen
- **PR-Based Workflow**: All features now go through GitHub Pull Requests reviewed by PM + Architect agents before merging. No more direct merges to `develop` or `main`
- **GitHub Actions CI**: PR checks workflow runs type check, tests, and build on every pull request
- **Docker Support**: Multi-stage Dockerfile (Node build + nginx serve), docker-compose, nginx config with SPA fallback and security headers
- **E2E Clone Agent Tests**: Playwright tests with two independent browser contexts (Alice and Bob) simulating real P2P collaboration across all features
- **Live App Testing**: New `/test-live` command to verify the GitHub Pages deployment

### P2P Bugs Fixed
| Bug | Fix |
|-----|-----|
| Only one side sends sync step 1 | Both peers now initiate sync (bidirectional) |
| Data channel not ready when sync fires | Retry logic (up to 5 attempts with backoff) |
| Joiner's doc pre-writes meta | Only creator writes initial meta; joiners sync |
| Peer name lookup uses wrong ID space | Use awareness participant list instead of peerId |
| Double onCleanup calls leave() twice | Removed duplicate from RoomView |
| No password gate for joiners | PasswordGate component with hash verification |
| Creator without password stuck on "Connecting" | Added creator flag to URL hash |

### New Commands
- `/pr-review` — PM + Architect review a Pull Request (approve/reject/merge)
- `/test-live` — Test the live GitHub Pages deployment

### E2E Test Suite (10 tests, all passing)
- App loads and landing page renders
- Room creation with all tabs visible
- Alice & Bob P2P connection via Nostr signaling
- Chat messages sync bidirectionally
- Poll creation syncs between peers
- Timer sync between peers
- Notepad collaborative editing via Yjs CRDT
- Planning poker round syncs
- Password-protected room flow (wrong/correct password)

### Build Stats
- Main JS: 110KB (38KB gzipped)
- TipTap chunk: 465KB (148KB gzipped)
- CSS: 26KB (5KB gzipped)
- Unit tests: 32 passed, 0 failed
- E2E tests: 10 passed, 0 failed

### Deployment
- **Live URL**: https://stefan-chiforiuc.github.io/collabspace/
- **Docker**: `docker compose up --build` → http://localhost:8080
- **GitHub repo**: https://github.com/stefan-chiforiuc/collabspace

---

## M3 — Collaborative Editing (2026-04-09)

**Branch:** `feature/backend-expert/T-020-m3-collaborative-editing` -> `develop`

### What's New
- **Shared Notepad (FR-05)**: Real-time collaborative rich-text editor using TipTap v3 + Yjs XmlFragment. All participants type simultaneously with CRDT conflict resolution
- **Formatting Toolbar**: Bold, italic, inline code, H1-H3, bullet/ordered lists, code blocks, blockquotes — all via toolbar buttons with active state indicators
- **Export**: Download notepad content as Markdown (.md), plain text (.txt), or JSON (.json) directly from the toolbar
- **Notes Tab**: New "Notes" tab in room view alongside Chat, Polls, Poker, Timer
- **Code Splitting**: TipTap + ProseMirror in separate lazy-loaded chunk to keep main bundle fast
- **Editor Styling**: Dark theme prose styles matching the design system — headings, lists, code blocks, blockquotes

### Architecture
- TipTap v3 with `@tiptap/extension-collaboration` binding to Yjs XmlFragment
- StarterKit with undoRedo disabled (Yjs handles history)
- Awareness protocol carries cursor name/color for each peer
- Manual chunk splitting: TipTap/ProseMirror in `tiptap` chunk, loaded only when Notes tab is active

### Build Stats
- Main JS: 104KB (37KB gzipped) — core app without notepad
- TipTap chunk: 465KB (148KB gzipped) — lazy loaded
- CSS: 24KB (5KB gzipped)
- Tests: 25 passed, 0 failed

### Tasks Completed
T-020, T-021, T-022, T-023

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
