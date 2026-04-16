# Plan: Mandatory Pre-Join Lobby, Mandatory Passwords, Shorter Invite Links

## Context

Currently, when someone clicks an invite link (`#/room/{code}?turn=...`), the hash router sends them **directly into RoomView** — bypassing any name or password prompt. The display name silently defaults to "Anonymous" from localStorage, and passwords are entirely optional (hidden behind expandable toggles). This means:

- Invited users can enter rooms without identifying themselves
- Rooms can be created without any password protection
- The only password challenge happens *after* connecting, via the canary-verification `PasswordGate`
- Invite URLs are excessively long due to base64-encoded TURN server JSON (~800+ chars)

This plan introduces a **mandatory pre-join lobby screen**, makes **passwords required everywhere**, and **compresses invite links** by ~85%.

---

## Phase 1: Router — Add `lobby` Route

**File:** [useHashRouter.ts](src/hooks/useHashRouter.ts)

### Changes

1. **Expand the `Route` union type** to include a `lobby` page:

```typescript
export type Route =
  | { page: 'landing' }
  | { page: 'lobby'; roomCode: string; sharedTurn?: TurnServerConfig[] }
  | { page: 'room'; roomCode: string; password: string; isCreator: boolean; sharedTurn?: TurnServerConfig[] };
```

Note: `password` on the `room` route becomes non-optional (`string` not `string | undefined`) since passwords are now mandatory.

2. **Modify `parseHash()` logic**:

| URL has `creator=1`? | URL has `pw=`? | Route result |
|---|---|---|
| Yes | Yes | `room` (creator enters directly) |
| Yes | No | `landing` (invalid — creator must have password) |
| No | Yes | `room` (joiner already provided password via lobby) |
| No | No | `lobby` (need to collect name + password) |

This means:
- **Invite links** (no `pw=`, no `creator=1`) → lobby
- **After lobby submits** (adds `pw=` to hash) → room
- **Creator from Landing** (has `creator=1` + `pw=`) → room

---

## Phase 2: New Lobby Component

**New file:** `src/components/Lobby.tsx`

### Props
```typescript
interface LobbyProps {
  roomCode: string;
  sharedTurn?: TurnServerConfig[];
}
```

### UI Structure (reuses existing Card, Button, Input components)

```
<Card class="w-full max-w-md space-y-6">
  Header: "CollabSpace" + "Joining room: {roomCode}"
  
  Input: "Your name" (required, pre-populated from localStorage)
  Input: "Room password" (required)
  
  Toggle: "Connection settings..." (expandable)
    <ConnectionSettingsPanel settings={...} onApply={save} onClose={collapse} />
  
  Buttons: [Back to Home] [Join Room (disabled until name+password filled)]
</Card>
```

### Behavior

- Pre-populates name from `getDisplayName()` (localStorage)
- Both name and password are required — Join button disabled until both filled
- On submit:
  1. `setDisplayName(name)` — persist to localStorage
  2. Navigate to `#/room/{roomCode}?pw={base64password}` (+ `&turn={encoded}` if sharedTurn exists)
  3. Router re-parses → `pw` present → routes to `room` → RoomView mounts
- Connection settings: Uses `ConnectionSettingsPanel` with `showReconnect={false}` (not yet connected). On apply, saves to localStorage via `saveConnectionSettings()` so `useRoom` picks them up.
- Back button: `window.location.hash = '/'` → landing page

### Reused Components
- `Card`, `Button`, `Input` from `src/components/ui/`
- `ConnectionSettingsPanel` from `src/components/ConnectionSettingsPanel.tsx`
- `getDisplayName`/`setDisplayName` from `src/lib/storage.ts`
- `getConnectionSettings`/`saveConnectionSettings` from `src/lib/connection-settings.ts`

---

## Phase 3: App.tsx — Add Lobby Route

**File:** [App.tsx](src/App.tsx)

Add a `<Match>` for the new `lobby` route:

```tsx
<Match when={route().page === 'lobby'}>
  {(() => {
    const r = route() as { page: 'lobby'; roomCode: string; sharedTurn?: TurnServerConfig[] };
    return <Lobby roomCode={r.roomCode} sharedTurn={r.sharedTurn} />;
  })()}
</Match>
```

---

## Phase 4: Landing Page — Mandatory Password

**File:** [Landing.tsx](src/components/Landing.tsx)

