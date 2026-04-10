# Plan: Audio/Video, Notification System, and Share Button

## Context

CollabSpace v2 is a zero-infrastructure P2P collaboration PWA. The original requirements deliberately cut audio/video due to complexity, but trystero (the P2P library) already has **built-in media stream support** (`addStream`, `removeStream`, `onPeerStream`, track-level control). TURN relay is already configured (Metered Open Relay). The 6-peer mesh limit is at the edge of feasibility for video but workable.

This plan adds three major features:
1. **Audio/Video Sharing** — peer-to-peer media streams via trystero
2. **Notification System** — toast-style invites when peers start features
3. **Share Button** — QR code, WhatsApp, Web Share API, copy link (replaces "Copy Link")

---

## Milestones

| Milestone | Features | Dependencies |
|-----------|----------|--------------|
| **M5a** | Share Button | QR code library |
| **M5b** | Notification System | None (uses Yjs) |
| **M5c** | Audio/Video Sharing | Notification system (M5b) for invites |

Build order: M5a → M5b → M5c (share button is standalone; notifications needed before audio/video so invites work).

---

## New Dependencies

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `qrcode-generator` | Lightweight QR code generation (~3KB gzipped) | Minimal |

No other new dependencies needed — trystero already provides the media API, and notifications use existing Yjs infrastructure.

---

## M5a: Share Button

### Task Breakdown

| ID | Title | Agent | Priority |
|----|-------|-------|----------|
| T-031 | Share panel component with QR, WhatsApp, copy link | frontend-expert | must |
| T-032 | QR code generation utility | backend-expert | must |
| T-033 | Share button design spec | uiux-designer | must |

### Files to Create

**`src/lib/share.ts`** — Share utilities (extracted from RoomView inline logic)
- `getShareUrl(roomCode)` — constructs full URL (currently inline at RoomView:101)
- `copyToClipboard(text)` — wraps navigator.clipboard.writeText with error handling
- `canUseWebShareAPI()` — feature-detects navigator.share
- `shareViaWebAPI(roomCode)` — calls navigator.share({ title, url })
- `getWhatsAppShareUrl(roomCode)` — returns `https://wa.me/?text=...` URL
- `generateQRCodeSVG(text, size)` — uses qrcode-generator to produce SVG string

**`src/components/SharePanel.tsx`** — Share dropdown/modal
- Triggered by new "Share" button in header (replaces "Copy Link")
- Layout:
  ```
  ┌──────────────────────────────┐
  │  Share Room                  │
  │  ┌────────────────────────┐  │
  │  │                        │  │
  │  │     [QR Code Image]    │  │
  │  │                        │  │
  │  └────────────────────────┘  │
  │                              │
  │  [📋 Copy Link        ]     │
  │  [💬 Share via WhatsApp]     │
  │  [📤 Share...         ]     │  ← Only if navigator.share available
  └──────────────────────────────┘
  ```
- QR code: displays join URL as scannable code (centered, ~200x200px)
- Copy Link: copies URL to clipboard, shows "Copied!" feedback
- WhatsApp: opens `https://wa.me/?text=Join+my+CollabSpace+room:+{url}`
- Native Share: uses `navigator.share({ title: 'CollabSpace Room', url })` on supported browsers
- Style: same as ConnectionStatusPanel (absolute dropdown, bg-surface-800/95, backdrop-blur)

### Files to Modify

**`src/components/RoomView.tsx`**
- Add `showSharePanel` signal
- Replace "Copy Link" button with "Share" button
- Render `<SharePanel>` conditionally
- Pass room URL and close handler

**`package.json`**
- Add `qrcode-generator` dependency

### UI Design (Share Button)

**Header placement:**
```
[room-code] [●status] [⚙] [👥] [Timer]  ...  [Share] [Leave]
```

- "Share" button uses ghost variant, same position as current "Copy Link"
- On click: toggles SharePanel dropdown below the button
- Click outside or close button dismisses

---

## M5b: Notification System

### Task Breakdown

| ID | Title | Agent | Priority |
|----|-------|-------|----------|
| T-034 | Notification data model + Yjs integration | backend-expert | must |
| T-035 | useNotifications hook | backend-expert | must |
| T-036 | NotificationToast component | frontend-expert | must |
| T-037 | Notification trigger integration (poker, polls, timer, chat) | backend-expert | must |
| T-038 | Notification design spec | uiux-designer | must |

### Architecture

