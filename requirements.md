# CollabSpace — Peer-to-Peer Collaboration PWA

## Vision

A progressive web / mobile application that enables real-time collaboration between participants without a dedicated backend server. Sessions are ephemeral and peer-to-peer: one participant acts as the session host, and if they leave, the role automatically transfers to another participant until no one remains and the session is destroyed.

---

## Core Principles

1. **No persistent server** — The app relies on WebRTC for peer-to-peer communication. A minimal signaling service is required for connection establishment only (e.g., serverless function, PeerJS Cloud, or Firebase Realtime DB).
2. **Ephemeral sessions** — Sessions exist only while participants are connected. No data persists after the session ends.
3. **Host migration** — The session creator is the initial host. If they leave, host role transfers automatically to the next participant. If the host crashes, peers detect the loss and elect a new host.
4. **Democratic collaboration** — All features are available to all participants equally. When someone starts an activity (poll, poker, etc.), all participants are invited to collaborate.
5. **PWA-first** — Installable on mobile and desktop. Works in modern browsers without app store distribution.

---

## Architecture Overview

### Networking Model

- **WebRTC Data Channels** for all text-based communication (chat, votes, state sync).
- **WebRTC Media Streams** for screen sharing and camera/audio.
- **Mesh topology** for small sessions (up to 8 participants).
- **Signaling service** (lightweight, stateless) required only during connection setup — not during the session itself.
- **STUN servers** (free, e.g., Google's) for NAT traversal.
- **TURN server** (optional, for users behind strict NATs) — can use a free/cheap hosted TURN or make it configurable.

### State Management

- **Replicated state model** — Every peer holds a full copy of the session state. The host acts as the coordinator/arbiter for ordering, but any peer can become host because they have the full state.
- **CRDT or last-writer-wins** — For collaborative features (notepad, whiteboard), use CRDTs to handle concurrent edits without conflicts.
- **Sequence numbering** — All state mutations are sequenced by the host to ensure consistency across peers.

### Host Migration Protocol

1. The host sends periodic heartbeats to all peers.
2. If peers detect no heartbeat for N seconds (configurable, e.g., 3s), they initiate host election.
3. **Election rule**: The peer with the lowest join-order index becomes the new host (deterministic, no voting needed).
4. The new host announces itself; peers acknowledge and reconnect data channels as needed.
5. Since all peers hold replicated state, no state transfer is needed — only the coordination role changes.

### Invite & Session Discovery

- The session creator generates a unique session ID (UUID).
- The invite link encodes: session ID + signaling server endpoint + optional access token.
- Format: `https://<app-domain>/join/<session-id>?token=<optional-token>`
- When a new peer opens the link, they contact the signaling server with the session ID, the host (or any connected peer) receives the signal and establishes a WebRTC connection.
- **No session persistence** — if the link is opened after the session ends, the user sees a "session no longer exists" message.

---

## Security

### Session Access Control

- **Invite-only by default** — Only users with the invite link (and optional token) can join.
- **Optional password** — Session creator can set a password; joiners must enter it before being admitted.
- **Lobby mode** (optional) — New joiners wait in a lobby; the host admits or rejects them.
- **Kick functionality** — The host (or any participant, depending on config) can remove a participant.

### Identity

- **Self-declared display names** — No server-side authentication. Participants choose a display name on join.
- **Future consideration** — Optional OAuth/social login for verified identity (requires a lightweight auth service).

### Encryption

- **WebRTC encryption** — All WebRTC data channels and media streams are encrypted by default (DTLS-SRTP).
- **No additional E2E encryption in v1** — WebRTC's built-in encryption is sufficient for the peer-to-peer model since there is no intermediary server.

---

## Functional Requirements

### FR-01: Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01.1 | A user can create a new session and becomes the host | Must |
| FR-01.2 | Creating a session generates a unique, shareable invite link | Must |
| FR-01.3 | A user can join an existing session via the invite link | Must |
| FR-01.4 | The session displays a list of all connected participants with display names | Must |
| FR-01.5 | When the host leaves, the host role automatically transfers to the next participant (by join order) | Must |
| FR-01.6 | When the last participant leaves, the session is destroyed | Must |
| FR-01.7 | The host can kick a participant from the session | Should |
| FR-01.8 | The session creator can optionally set a password for the session | Should |
| FR-01.9 | The session creator can enable lobby mode (manual admit/reject) | Could |
| FR-01.10 | Participants see a visual indicator of who the current host is | Must |
| FR-01.11 | Participants can set and change their display name | Must |
| FR-01.12 | The app detects disconnection and attempts automatic reconnection for N seconds before removing the peer | Must |

### FR-02: Chat

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-02.1 | All participants can send and receive text messages in a shared chat | Must |
| FR-02.2 | Messages display the sender's name and timestamp | Must |
| FR-02.3 | Chat history is available for the duration of the session (replicated across peers) | Must |
| FR-02.4 | Users can send emoji reactions to messages | Should |
| FR-02.5 | Users can reply to / quote a specific message | Could |
| FR-02.6 | Chat supports basic formatting (bold, italic, links) | Could |

### FR-03: File Sharing

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-03.1 | Any participant can send a file to all other participants via WebRTC data channel | Must |
| FR-03.2 | File transfer shows progress indication (% complete) | Must |
| FR-03.3 | Recipients can accept or auto-download the file | Should |
| FR-03.4 | File size limit is configurable (default: 100MB) — large files are chunked for transfer | Must |
| FR-03.5 | Image files show an inline preview in the chat | Should |

### FR-04: Screen Sharing & Camera

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-04.1 | Any participant can share their screen with all others | Must |
| FR-04.2 | Any participant can share their camera and microphone | Must |
| FR-04.3 | Multiple participants can share camera simultaneously (grid view) | Should |
| FR-04.4 | Only one screen share is active at a time (or configurable) | Must |
| FR-04.5 | Participants can mute/unmute their audio and enable/disable their camera | Must |
| FR-04.6 | Screen share and camera streams are displayed in a responsive layout | Must |
| FR-04.7 | Participants can pin/spotlight a specific video feed | Should |

### FR-05: Polls

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-05.1 | Any participant can create a poll with a question and multiple options | Must |
| FR-05.2 | The poll creator can configure single-choice or multi-choice voting | Must |
| FR-05.3 | All participants are notified when a poll is created and can vote | Must |
| FR-05.4 | Results update in real-time as votes come in | Must |
| FR-05.5 | The poll creator (or host) can close the poll to stop further voting | Should |
| FR-05.6 | Voting can be anonymous or named (configurable per poll) | Should |
| FR-05.7 | Poll results show vote counts and percentages with a visual bar/chart | Must |
| FR-05.8 | Multiple polls can be active simultaneously | Should |

### FR-06: Planning Poker

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06.1 | Any participant can start a planning poker round with an optional topic/title | Must |
| FR-06.2 | All participants can select a card value from a predefined set (e.g., Fibonacci: 0, 1, 2, 3, 5, 8, 13, 21, ?, ☕) | Must |
| FR-06.3 | Votes are hidden until the round is revealed | Must |
| FR-06.4 | The round creator (or host) can reveal all votes simultaneously | Must |
| FR-06.5 | After reveal, results show each participant's vote, average, and consensus indicator | Must |
| FR-06.6 | The round creator (or host) can reset the round for re-voting | Must |
| FR-06.7 | Card set is configurable (Fibonacci, T-shirt sizes, custom values) | Should |
| FR-06.8 | A timer can optionally be set for each round | Could |

### FR-07: Shared Whiteboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-07.1 | Any participant can open a shared whiteboard canvas | Should |
| FR-07.2 | All participants can draw, write text, and add shapes simultaneously | Should |
| FR-07.3 | Drawing is synchronized in real-time across all peers using CRDTs | Should |
| FR-07.4 | Basic tools: pen, eraser, text, rectangle, circle, arrow, color picker, stroke width | Should |
| FR-07.5 | Participants can undo/redo their own actions | Should |
| FR-07.6 | The whiteboard can be exported as an image (PNG/SVG) | Could |

### FR-08: Collaborative Notepad

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-08.1 | Any participant can open a shared notepad | Should |
| FR-08.2 | All participants can type simultaneously with real-time sync (CRDT-based) | Should |
| FR-08.3 | Each participant's cursor is visible with their name/color | Should |
| FR-08.4 | Basic formatting: headings, bold, italic, bullet lists | Could |
| FR-08.5 | The notepad content can be exported as text or markdown | Could |

### FR-09: Retro Board

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-09.1 | Any participant can start a retro board with configurable columns (default: "Went Well", "Didn't Go Well", "Action Items") | Should |
| FR-09.2 | All participants can add sticky notes to any column | Should |
| FR-09.3 | Sticky notes can be anonymous or named (configurable) | Should |
| FR-09.4 | Participants can vote (dot-vote) on sticky notes to prioritize | Should |
| FR-09.5 | The board can be exported as a text summary | Could |

### FR-10: Dot Voting

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10.1 | Any participant can create a dot-voting session with a list of options | Should |
| FR-10.2 | Each participant receives N dots (configurable, default: 3) to distribute across options | Should |
| FR-10.3 | A participant can place multiple dots on a single option | Should |
| FR-10.4 | Results show total dots per option, sorted by votes | Should |
| FR-10.5 | The session can be revealed all at once or shown in real-time (configurable) | Could |

### FR-11: Shared Timer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-11.1 | Any participant can start a countdown timer visible to all | Should |
| FR-11.2 | Timer can be paused, resumed, and reset by anyone | Should |
| FR-11.3 | An alert/notification is shown to all when the timer expires | Should |
| FR-11.4 | Stopwatch mode (count up) is also available | Could |

### FR-12: Quick Reactions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-12.1 | Participants can send quick emoji reactions (👍 👎 😂 🎉 ❓ ☕) visible to all | Should |
| FR-12.2 | Reactions appear as transient overlays/toasts (disappear after a few seconds) | Should |
| FR-12.3 | A "raise hand" reaction persists until manually dismissed by the sender | Should |

---

## Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-01 | The app must work as a PWA — installable on mobile (iOS, Android) and desktop (Chrome, Edge, Firefox) | Must |
| NFR-02 | The app must function entirely client-side except for the signaling service and STUN/TURN | Must |
| NFR-03 | The signaling service must be stateless and horizontally scalable (serverless-friendly) | Must |
| NFR-04 | Session state must be fully replicated across all peers — no single point of failure except during host migration | Must |
| NFR-05 | Host migration must complete within 5 seconds of detecting host loss | Must |
| NFR-06 | The app must support at least 8 simultaneous participants per session | Must |
| NFR-07 | The app should support up to 20 participants for text-only features (chat, polls, poker) | Should |
| NFR-08 | UI must be responsive — usable on mobile screens (360px+) and desktop | Must |
| NFR-09 | The app must work on latest versions of Chrome, Firefox, Safari, and Edge | Must |
| NFR-10 | All WebRTC connections must use encryption (DTLS-SRTP) | Must |
| NFR-11 | The app must handle peer disconnection/reconnection gracefully (auto-reconnect within 10s window) | Must |
| NFR-12 | First meaningful paint must be under 2 seconds on 4G connection | Should |
| NFR-13 | The app must work offline for the landing/create page (service worker caching) | Should |
| NFR-14 | Accessibility: WCAG 2.1 AA compliance for all UI components | Should |

---

## Technical Constraints & Decisions (To Be Made)

| Decision | Options | Notes |
|----------|---------|-------|
| Frontend framework | React, Vue, Svelte, SolidJS | TBD — should support PWA easily |
| WebRTC library | PeerJS, simple-peer, raw WebRTC API | PeerJS has built-in signaling server; simple-peer is lighter |
| CRDT library | Yjs, Automerge | For whiteboard and notepad sync |
| Signaling service | PeerJS Cloud (free), Firebase Realtime DB, Cloudflare Workers, custom serverless | Must be stateless and cheap/free |
| TURN server | Twilio, Metered, self-hosted coturn, none (accept some users can't connect) | Cost consideration |
| State management | Zustand, Jotai, Redux, built-in framework state | Should integrate well with CRDT layer |
| Styling | Tailwind CSS, CSS Modules, Shadcn/UI | TBD |
| Build tool | Vite | Strong PWA plugin support |
| Testing | Vitest, Playwright | Unit + E2E |

---

## Milestones (Suggested)

### M1 — Core Session (MVP)
- Session creation and invite link
- Peer-to-peer connection via WebRTC
- Participant list with display names
- Host migration on disconnect
- Basic chat

### M2 — Voting Features
- Polls (single and multi-choice)
- Planning Poker
- Dot Voting

### M3 — Media
- Screen sharing
- Camera and microphone sharing
- Grid layout for video feeds

### M4 — Collaboration Tools
- Shared Whiteboard
- Collaborative Notepad
- Shared Timer
- Quick Reactions

### M5 — Advanced Features
- Retro Board
- File sharing
- Lobby mode and session passwords
- Export functionality for all tools

### M6 — Polish & Production
- PWA optimization (offline, install prompts)
- Accessibility audit
- Performance optimization for mobile
- TURN server configuration
- E2E testing suite

---

## Open Questions

1. **Session size limit** — Hard cap at 8 for video, 20 for text? Or dynamic based on detected performance?
2. **Persistence** — Should there be an optional "save session summary" feature (exported locally, not server-stored)?
3. **Authentication** — Is self-declared identity sufficient for v1, or do we need verified identity from the start?
4. **Monetization** — Free with TURN server costs absorbed, or freemium with larger session sizes as paid tier?
5. **Branding/Name** — "CollabSpace" is a working title. Final name TBD.
6. **Mobile native** — PWA only, or also plan for Capacitor/native wrapper for app store distribution?
