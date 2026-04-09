# Plan: Connection Settings, TURN Support, and Improved Join Flow

## Context

Three problems to solve:
1. **Corporate firewalls block P2P** — needs configurable TURN servers and signaling strategies
2. **No connection configuration** — users can't choose which signaling strategies or servers to use
3. **Poor join experience** — joiners don't provide a name on the join form, password errors aren't clear, and connection failures show no recovery option

## Part 1: Improved Join Flow

### Current problems with joining
- The "Join" section only has a room code input — no name or password field
- If the room has a password, the joiner sees "Connecting to room..." then a password gate, but must already have set their name elsewhere
- If connection fails (all relays down), joiner is stuck forever with no error or retry option

### Changes to `src/components/Landing.tsx`
- Add a **name field** to the join section (reuse the existing name signal, already at top)
- Add an **optional password field** to the join section
- Pass the password in the URL hash when joining: `#/room/<code>?pw=<base64>` (same encoding as creator)
- Validate: name is required before joining (disable Join button if empty)

### Changes to `src/components/RoomView.tsx` — Connection timeout with recovery
- Track connection state: `'connecting' | 'connected' | 'failed'`
- After **30 seconds** without any peer connection or meta sync, transition to `'failed'` state
- **Failed state UI** shows:
  - "Could not connect to room" message
  - "Try Again" button (destroys and recreates trystero room)
  - "Create New Room" button (navigates to landing)
  - "Connection Settings" button (opens settings to try different relays/TURN)
- Reset the 30s timer on any successful relay WebSocket connection

### Changes to `src/components/PasswordGate.tsx`
- Already handles wrong password error display — no changes needed
- The password gate already shows after P2P sync delivers the password hash

### Changes to `src/hooks/useHashRouter.ts`
- Already parses `?pw=` param — joiners with password in URL will auto-verify
- No changes needed

## Part 2: Configurable Connection Settings

### New type: `ConnectionSettings` (`src/lib/connection-settings.ts`)

```ts
type ConnectionSettings = {
  mqtt: { enabled: boolean; servers: string[] };
  torrent: { enabled: boolean; servers: string[] };
  turn: {
    mode: 'auto' | 'custom' | 'disabled';
    customUrl?: string;
    username?: string;
    credential?: string;
  };
};
```

- `DEFAULT_MQTT_SERVERS` = current 5 MQTT brokers
- `DEFAULT_TORRENT_SERVERS` = current 4 BitTorrent trackers
- `getConnectionSettings()` / `saveConnectionSettings()` — localStorage key `collabspace:connectionSettings`
- At least one strategy (MQTT or torrent) must be enabled — validate on save

### New file: `src/lib/turn-config.ts`

TURN credential logic (no backend needed):

- `generateOpenRelayCredentials(): Promise<TurnServerConfig[]>` — HMAC-SHA1 via `crypto.subtle` for Metered open relay
  - Server: `staticauth.openrelay.metered.ca`, secret: `openrelayprojectsecret` (publicly documented)
  - Username = `<unix_expiry_24h>`, Credential = `Base64(HMAC-SHA1(secret, username))`
  - URLs: `turns:global.relay.metered.ca:443?transport=tcp`, `turn:global.relay.metered.ca:80?transport=tcp`
- `buildTurnServers(settings): Promise<TurnServerConfig[]>` — returns open relay creds, custom config, or `[]`

### Modified: `src/lib/trystero.ts`

- `createTrysteroRoom(roomCode, settings, turnServers)` — accept `ConnectionSettings` + resolved TURN servers
- Conditionally create MQTT room only if `settings.mqtt.enabled` (use `settings.mqtt.servers`)
- Conditionally create torrent room only if `settings.torrent.enabled` (use `settings.torrent.servers`)
- Pass `turnConfig: turnServers` to both join calls
- Handle single-strategy mode (only MQTT or only torrent)
- Extend `ConnectionStatus` with active TURN info

### Modified: `src/hooks/useRoom.ts`