**Recommended: Yjs Y.Array** (not awareness) for notification dispatch.

Awareness is per-client state — it works for "who has their hand raised" but not well for "dispatch an event to everyone." If Peer A sets a `lastNotification` field, there's no clean way to know if all peers have received it before clearing. **Y.Array with TTL-based pruning** is simpler and matches the existing reactions pattern exactly (append-only, prune entries older than the auto-dismiss timeout).

```typescript
// Yjs doc schema addition:
// doc.getArray<NotificationEvent>('notifications')

interface NotificationEvent {
  id: string;
  type: 'poker_started' | 'poll_created' | 'timer_started' | 'media_started' | 'chat_message';
  fromPeerId: string;
  fromPeerName: string;
  message: string;          // "Alex started Planning Poker"
  targetTab?: Tab;          // Which tab to switch to (if applicable)
  timestamp: number;        // For deduplication + TTL pruning
}
```

**Dispatch flow:**
1. Hook calls `dispatchNotification(doc, event)` → pushes to Y.Array
2. Y.Array syncs to all peers via Yjs CRDT
3. Each peer's `useNotifications` hook observes the array, filters out self-events, and shows toasts
4. Entries older than 15s are pruned automatically (slightly longer than 8s display to handle clock drift)

**Rate limiting:** For chat messages, only dispatch one `chat_message` notification per 5 seconds to avoid spam.

### Files to Create

**`src/lib/notifications.ts`** — Notification types and helpers
- `NotificationType` union type
- `NotificationEvent` interface
- `getNotifications(doc)` — returns the notifications Y.Array
- `dispatchNotification(doc, type, fromPeerId, fromPeerName, message, targetTab?)` — pushes event to Y.Array
- `getActiveNotifications(doc, localPeerId)` — returns events from last 8s, excluding self
- `pruneNotifications(doc)` — removes entries older than 15s
- `NOTIFICATION_DISPLAY_MS = 8000` — auto-dismiss timeout
- `NOTIFICATION_ICONS` map — emoji/icon per notification type
- `NOTIFICATION_ACTIONS` map — action label per type ("Go to Poker", "Go to Chat", etc.)

**`src/hooks/useNotifications.ts`** — Notification state management
- Observes awareness changes from other peers
- Maintains local array of active notifications (max 3 stacked)
- Deduplicates by event ID
- Ignores own notifications (filters by peerId !== local)
- Auto-dismiss after 8 seconds
- Returns: `{ notifications, dismiss(id), performAction(id) }`
- `performAction` returns the target tab name so RoomView can switch

**`src/components/NotificationToast.tsx`** — Toast UI
- Position: fixed top-right (below header), `z-40`
- Stack: vertical, newest on top, max 3 visible
- Each toast:
  ```
  ┌────────────────────────────────────┐
  │ 🃏  Alex started Planning Poker    │
  │ [Go to Poker]            [✕]      │
  └────────────────────────────────────┘
  ```
- Entrance animation: slide-in from right + fade-in
- Exit animation: fade-out
- Action button: primary style, small
- Dismiss: ghost X button
- Progress bar at bottom showing auto-dismiss countdown (8s)
- Style: bg-surface-800/95, border-primary-500/30 left accent, backdrop-blur

### Files to Modify

**`src/lib/yjs-doc.ts`** — Add `notifications` Y.Array to the doc schema
- Add `doc.getArray<NotificationEvent>('notifications')` accessor function

**`src/lib/types.ts`** — Add notification types
- Add `NotificationType` union, `NotificationEvent` interface

**`src/app.css`** — Add slide-in-right animation for toasts
- New keyframes: `slide-in-right` (200ms, ease-out) matching existing `slide-in-left` pattern

**`src/hooks/usePolls.ts`** — Add notification emit on `createPoll`
```typescript
createPoll: (question, options, type) => {
  const pollId = createPoll(doc, question, options, type, localPeerId, localName);
  emitNotification(awareness, {
    type: 'poll_created',
    message: `${localName} created a poll`,
    targetTab: 'polls',
  });
  return pollId;
}
```
- Needs awareness parameter added to hook

**`src/hooks/usePoker.ts`** — Add notification emit on `startRound`

**`src/hooks/useTimer.ts`** — Add notification emit on `start`

**`src/components/RoomView.tsx`** — Integrate notifications
- Create `useNotifications(awareness, localPeerId)` in RoomView
- Render `<NotificationToast>` stack
- Handle action clicks by switching `activeTab`
- Pass awareness to poll/poker/timer hooks

