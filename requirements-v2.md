# CollabSpace v2 — Zero-Infrastructure P2P Collaboration PWA

## Challenging the v1 Approach

The v1 requirements are solid in vision but overengineered for the stated goal of **zero maintenance, zero cost, instant usability**. Here's what we're changing and why:

### Problems with v1

| v1 Assumption | Problem | v2 Response |
|---|---|---|
| "Minimal signaling service" | Still a server to deploy, monitor, and pay for | Piggyback on existing free infrastructure (MQTT brokers, BitTorrent trackers) — no custom server at all |
| Custom WebRTC connection management | Complex, error-prone, weeks of work | Use **Trystero** library — handles signaling via free public infrastructure + WebRTC setup in ~50 lines |
| Custom CRDT sync over data channels | Reinventing the wheel | Use **Yjs** + its built-in providers — battle-tested CRDT with awareness, undo, and multiple transports |
| Custom host migration protocol | Complex distributed systems problem for a collaboration tool | Simplify to **leaderless CRDT model** — no host needed for most features; elect coordinator only when ordering matters (polls, poker reveals) |
| Video/audio/screen sharing in scope | Requires TURN servers ($$$), complex media handling, mesh breaks at 4+ streams | **Defer entirely** — link out to Jitsi Meet / Google Meet. Focus on what WebRTC data channels do cheaply: text and state sync |
| File sharing over WebRTC | Chunking, progress, reliability — all hard over unreliable data channels | **Defer or simplify** — share files via drag-and-drop to data channel for small files (<5MB), link out for large files |
| Whiteboard + Notepad | Two complex collaborative editing surfaces | **One tool: collaborative notepad only** using Yjs + TipTap/Milkdown. Whiteboard can be an Excalidraw link shared in chat |
| 8+ participant mesh topology | O(n^2) connections, degrades fast | **Cap at 6 for v1**, optimize later. 6 peers = 15 connections, manageable |

---

## Revised Core Principles

1. **Absolutely no custom server** — Not even a "minimal" one. Signaling uses existing free public infrastructure (MQTT brokers, BitTorrent trackers). The app is a static site.
2. **Static deployment, zero ops** — Deploy to GitHub Pages, Cloudflare Pages, or Netlify. No CI/CD needed beyond a push to main. No database, no serverless functions, no cloud accounts to manage.
3. **Leaderless by default** — CRDTs eliminate the need for a host/coordinator in most cases. A coordinator is only elected for actions that require synchronization (reveal poker cards, close a poll). Any peer can be coordinator.
4. **Ephemeral sessions** — Nothing persists after the last peer leaves. Local export is available for anything worth keeping.
5. **Radically simple feature set** — Do 4 things excellently (chat, polls, planning poker, shared notepad) rather than 12 things poorly. Every feature must justify its complexity budget.
6. **PWA-first** — Installable, works offline for the landing page, fast on mobile.

---

## Architecture Overview

### Networking: Trystero + Yjs

**Why Trystero?**
- Uses existing free infrastructure for WebRTC signaling — **no custom signaling server**
- Supports multiple strategies: MQTT brokers (primary) + BitTorrent trackers (secondary)
- ~4KB library, handles all WebRTC connection establishment
- Room-based model maps directly to our session concept
- MIT licensed, actively maintained

