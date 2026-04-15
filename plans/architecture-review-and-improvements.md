# CollabSpace v2 — Architecture Review & Improvement Plan

## Context
CollabSpace v2 is feature-complete against `requirements-v2.md` (M1–M5c shipped: rooms,
chat, polls, poker, timer, notepad, A/V streaming, raise-hand, PWA). This plan
captures a written architectural review: real risks (one is a P0 security bug),
challenges to the "zero-server" axiom where it's silently costing the product, and
a prioritized roadmap.

## Summary of Findings

### Critical security finding (verified in code)
The MQTT relay fallback (`src/lib/mqtt-relay.ts:122-129` and
`src/lib/yjs-sync.ts:46-55`) publishes raw, unencrypted Yjs sync and awareness
payloads to a **public** MQTT broker on topic `collabspace-relay/v1/<room>/sync`.
Any passive subscriber who knows the room code can reconstruct the full document:
chat, notepad, polls, poker votes, and the SHA-256 `passwordHash` stored in `meta`.
The WebRTC DTLS claim is only true while WebRTC succeeds; once the 15s relay
timeout trips, all state flows in plaintext. `grep` for
`encrypt|AES|crypto.subtle|deriveKey` across `src/` returns only `turn-config.ts`
(HMAC for TURN) and `room-password.ts` (password hash) — there is no
application-level encryption anywhere.

Additionally: the room password is hashed inside the Yjs doc, which means a
joining peer must already receive the doc to verify the password. The password
is a UI gate, not a cryptographic one, and a weak password is rainbow-tableable.

### Architectural tensions worth challenging
1. **"Zero custom servers" is paid for in five places at once** — mesh cap, broker
   fragility, no persistence, plaintext relay, zero observability. A single
   Cloudflare Worker + Durable Object could relieve four of these at $0 on the
   free tier. Worth a serious "opt-in Cloudflare mode" discussion.
2. **Mesh cap is a media-plane problem, not a data-plane problem** —
   chat/polls/poker/notes mesh comfortably at 20+. Video is the O(n²) bottleneck.
3. **Ephemeral-by-design is philosophically beautiful but operationally hostile** —
   a tab crash destroys 45 minutes of retro notes. `y-indexeddb` with an opt-in
   toggle fixes this without contradicting the philosophy.
4. **TipTap is ~148 KB gzipped (~48% of the bundle)** for a meeting-minutes
   notepad — CodeMirror 6 + markdown + y-codemirror.next would save ~70 KB.
5. **Dead dependencies** — `@xenova/transformers` and `vectra` sit in
   `package.json` but are not imported from `src/`. Pure bloat.
6. **`RoomView.tsx` (428 lines) is a god-component** — owns 15 child components,
   8 hooks, 9 signals, the password gate, and four modals.
7. **Corporate-network failure is silent** — if both MQTT (sometimes blocked) and
   BitTorrent trackers (often blocked) fail, the app hangs with no recovery
   guidance.
8. **Observability paradox** — excellent in-session `webrtc-diagnostics.ts` ring
   buffer, but no way for a user to export it for a bug report.

## Prioritized Proposals

### P0 — stop the bleeding
- **P0-1:** E2E-encrypt Yjs payloads with AES-GCM; derive key from room code +
  password via PBKDF2. Wrap every outgoing `sendSync` / `sendAwareness` at the
  `TrysteroProvider` boundary so both WebRTC and MQTT transports only see
  ciphertext.
- **P0-2:** Remove dead `@xenova/transformers` + `vectra` dependencies from
  `package.json`.
- **P0-3:** Move password verification out of the doc. With P0-1 in place the
  password becomes part of the key-derivation input, so an incorrect password
  yields ciphertext that fails GCM auth — the password becomes a cryptographic
  gate instead of a UI gate. A small encrypted canary in `meta` lets a joining
  peer test the password before attempting to apply any updates.
- **P0-4:** Corporate-network fallback UX — actionable "all relays failed" panel
  instead of silent hang.

### P1 — high-impact, no principles broken
- **P1-1:** Optional `y-indexeddb` persistence (opt-in, default off).
- **P1-2:** "Export diagnostics bundle" button in `ConnectionStatus`.
- **P1-3:** Connection-quality indicator via `RTCPeerConnection.getStats()`.
- **P1-4:** Split `RoomView` into shell + tab registry.
- **P1-5:** Replace TipTap with CodeMirror 6 + markdown + y-codemirror.next.
- **P1-6:** Progressive per-tab lazy loading.
- **P1-7:** Component tests for the five panels (`@solidjs/testing-library`).
- **P1-8:** Late-joiner ephemeral history hand-off (trivial — Yjs already
  carries it).
- **P1-9:** Accessibility pass (axe-core + keyboard nav + aria-live).

### P2 — worth doing, can wait
- **P2-1:** Opt-in SFU mode via Cloudflare Calls (breaks "zero servers" axiom;
  opt-in only).
- **P2-2:** Waku signaling as a fourth transport.
- **P2-3:** WebRTC file transfer via Trystero data channels.
- **P2-4:** i18n scaffolding.
- **P2-5:** Save-to-URL snapshots for polls/notepad.
- **P2-6:** Screenshare channel separation (depends on P2-1).

## New Feature Ideas
- Room templates (Scrum standup, Retrospective, Planning poker, Brainstorm) —
  high-impact, low-effort
- Save-room-as-template
- `BroadcastChannel` local transport (same-network peers bypass trackers)
- Offline-mode indicator + queued chat
- One-click meeting notes export (chat + notes + polls → markdown)
- Scheduled rooms with `?start=` countdown
- Read-only spectator mode (joins via relay only, no mesh slot)
- Resume-last-room from IndexedDB

## Roadmap
- **Sprint 1 — Stop the bleeding:** P0-2, P0-1, P0-3, P0-4, P1-2, P1-8
- **Sprint 2 — Make it refactorable:** P1-7, P1-4, P1-6, P1-1, P1-3
- **Sprint 3 — Scale & reach:** P1-5, P1-9, templates, offline mode,
  BroadcastChannel
- **Sprint 4 — Ambition (requires Cloudflare):** P2-1, P2-3, P2-5

## Principles Check
Only P2-1 (opt-in SFU) contradicts "zero custom servers", and it does so as an
opt-in — default installs remain server-free. Every P0 and P1 item is compatible
with the zero-infrastructure story.

## Critical Files Index
- `src/lib/mqtt-relay.ts` — plaintext relay (P0-1)
- `src/lib/yjs-sync.ts` — transport boundary for encryption wrap (P0-1)
- `src/lib/room-password.ts` — password gate (P0-3)
- `src/lib/yjs-doc.ts` — doc schema (P0-3 canary)
- `src/components/RoomView.tsx` — god component (P1-4)
- `package.json` — dead deps (P0-2)
