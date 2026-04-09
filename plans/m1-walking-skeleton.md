# M1 Walking Skeleton — Implementation Plan

## Context
CollabSpace v2 has all planning artifacts (requirements, tasks, agents, git-flow) but zero source code. This plan implements the entire M1 milestone: a working P2P app where peers can create rooms, join via codes/links, see each other, and chat — all with no custom server.

## Tech Stack Decisions
- **Framework:** SolidJS (tiny runtime, JSX familiar)
- **Styling:** Tailwind CSS v4 (CSS-first config via `@theme`, no config JS file)
- **Build:** Vite 6 + vite-plugin-solid + vite-plugin-pwa + @tailwindcss/vite
- **Routing:** Custom hash router (~30 lines, no @solidjs/router — only 2 routes)
- **Yjs sync:** Custom provider over Trystero data channels (not y-webrtc)
- **P2P strategy:** Trystero Nostr (`trystero/nostr` subpath import)

## Implementation Phases

### Phase 1: Scaffolding (T-001, T-009, T-012)
- Replace `package.json` with app dependencies (keep vectra/@xenova/transformers for memory system)
- Create: `index.html`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/index.tsx`, `src/App.tsx`, `src/app.css` with Tailwind `@theme` tokens
- Create: `src/design/tokens.ts` (participant colors, spacing, etc.)
- Create: `src/components/ui/` (Button, Input, Card, Badge)
- Update `.gitignore` for build artifacts, PWA dev-dist
- Verify: `npm run dev`, `npm run build`, `npm test` all work

### Phase 2: P2P + State Layer (T-002, T-003, T-004)
- `src/lib/constants.ts` — word lists, app config
- `src/lib/room-code.ts` — `adjective-noun-NNNN` generation with `crypto.getRandomValues()`
- `src/lib/types.ts` — Participant, ChatMessage, RoomMeta interfaces
- `src/lib/trystero.ts` — Trystero Nostr room setup, peer lifecycle, 10s grace period
- `src/lib/yjs-doc.ts` — Y.Doc schema initialization (meta, chat, polls, poker, timer maps)
- `src/lib/yjs-sync.ts` — Custom Yjs provider bridging Y.Doc ↔ Trystero data channels
- `src/lib/participants.ts` — Awareness protocol setup, color assignment

### Phase 3: Reactive Hooks (bridge Yjs → SolidJS)
- `src/hooks/useHashRouter.ts` — hash-based router signal
- `src/hooks/useRoom.ts` — room lifecycle (create/join/leave), wraps Trystero+Yjs
- `src/hooks/useParticipants.ts` — reactive participant list from Awareness
- `src/hooks/useChat.ts` — reactive chat messages from Y.Array

### Phase 4: UI Components (T-005, T-006, T-007, T-008)
- `src/components/Landing.tsx` — create/join room, name input (localStorage)
- `src/components/RoomView.tsx` — room layout, header with code + copy link, leave button
- `src/components/ParticipantList.tsx` — colored dots, names, status, count
- `src/components/ChatPanel.tsx` — message list, input bar, auto-scroll
- `src/components/ChatMessage.tsx` — user/system message rendering
- `src/lib/chat.ts` — chat operations on Y.Array
- `src/lib/storage.ts` — localStorage helpers for display name

### Phase 5: PWA + Deployment (T-010, T-011)
- Update `vite.config.ts` with full PWA manifest configuration
- Create placeholder icons in `public/`
- Create `.github/workflows/deploy.yml` for GitHub Pages

## Key Architecture Patterns
```
Trystero (Nostr) → WebRTC data channels → Custom Yjs Provider → Y.Doc (CRDT)
                                                                      ↓
SolidJS signals ← useRoom/useChat/useParticipants hooks ← Yjs observe callbacks
```

## File Structure
```
src/
├── index.tsx, App.tsx, app.css
├── lib/          # Core logic: trystero, yjs, chat, room-code, types
├── hooks/        # SolidJS hooks bridging Yjs → reactive signals
├── components/   # UI: Landing, RoomView, ChatPanel, ParticipantList
│   └── ui/       # Design system: Button, Input, Card, Badge
└── design/       # tokens.ts
```

## Git Flow
Single feature branch for the entire M1 skeleton: `feature/backend-expert/T-001-m1-walking-skeleton`
Rationale: 12 tightly interdependent tasks on a greenfield project — individual branches per task would create merge overhead with no value (nothing to break yet).

## Verification
1. `npm run dev` — dev server starts, landing page renders
2. Open two browser tabs, create room in one, join via code in other
3. Both peers see each other in participant list
4. Send chat messages — appear in both tabs in real-time
5. Close one tab — peer removed after 10s grace period
6. `npm run build` — produces static output in `dist/`
7. `npm test` — unit tests pass (room codes, chat logic)