### Create Room section
- **Remove** `showAdvanced` signal and "Room options..." toggle button
- **Move** password Input to always-visible position (between name and Create button)
- **Change label** from "Room password (optional)" → "Room password"
- **Change placeholder** from "Leave empty for open room" → "Choose a password"
- **Update validation**: `canCreate = () => !!name().trim() && !!password().trim()`
- **Simplify `handleCreate`**: Remove the no-password branch (password is always present)

### Join Room section
- **Remove** `showJoinOptions` signal and "Room has a password?" toggle button
- **Move** join password Input to always-visible position below room code
- **Change label** to "Room password"
- **Update validation**: `canJoin = () => !!name().trim() && !!joinCode().trim() && !!joinPassword().trim()`
- **Simplify `handleJoin`**: Remove the no-password branch

---

## Phase 5: Shorter Invite Links

### Problem
TURN server credentials serialized as `btoa(JSON.stringify([...fullObjects...]))` produce ~800-1000 character URL fragments.

### Solution: Provider ID Encoding

**New file:** `src/lib/turn-encoding.ts`

Instead of serializing full TURN server objects for built-in providers, encode only their IDs. The joiner's client already has `DEFAULT_TURN_PROVIDERS` and can reconstruct full configs locally.

**Compact format:**
```json
{
  "b": ["openrelay-global", "openrelay-us"],     // built-in provider IDs
  "c": [{"urls":["turn:custom.com"], ...}]        // custom servers (full objects)
}
```

vs. old format (raw array of full TurnServerConfig objects).

**Estimated size reduction:** ~85% for typical usage (all built-in providers). From ~800+ chars to ~120 chars.

**Backward compatibility:** `decodeTurnServers()` detects old format (plain array) vs new format (object with `b`/`c` keys) and handles both.

### Files Modified

1. **`src/lib/turn-encoding.ts`** (new) — `encodeTurnServers()` and `decodeTurnServers()` functions
2. **[share.ts](src/lib/share.ts)** — `getShareUrl()` uses `encodeTurnServers()` instead of raw `btoa(JSON.stringify(...))`
3. **[useHashRouter.ts](src/hooks/useHashRouter.ts)** — TURN parsing uses `decodeTurnServers()` instead of raw `JSON.parse(atob(...))`

### Optional: SharePanel Toggle

Add a checkbox in [SharePanel.tsx](src/components/SharePanel.tsx) to let users choose whether to include TURN in the link. When unchecked, the URL is just `#/room/{roomCode}` — extremely short. The joiner uses their own default TURN settings.

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useHashRouter.ts` | Modify | Add `lobby` route, modify `parseHash()` logic, use `decodeTurnServers` |
| `src/App.tsx` | Modify | Add `<Match>` for lobby route |
| `src/components/Lobby.tsx` | **Create** | Pre-join lobby screen (name + password + optional settings) |
| `src/components/Landing.tsx` | Modify | Make password mandatory, remove optional toggles |
| `src/lib/turn-encoding.ts` | **Create** | Compact TURN encoding/decoding |
| `src/lib/share.ts` | Modify | Use compact TURN encoding in `getShareUrl()` |
| `src/components/SharePanel.tsx` | Modify | Optional: add toggle for TURN inclusion |

---

## Data Flow Diagrams

### Creator Flow
```
Landing (name + password required)
  → #/room/{code}?creator=1&pw={base64}
  → Router: creator=1 + pw → room route
  → RoomView
```

### Manual Joiner Flow (from Landing)
```
Landing (name + room code + password required)
  → #/room/{code}?pw={base64}
  → Router: pw present → room route
  → RoomView
```

### Invite Link Joiner Flow (NEW)
```
Click invite: #/room/{code}?turn={compact}
  → Router: no pw → lobby route
  → Lobby (name + password required)
  → #/room/{code}?pw={base64}&turn={compact}
  → Router: pw present → room route
  → RoomView
```

### Wrong Password (unchanged)
```
RoomView → useRoom → canary fails → authState='failed' → PasswordGate
  → User retries password → reconnect with new key
```

---

## Verification

1. **Create a room** from Landing — password field must be visible and required (no toggle)
2. **Copy invite link** — should be significantly shorter than before
3. **Open invite link in incognito** — should see Lobby screen with name + password fields
4. **Enter wrong password in Lobby** — should enter room but PasswordGate appears after canary fails
5. **Enter correct password in Lobby** — should enter room successfully, name shown in participant list
6. **Join via room code on Landing** — password field visible and required (no toggle)
7. **Old invite links** (with full TURN JSON) — should still work (backward-compatible decoding)
8. **Page refresh while in room** — URL has `pw=`, so user goes back to RoomView directly (not lobby again)
9. **Connection settings in Lobby** — expand, modify, apply → settings saved before joining