### Notification Triggers

| Event | Notification Message | Action Button | Target Tab |
|-------|---------------------|---------------|------------|
| Poker round started | "{name} started Planning Poker" | Go to Poker | poker |
| Poll created | "{name} created a poll" | Go to Polls | polls |
| Timer started | "{name} started a timer" | Go to Timer | timer |
| Chat message (when not on chat) | "{name} sent a message" | Go to Chat | chat |
| Audio/Video started | "{name} started audio/video" | Join Call | (special: enables media) |

---

## M5c: Audio/Video Sharing

### Task Breakdown

| ID | Title | Agent | Priority |
|----|-------|-------|----------|
| T-039 | Extend TrysteroRoom for media streams | backend-expert | must |
| T-040 | useMedia hook (getUserMedia, stream management) | backend-expert | must |
| T-041 | Media controls in header (mic/camera toggles) | frontend-expert | must |
| T-042 | VideoGrid component (peer video tiles) | frontend-expert | must |
| T-043 | Media state in awareness (who has audio/video on) | backend-expert | must |
| T-044 | Audio/Video notification integration | backend-expert | should |
| T-045 | Audio/Video design spec | uiux-designer | must |
| T-046 | Audio/Video E2E tests | qa-agent | should |

### Architecture

```
getUserMedia() → local MediaStream
        ↓
trysteroRoom.addStream(stream) → WebRTC → remote peers
        ↓
onPeerStream(stream, peerId) → store in remoteStreams Map
        ↓
VideoGrid renders <video> elements for each stream
        ↓
Awareness syncs media state: { audioEnabled, videoEnabled }
```

### Files to Create

**`src/lib/media.ts`** — Media utilities
- `requestMedia(audio: boolean, video: boolean)` → `Promise<MediaStream>` — wraps getUserMedia with error handling
- `stopStream(stream: MediaStream)` — stops all tracks
- `toggleAudioTrack(stream, enabled)` — mutes/unmutes audio track
- `toggleVideoTrack(stream, enabled)` — enables/disables video track
- Media constraints: `{ audio: true, video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } } }` — conservative for mesh topology

**`src/hooks/useMedia.ts`** — Media state management hook
```typescript
export function useMedia(
  trysteroRoom: TrysteroRoom,
  awareness: Awareness,
  localPeerId: string,
  localName: string,
) {
  const [localStream, setLocalStream] = createSignal<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = createSignal<Map<string, MediaStream>>(new Map());
  const [audioEnabled, setAudioEnabled] = createSignal(false);
  const [videoEnabled, setVideoEnabled] = createSignal(false);
  const [mediaError, setMediaError] = createSignal<string | null>(null);
  const [peerMediaState, setPeerMediaState] = createSignal<Map<string, { audio: boolean; video: boolean }>>(new Map());

  // Start media: request permissions, add stream to room
  async function startMedia(audio: boolean, video: boolean) { ... }

  // Stop all media
  function stopMedia() { ... }

  // Toggle audio mute (keeps stream, just disables track)
  function toggleAudio() { ... }

  // Toggle video (keeps stream, just disables track)
  function toggleVideo() { ... }

  // Listen for remote streams
  trysteroRoom.onPeerStream((stream, peerId) => { ... });

  // Sync media state via awareness
  // awareness.setLocalStateField('media', { audio, video });

  // Track peer media state from awareness
  awareness.on('change', () => { ... });

  return {
    localStream, remoteStreams, audioEnabled, videoEnabled,
    mediaError, peerMediaState,
    startMedia, stopMedia, toggleAudio, toggleVideo,
    hasActiveMedia: () => audioEnabled() || videoEnabled(),
    anyPeerHasMedia: () => ...,
  };
}
```

**`src/components/VideoGrid.tsx`** — Video tile display
- Renders local + remote video streams in a responsive grid
- Appears above the tab content area when anyone has video enabled
- Collapses to audio-only indicator strip when only audio (no video) is active
- Layout:
  ```
  1 peer:  [=========video=========]
  2 peers: [====video====] [====video====]
  3 peers: [===vid===] [===vid===] [===vid===]
  4-6:     2x3 grid
  ```
- Each tile shows:
  - `<video>` element (autoplay, muted for local, playsInline)
  - Participant name overlay (bottom-left)
  - Muted mic icon overlay (bottom-right, when audio disabled)
  - Camera-off placeholder (avatar/initials when video disabled but audio on)
