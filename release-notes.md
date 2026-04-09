# CollabSpace v2 — Release Notes

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