**Why Yjs for state?**
- Industry-standard CRDT library, used by Notion, JupyterLab, and others
- Handles concurrent edits, offline merge, and conflict resolution
- Built-in awareness protocol (who's online, cursor positions, user presence)
- Works with any transport — we feed it Trystero's data channels
- Rich ecosystem: TipTap, Milkdown, CodeMirror bindings for the notepad

**How they work together:**
```
[Static Site] --> [Trystero] --> [Free Public Infrastructure] --> [WebRTC Data Channels]
                                  (MQTT/BitTorrent)              |
                                                                  [Yjs CRDT Sync]
                                                                       |
                                                              [Shared App State]
```

1. User creates a room — Trystero generates a room ID, announces via MQTT/BT
2. Other users join via link containing the room ID
3. Trystero establishes WebRTC data channels between all peers (mesh)
4. Yjs syncs a shared document over those data channels
5. All app state (chat messages, poll votes, poker cards, notepad content) lives in the Yjs document
6. Awareness protocol tracks who's online, display names, cursor positions

### No Host, No Migration

The v1 host migration protocol is unnecessary when using CRDTs:

- **Chat**: Append-only, no ordering conflict possible
- **Polls**: Anyone can create, votes are per-user keys in the CRDT — no conflict
- **Planning Poker**: Votes are per-user keys; "reveal" is a boolean flag — first writer wins, which is fine
- **Notepad**: Yjs handles concurrent editing natively
- **Timer**: Synced via CRDT; any peer can start/pause — last-writer-wins is acceptable

The only scenario needing coordination is **simultaneous reveal + reset** in poker, which is rare and can use a simple "first write wins" rule.

### Invite & Session Discovery

- Room ID is a human-readable short code: `<adjective>-<noun>-<4digits>` (e.g., `calm-river-7291`)
- Invite link: `https://<app-domain>/#/room/<room-id>`
- Hash-based routing — the server never sees the room ID (privacy)
- Users can also join by typing the room code manually (useful for in-person meetings)
- Optional: QR code generation for the invite link (useful for mobile, in-person)

### State Structure (Yjs Document)

```
Y.Doc
├── meta (Y.Map)
│   ├── roomName: string
│   ├── createdAt: number
│   ├── password: string (optional, SHA-256 hashed)
│   └── settings: { maxParticipants, etc. }
├── chat (Y.Array)
│   └── [{ id, author, text, timestamp, reactions: {} }]
├── participants (Y.Map, via Awareness)
│   └── [peerId]: { name, color, joinedAt, status }
├── polls (Y.Map)
│   └── [pollId]: { question, options, type, votes: { peerId: choice }, closed }
├── poker (Y.Map)
│   └── { topic, cardSet, votes: { peerId: card }, revealed, round }
├── notepad (Y.XmlFragment)
│   └── (TipTap/ProseMirror document)
└── timer (Y.Map)
    └── { startedAt, duration, pausedAt, mode }
```

---

## Security

| Concern | Approach |
|---|---|
| **Session access** | Room IDs are unguessable short codes (~36 billion combinations). Optional password stored in the Yjs doc (checked client-side on join). |
| **Encryption** | WebRTC data channels use DTLS encryption by default. No plaintext traffic. |
| **Identity** | Self-declared display names. No auth needed. Color assigned automatically for visual distinction. |
| **Abuse** | Any participant can "leave" (disconnect). No kick in v1 — if needed, create a new room and share the link with everyone except the bad actor. Simplest solution, zero complexity. |
| **Privacy** | Hash-based routing means the server (static host) never sees room IDs. Trystero signaling uses room ID hashes, not plaintext. |

---

## Functional Requirements

### FR-01: Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01.1 | A user can create a new room with one click from the landing page | Must |
| FR-01.2 | Creating a room generates a human-readable code and shareable link | Must |
| FR-01.3 | A user can join a room via link or by entering the room code | Must |
| FR-01.4 | The room displays all connected participants with names and colors | Must |
| FR-01.5 | When a peer disconnects, they are removed from the participant list after 10s grace period | Must |
| FR-01.6 | When the last peer leaves, the room ceases to exist (no cleanup needed — CRDT state is in-memory only) | Must |
| FR-01.7 | Participants can set their display name (persisted in localStorage for convenience) | Must |
| FR-01.8 | Room creator can optionally set a room name/title | Should |
| FR-01.9 | Invite link can be copied with one click; QR code available for mobile sharing | Should |
| FR-01.10 | Optional room password (entered before joining) | Could |

### FR-02: Chat

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-02.1 | All participants can send and receive text messages | Must |
| FR-02.2 | Messages show sender name, color, and timestamp | Must |
| FR-02.3 | Chat history is available for the duration of the session (replicated via Yjs) | Must |
| FR-02.4 | Emoji reactions on messages (click to react) | Should |
| FR-02.5 | Basic markdown support (bold, italic, code, links) rendered inline | Should |
| FR-02.6 | "Participant joined/left" system messages | Must |

### FR-03: Polls

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-03.1 | Any participant can create a poll with a question and 2-10 options | Must |
| FR-03.2 | Single-choice or multi-choice voting (set at creation) | Must |
| FR-03.3 | All participants are notified of new polls and can vote | Must |
| FR-03.4 | Results update in real-time as votes arrive (via CRDT sync) | Must |
| FR-03.5 | Any participant can close a poll | Should |
| FR-03.6 | Results show vote counts and a simple bar chart | Must |
| FR-03.7 | Multiple polls can exist; shown in a scrollable list, newest first | Should |

### FR-04: Planning Poker

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-04.1 | Any participant can start a poker round with an optional topic | Must |
| FR-04.2 | Participants select from a card set (default: Fibonacci 0, 1, 2, 3, 5, 8, 13, 21, ?, coffee) | Must |
| FR-04.3 | Votes are hidden until revealed (shown as "voted" / "not voted") | Must |
| FR-04.4 | Any participant can reveal all votes (first-to-click wins) | Must |
| FR-04.5 | After reveal: show each person's vote, average (excluding non-numeric), and whether consensus was reached | Must |
| FR-04.6 | Any participant can reset for a new round | Must |
| FR-04.7 | Configurable card sets (Fibonacci, T-shirt, powers of 2, custom) | Should |

### FR-05: Shared Notepad

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-05.1 | A shared rich-text notepad available in every room | Must |
| FR-05.2 | All participants can type simultaneously (Yjs + TipTap) | Must |
| FR-05.3 | Each participant's cursor visible with their name and color | Must |
| FR-05.4 | Basic formatting: headings, bold, italic, bullet/numbered lists, code blocks | Must |
| FR-05.5 | Export as Markdown or plain text (download to local file) | Should |

### FR-06: Shared Timer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06.1 | Any participant can start a countdown timer (preset: 1m, 2m, 5m, 10m, or custom) | Should |
| FR-06.2 | Timer is synced and visible to all participants | Should |
| FR-06.3 | Any participant can pause, resume, or reset the timer | Should |
| FR-06.4 | Visual + optional audio alert when timer expires | Should |

### FR-07: Quick Reactions / Raise Hand

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-07.1 | Participants can send transient emoji reactions visible to all (fade after 3s) | Should |
| FR-07.2 | "Raise hand" persists until the sender dismisses it | Should |
| FR-07.3 | Raised hands shown in participant list with visual indicator | Should |

---

## What We Deliberately Cut (and Alternatives)

| v1 Feature | Why Cut | Alternative |
|---|---|---|
| **Video/Audio/Screen Share** | Requires TURN servers ($$), complex media pipeline, mesh breaks at 4+ streams | Share a Jitsi Meet link in chat — free, reliable, scales to 100+ participants. Or integrate a "Create Jitsi Room" one-click button. |
| **File Sharing** | Chunking large files over WebRTC is unreliable and complex | For small files (<2MB): drag-and-drop via data channel. For larger files: share a link (Google Drive, Dropbox, file.io). |
| **Whiteboard** | Full collaborative whiteboard is a project in itself | Share an Excalidraw link in chat — it's free, P2P-capable, and excellent. Or embed Excalidraw as an iframe. |
| **Retro Board** | Nice but adds significant UI complexity | Use the notepad with a template ("## Went Well / ## Didn't Go Well / ## Actions"). Or add as a structured plugin in v2. |
| **Dot Voting** | Overlaps with polls functionality | Polls with multi-choice cover 80% of dot-voting use cases. |
| **Lobby Mode / Kick** | Complex access control for ephemeral sessions | Unguessable room codes + optional password. If someone is disruptive, create a new room (takes 1 click). |

---

## Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | The app is a static site — deployable to GitHub Pages, Cloudflare Pages, or Netlify with zero configuration | Must |
| NFR-02 | Zero custom backend — signaling uses Trystero (MQTT brokers + BitTorrent trackers) | Must |
| NFR-03 | Zero ongoing costs — free static hosting + free public infrastructure for signaling/STUN | Must |
| NFR-04 | PWA: installable on mobile and desktop, service worker for offline landing page | Must |
| NFR-05 | Session state fully replicated via Yjs CRDT — no single point of failure | Must |
| NFR-06 | Support up to 6 simultaneous participants per room (mesh topology) | Must |
| NFR-07 | Responsive UI: usable on 360px mobile screens and desktop | Must |
| NFR-08 | Works on latest Chrome, Firefox, Safari, Edge | Must |
| NFR-09 | All communication encrypted via WebRTC DTLS | Must |
| NFR-10 | Auto-reconnect on temporary disconnection (10s grace period) | Must |
| NFR-11 | First meaningful paint under 2s on 4G | Should |
| NFR-12 | Main bundle under 200KB gzipped (TipTap editor chunk is lazy-loaded separately) | Should |
| NFR-13 | WCAG 2.1 AA accessibility compliance | Should |
| NFR-14 | No analytics, tracking, or cookies — privacy by design | Should |

---

## Tech Stack (Decided)

No more "TBD" — decisions made for simplicity and speed:

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **SolidJS** | Tiny runtime (~7KB), fast, JSX familiar, great DX. |
| **Networking** | **Trystero** (MQTT + BitTorrent dual strategy) | Dual-path P2P signaling via MQTT brokers (primary) and BitTorrent trackers (secondary). No server. |
| **State Sync** | **Yjs** | Best-in-class CRDT. Handles all collaborative state, awareness, and conflict resolution. |
| **Rich Text** | **TipTap** (with Yjs binding) | Collaborative editor with Yjs integration out of the box. |
| **Styling** | **Tailwind CSS v4** | Utility-first, tree-shakeable, fast. |
| **Build** | **Vite** | Fast dev server, PWA plugin (vite-plugin-pwa), excellent tree-shaking. |
| **Testing** | **Vitest** + **Playwright** | Unit + E2E. |
| **Deployment** | **GitHub Pages** (via GitHub Actions) | Free, zero-config, auto-deploys on push. |
| **STUN** | **Google's free STUN servers** | `stun:stun.l.google.com:19302` — reliable, free, no setup. |
| **TURN** | **Metered Open Relay** (auto) or custom coturn | Client-side HMAC-SHA1 credentials via Web Crypto API. Custom TURN for organizations with their own server. Disable option for local networks. |

---

## Milestones (Revised — Fewer, Faster)

### M1 — Walking Skeleton (1-2 weeks)
- Static site deployed to GitHub Pages
- Room creation with human-readable codes
- Trystero-based P2P connection (peers can find each other)
- Yjs document syncing across peers
- Participant list with names and colors
- Basic chat working over Yjs
- PWA manifest + service worker

### M2 — Core Features (1-2 weeks)
- Polls (create, vote, see results in real-time)
- Planning Poker (vote, reveal, reset)
- Shared Timer
- Quick reactions + raise hand

### M3 — Collaborative Editing (1-2 weeks)
- TipTap notepad with Yjs collaboration
- Multi-cursor awareness (names + colors)
- Export notepad as Markdown, plain text, or JSON

### M4 — Polish (1 week)
- Mobile-optimized UI
- Accessibility audit and fixes
- Offline landing page (service worker)
- PWA install prompts
- Optional room passwords
- E2E test suite with Playwright

---

## New Ideas Worth Exploring

### 1. One-Click Integrations
Instead of building video/whiteboard/file-sharing from scratch, add one-click buttons that create rooms in free external tools:
- "Start Video Call" -> creates a Jitsi Meet room, shares link in chat
- "Open Whiteboard" -> creates an Excalidraw room, shares link in chat
- "Share Large File" -> opens file.io or wormhole.app

This gives users 90% of the functionality with 0% of the infrastructure cost.

### 2. Room Templates
Pre-configured room setups for common ceremonies:
- **"Sprint Planning"** — Opens with poker + notepad
- **"Retro"** — Opens with notepad (pre-filled template: Went Well / Didn't Go Well / Actions) + timer
- **"Quick Poll"** — Opens directly to poll creation
- **"Standup"** — Opens with timer (per-person) + raise hand + notepad

Templates are just URL parameters that set initial state.

### 3. Local Session History
Save room summaries to localStorage/IndexedDB after a session:
- Poll results, poker outcomes, notepad content, chat log
- Accessible from a "Past Sessions" tab on the landing page
- Exportable as a single Markdown file or JSON
- Never leaves the user's device

### 4. Embeddable Widget Mode
Allow the app (or individual features) to be embedded in other sites via iframe:
- `<iframe src="https://collabspace.app/#/embed/poker?room=calm-river-7291">`
- Useful for teams that want poker/polls inside their existing tools
- Minimal UI, no chrome, just the feature

### 5. CLI / API for Automation
A tiny CLI or JS API that can create rooms and post messages programmatically:
- CI/CD pipeline creates a poker room for estimation
- Bot posts a poll to an existing room
- Scheduled retro room creation

### 6. Voice Notes (No Call)
Instead of full audio/video (which needs TURN):
- Record a short voice note (< 30s)
- Send it as a binary blob over WebRTC data channel
- Recipients play it back
- Much simpler than real-time audio streaming, works without TURN

---

## Open Questions (Reduced)

1. ~~**Trystero strategy**~~ — **RESOLVED**: MQTT brokers (primary) + BitTorrent trackers (secondary) as dual-path signaling. Nostr was dropped due to unreliable relays.
2. **Participant cap** — Hard 6 or soft limit with degradation warning?
3. **Naming** — "CollabSpace" is generic. Something shorter and memorable? "Huddle"? "Meshup"? "Peerly"?
4. ~~**Export format**~~ — **RESOLVED**: Notepad exports as Markdown, plain text, or JSON. Users choose format at export time.

---

## Summary: v1 vs v2 Philosophy

| | v1 (Original) | v2 (This Document) |
|---|---|---|
| **Server** | "Minimal signaling service" (still a server) | Zero custom servers — Trystero + free public infra |
| **Maintenance** | Need to monitor signaling + TURN | Push to GitHub, done forever |
| **Cost** | TURN server costs, signaling hosting | $0/month |
| **Features** | 12 features, many complex | 4-5 features, all excellent |
| **Video/Audio** | Built-in (complex, expensive) | Delegate to Jitsi (free, better) |
| **State sync** | Custom CRDT implementation | Yjs (battle-tested) |
| **Complexity** | High — custom protocols for host migration, signaling, state sync | Low — leverage existing libraries for everything |
| **Time to MVP** | Months | Weeks |
| **Participants** | 8-20 | 6 (honest about mesh limits) |