- Responsive: full width on mobile, proportional on desktop
- Max height: 40vh (so tab content remains visible)
- Smooth enter/exit animations

**`src/components/MediaControls.tsx`** — Header media buttons
- Two small icon buttons in the header: microphone + camera
- States:
  - Inactive (default): `text-surface-400 hover:bg-surface-700/50`
  - Active (streaming): `bg-success/20 text-success`
  - Muted (active but muted): `bg-error/20 text-error` with strikethrough icon
- Clicking when inactive: starts media (prompts permission)
- Clicking when active: toggles mute/camera
- Long-press or secondary action: stops media entirely

### Critical: Expose TrysteroRoom from useRoom

The `useMedia` hook needs access to the `TrysteroRoom` object to call `addStream`, `onPeerStream`, etc. Currently `trystero` is a private `let` inside `useRoom` that changes on reconnect.

**Modify `src/hooks/useRoom.ts`:**
- Add a signal: `const [trysteroRef, setTrysteroRef] = createSignal<TrysteroRoom | null>(null);`
- Set it in `wireTransport`: `setTrysteroRef(t);`
- Clear it in `teardownTransport`: `setTrysteroRef(null);`
- Return `trysteroRoom: trysteroRef` from the hook

The `useMedia` hook reacts to `trysteroRoom()` changes. On reconnect, it re-registers `onPeerStream` handlers and re-adds the local stream to the new room. Remote streams are cleared (peers will re-send when the new connection is established).

### Files to Modify

**`src/lib/trystero.ts`** — Extend TrysteroRoom interface
```typescript
export interface TrysteroRoom {
  // ... existing methods ...
  addStream: (stream: MediaStream, targetPeers?: string[]) => Promise<void>[];
  removeStream: (stream: MediaStream, targetPeers?: string[]) => void;
  onPeerStream: (cb: (stream: MediaStream, peerId: string, metadata?: any) => void) => void;
}
```
Wire these through from the primary trystero room (and secondary if available for redundancy — though media typically only goes through one path).

**`src/components/RoomView.tsx`** — Major layout changes
- Add `useMedia` hook
- Add `MediaControls` to header (between participants and timer)
- Add `VideoGrid` between header and tab bar (conditional on active media)
- Wire notification for media start
- Pass awareness to media hook

**`src/lib/types.ts`** — Add media types
```typescript
export interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
}
```
Also extend `Participant` with optional `audioEnabled?: boolean; videoEnabled?: boolean` fields.

**`src/lib/participants.ts`** — Read media awareness state
- In `getParticipantList`, read `state.media?.audioEnabled` and `state.media?.videoEnabled` from awareness and include in returned Participant objects.

**`src/components/ParticipantList.tsx`** — Show media indicators
- Small mic/camera icons next to participant names when audio/video is active
- Colored primary-400 when on, hidden when off

### UI Design (Audio/Video)

**Header with media controls:**
```
┌───────────────────────────────────────────────────────────────────┐
│ [room-code] [●] [⚙] [👥]    [🎤] [📹]    [⏱ 4:32]  [Share] [Leave] │
└───────────────────────────────────────────────────────────────────┘
```

**Video grid (when active, above tabs):**
```
┌───────────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │  You      │  │  Alex    │  │  Sam     │  Video grid           │
│  │  (local)  │  │  🎤      │  │  🔇      │  max-h-[40vh]        │
│  └──────────┘  └──────────┘  └──────────┘                       │
├─── Chat │ Polls │ Poker │ Timer │ Notes ────────────────────────│
│                                                                   │
│  [Tab content as before]                                          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Audio-only strip (when only audio, no video):**
```
┌───────────────────────────────────────────────────────────────────┐
│  🎤 You, Alex, Sam are in audio                                  │
├─── Chat │ Polls │ Poker │ Timer │ Notes ────────────────────────│
```

---

## Documentation Updates

### `CLAUDE.md`

**Tech Stack** — add after Rich Text line:
```
- **Media:** Trystero built-in WebRTC media streams (audio/video)
```

**Features section** (if it exists, or update the feature list references)

### `requirements-v2.md`

**Update "What We Deliberately Cut" section:**
- Move Video/Audio from "cut" to "implemented" with note about mesh limitations
- Update the alternative column

**Add new functional requirements:**
```
### FR-08: Audio/Video Sharing
| FR-08.1 | Users can toggle audio on/off in a room | Must |
| FR-08.2 | Users can toggle camera on/off in a room | Must |
| FR-08.3 | Remote audio/video streams displayed in a grid | Must |
| FR-08.4 | Users can mute/unmute at any time | Must |
| FR-08.5 | Media state visible to all participants via awareness | Must |
| FR-08.6 | Video grid collapses when no video active | Should |