- Load settings via `getConnectionSettings()`
- Async init: `await buildTurnServers(settings)` then `createTrysteroRoom(roomCode, settings, turnServers)`
- Expose `reconnect(newSettings): Promise<void>`:
  1. `provider.destroy()` + `trystero.leave()`
  2. Build new TURN servers
  3. Create new trystero room with new settings
  4. Create new `TrysteroProvider` on the **existing** Yjs doc (doc survives reconnect)
  5. Re-register peer handlers + awareness
- Expose `connectionSettings` signal

### New: `src/components/ConnectionSettingsPanel.tsx`

Full settings UI (dropdown from header gear icon):

```
┌─ Connection Settings ────────────── X ┐
│                                        │
│ MQTT Signaling                [ON/OFF] │
│  broker.hivemq.com              [x]    │
│  broker.emqx.io                 [x]    │
│  test.mosquitto.org             [x]    │
│  + Add server                          │
│                                        │
│ BitTorrent Signaling          [ON/OFF] │
│  tracker.webtorrent.dev         [x]    │
│  tracker.openwebtorrent.com     [x]    │
│  + Add server                          │
│                                        │
│ TURN Relay                             │
│  ○ Auto (Open Relay)                   │
│  ○ Custom server                       │
│    URL: [turns://...]                  │
│    Username: [...]                     │
│    Password: [...]                     │
│  ○ Disabled                            │
│                                        │
│ [Reset Defaults]    [Apply & Reconnect]│
└────────────────────────────────────────┘
```

- Accessible from: header gear icon (in-room) + Landing advanced options (pre-room)
- "Apply & Reconnect" calls `room.reconnect(newSettings)` — briefly disconnects, rebuilds transport, reconnects
- "Reset to Defaults" restores all default servers
- Validation: at least one strategy must be enabled

### Modified: `src/components/RoomView.tsx`

- Add gear icon button in header → toggles `showConnectionSettings`
- Render `<ConnectionSettingsPanel>` as overlay
- Pass `room.reconnect` and `room.connectionSettings` to the panel

### Modified: `src/components/Landing.tsx`

- "Connection settings" link in advanced options → opens `ConnectionSettingsPanel` inline
- Join section: ensure name field is present, add optional password field

### Modified: `src/components/ConnectionStatus.tsx`

- Show active TURN mode ("Open Relay" / "Custom: hostname" / "Disabled")
- Show which strategies are active

## Data Flow

```
Landing.tsx
  ├── Name + Room code + Password → navigate to #/room/<code>?pw=<base64>
  └── Connection Settings → localStorage

RoomView.tsx → useRoom()
  ├── getConnectionSettings() from localStorage
  ├── buildTurnServers(settings)  [async HMAC generation]
  └── createTrysteroRoom(code, settings, turnServers)
        ├── mqttJoin()     (if mqtt.enabled, with mqtt.servers)
        └── torrentJoin()  (if torrent.enabled, with torrent.servers)

Reconnect (live room):
  ConnectionSettingsPanel → "Apply & Reconnect"
    → room.reconnect(newSettings)
      1. provider.destroy() + trystero.leave()
      2. buildTurnServers(newSettings)
      3. createTrysteroRoom(code, newSettings, newTurnServers)
      4. new TrysteroProvider(existingDoc, newTrystero)

Connection failure (30s timeout):
  RoomView → "Could not connect" screen
    → "Try Again" → reconnect with same settings
    → "Create New Room" → navigate to landing
    → "Connection Settings" → open settings panel
```

## Verification

1. `npx tsc -b` — type check
2. `npx vitest run` — 32 unit tests pass
3. `npm run build` — production build succeeds
4. Manual: join a room with name + password in join form
5. Manual: wrong password shows error, correct password lets you in
6. Manual: connection failure after 30s shows recovery options
7. Manual: open Connection Settings, disable MQTT, apply → reconnects via torrent only
8. Manual: configure custom TURN server, apply → verify in Connection Status panel
9. Manual: test from corporate network with TURN auto (open relay)
10. `npm run test:e2e` — existing E2E collaboration tests pass