### FR-09: Notification System
| FR-09.1 | Toast notification when peer starts a feature | Must |
| FR-09.2 | Notification includes action button to join feature | Must |
| FR-09.3 | Notifications auto-dismiss after timeout | Must |
| FR-09.4 | Users can manually dismiss notifications | Must |
| FR-09.5 | Max 3 stacked notifications visible | Should |

### FR-10: Share Room
| FR-10.1 | Share button with QR code | Must |
| FR-10.2 | Share via WhatsApp link | Must |
| FR-10.3 | Copy link to clipboard | Must |
| FR-10.4 | Native share API on supported browsers | Should |
```

**Update Open Questions:**
- Add resolved: "Video/Audio — Implemented via trystero's built-in media streams within the 6-peer mesh limit"

### `tasks.md`

Add new milestone sections:
- **M5a — Share Button**: T-031, T-032, T-033
- **M5b — Notification System**: T-034, T-035, T-036, T-037, T-038
- **M5c — Audio/Video Sharing**: T-039, T-040, T-041, T-042, T-043, T-044, T-045, T-046

### `release-notes.md`

Add entries after each milestone is completed (following existing format with What's New, New Files, Build Stats sections).

---

## Agent Assignments Summary

| Agent | Tasks |
|-------|-------|
| **backend-expert** | T-032 (QR util), T-034 (notification model), T-035 (useNotifications), T-037 (notification triggers), T-039 (trystero media), T-040 (useMedia), T-043 (media awareness), T-044 (media notifications) |
| **frontend-expert** | T-031 (SharePanel), T-036 (NotificationToast), T-041 (MediaControls), T-042 (VideoGrid) |
| **uiux-designer** | T-033 (share design), T-038 (notification design), T-045 (media design) |
| **qa-agent** | T-046 (media E2E tests) |
| **architect** | Security review on all PRs (media permissions, stream cleanup, no data leaks) |
| **code-reviewer** | QA pipeline on all PRs |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| **Video mesh at 6 peers is bandwidth-heavy** | Conservative constraints: 320x240 @ 15fps. Auto-lower to 240p when >3 peers. Consider SFU for future scaling. |
| **TURN relay rate limits** | Metered Open Relay is shared/rate-limited. Document that custom TURN recommended for heavy video use. |
| **getUserMedia permission denied** | Graceful error handling with clear UI message. Don't block other features. |
| **Bundle size increase** | QR library ~3KB, notifications ~2KB, media ~4KB ≈ 10KB total. Well within 200KB budget. Lazy-load VideoGrid + QR. |
| **Mobile video performance** | Lower constraints on mobile. Audio-only fallback. Test on real devices. `playsinline` critical for iOS Safari. |
| **Dual-strategy media routing** | Media goes through `primaryRoom` only (MQTT or BitTorrent, whichever is first). If a peer connects only via the secondary strategy, they won't receive media. Acceptable v1 limitation with TURN enabled. |
| **Media on reconnect** | When `reconnect()` rebuilds transport, `useMedia` must re-register `onPeerStream` and re-add local stream. Remote streams cleared (peers re-send). |
| **Notification spam** | Rate-limit chat notifications to 1 per 5s. Other notification types are infrequent by nature. |

---

## Verification

### Per-milestone testing:

**M5a (Share):**
- Share button appears in header
- QR code renders correctly for room URL
- Copy link works with clipboard feedback
- WhatsApp link opens correctly
- navigator.share works on supported browsers

**M5b (Notifications):**
- Starting poker shows toast to other peers
- Creating poll shows toast to other peers
- Starting timer shows toast to other peers
- Chat message shows toast when recipient not on chat tab
- Toast auto-dismisses after 8s
- Action button switches to correct tab
- No self-notifications

**M5c (Audio/Video):**
- Mic button toggles audio stream
- Camera button toggles video stream
- Remote streams appear in VideoGrid
- Mute/unmute works without dropping stream
- Camera off shows placeholder
- Video grid collapses when no one has video
- Audio-only strip shows when only audio active
- Notification sent to peers when media starts
- Leaving room stops all media tracks
- Works with TURN relay (test behind NAT if possible)
