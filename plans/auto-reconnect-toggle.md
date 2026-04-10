# Plan: Auto-Reconnect Toggle Feature

## Context

Currently, when relay connections (MQTT brokers / BitTorrent trackers) fail or close, the app has no automatic retry mechanism at the relay level — closed WebSockets stay closed. The only recovery path is the user manually clicking "Try Again" or "Apply & Reconnect" which tears down and rebuilds the entire transport.

This feature adds an **Auto-Reconnect** toggle to Connection Settings. When enabled (default), the app periodically detects closed relay connections and automatically reconnects them. When disabled, the app leaves failed connections alone and instead shows a **manual "Retry Connections" button** in the Connection Status panel so users can trigger a reconnect on demand.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/connection-settings.ts` | Add `autoReconnect: boolean` to `ConnectionSettings` type and defaults |
| `src/hooks/useRoom.ts` | Add auto-reconnect polling logic; expose a `retryFailedConnections` function |
| `src/lib/trystero.ts` | Add a `reconnectFailed()` method to `TrysteroRoom` that rebuilds only closed relays |
| `src/components/ConnectionSettingsPanel.tsx` | Add auto-reconnect toggle UI |
| `src/components/ConnectionStatus.tsx` | Add "Retry Connections" button when auto-reconnect is off and relays are closed |

---

## Detailed Changes

### 1. `src/lib/connection-settings.ts`

Add `autoReconnect` field to the `ConnectionSettings` type:

```typescript
export type ConnectionSettings = {
  mqtt: { enabled: boolean; servers: string[] };
  torrent: { enabled: boolean; servers: string[] };
  turn: {
    mode: TurnMode;
    customUrl?: string;
    username?: string;
    credential?: string;
  };
  autoReconnect: boolean;  // NEW
};
```

Update `getDefaultSettings()` to include `autoReconnect: true` (on by default — preserves current behavior).

Update `getConnectionSettings()` to handle missing field in persisted data (backward compatibility):
```typescript
if (parsed.autoReconnect === undefined) {
  parsed.autoReconnect = true;
}
```

### 2. `src/lib/trystero.ts`

The tricky part: trystero doesn't expose a per-relay reconnect API. When a WebSocket to a broker/tracker closes, it stays closed. The simplest reliable approach is a **full transport rebuild** (same as the existing `reconnect()` flow) because trystero's `joinRoom` creates fresh WebSocket connections.

However, a full `reconnect()` drops all peer connections momentarily. A lighter approach:

**Option A (Recommended — Full reconnect, simple):** Keep using the existing `reconnect()` mechanism but trigger it automatically or on button press. This is what the current "Apply & Reconnect" already does. The Yjs doc and chat history survive reconnects.

**Option B (Per-relay reconnect — complex):** Would require patching trystero internals or re-joining only the failed strategy. This is fragile and not worth the complexity.

**Go with Option A:** The `retryFailedConnections` function is simply a call to `reconnect()` with current settings. The auto-reconnect logic detects when relays have failed and triggers this.

Add to `TrysteroRoom` interface:
```typescript
hasFailedRelays: () => boolean;  // Returns true if any relay WebSocket is in 'closed' state
```

Implementation in `getConnectionStatus()` already tracks relay states, so `hasFailedRelays` is:
```typescript
hasFailedRelays: () => {
  const status = getConnectionStatus();
  return status.relays.some(r => r.state === 'closed');
}
```

### 3. `src/hooks/useRoom.ts`

Add auto-reconnect polling alongside the existing status polling:

```typescript
let autoReconnectInterval: ReturnType<typeof setInterval> | null = null;

function wireTransport(t: TrysteroRoom) {
  // ... existing code ...

  // Auto-reconnect polling (only when setting is enabled)
  if (autoReconnectInterval) clearInterval(autoReconnectInterval);
  if (settings().autoReconnect) {
    autoReconnectInterval = setInterval(() => {
      if (trystero?.hasFailedRelays() && connectionState() === 'connected') {
        // Only auto-reconnect if we're in a connected state (don't interfere with initial connect or failed state)
        reconnect();
      }
    }, 15_000);  // Check every 15 seconds
  }
}
```

Update `teardownTransport()` to clear this interval.

Expose `retryFailedConnections` in the return object — this is just `reconnect()` with current settings, for the manual button:
```typescript
retryFailedConnections: () => reconnect(),
```

### 4. `src/components/ConnectionSettingsPanel.tsx`

Add a toggle for Auto-Reconnect in the settings panel, placed after the TURN section and before the action buttons:

```tsx
{/* Auto-Reconnect */}
<div class="px-3 py-2.5 border-b border-surface-700/50">
  <div class="flex items-center justify-between">
    <div>
      <span class="text-xs font-medium text-surface-300">Auto-Reconnect</span>
      <p class="text-[10px] text-surface-500 mt-0.5">
        Automatically retry failed relay connections
      </p>
    </div>
    <button
      onClick={() => setAutoReconnect(!autoReconnect())}
      class={`w-9 h-5 rounded-full transition-colors cursor-pointer ${autoReconnect() ? 'bg-primary-600' : 'bg-surface-600'}`}
    >
      <span class={`block w-3.5 h-3.5 rounded-full bg-white transition-transform mx-0.5 ${autoReconnect() ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  </div>
</div>
```

Add the `autoReconnect` signal:
```typescript
const [autoReconnect, setAutoReconnect] = createSignal(props.settings.autoReconnect);
```

Include it in `handleApply`:
```typescript
const s: ConnectionSettings = {
  // ...existing fields...
  autoReconnect: autoReconnect(),
};
```

Include it in `handleReset`:
```typescript
setAutoReconnect(d.autoReconnect);
```

### 5. `src/components/ConnectionStatus.tsx`

Add props for auto-reconnect state and retry callback:

```typescript
interface ConnectionStatusProps {
  status: ConnectionStatus;
  isConnected: boolean;
  autoReconnect: boolean;       // NEW
  onRetry?: () => void;         // NEW
  onClose: () => void;
}
```

Add a "Retry Connections" button at the bottom of the panel, shown when:
- Auto-reconnect is **off**
- At least one relay is in `closed` state

```tsx
{/* Manual retry button */}
<Show when={!props.autoReconnect && hasClosedRelays()}>
  <div class="px-3 py-2 border-t border-surface-700/50">
    <button
      onClick={() => props.onRetry?.()}
      class="w-full text-[11px] font-medium text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15 rounded-lg py-2 cursor-pointer transition-colors"
    >
      Retry Connections
    </button>
  </div>
</Show>
```

Where `hasClosedRelays` is:
```typescript
const hasClosedRelays = () => props.status.relays.some(r => r.state === 'closed');
```

### 6. `src/components/RoomView.tsx`

Pass the new props to `ConnectionStatusPanel`:

```tsx
<ConnectionStatusPanel
  status={room.connectionStatus()}
  isConnected={room.isConnected()}
  autoReconnect={room.connectionSettings().autoReconnect}
  onRetry={() => room.retryFailedConnections()}
  onClose={() => setShowConnectionStatus(false)}
/>
```

---

## Behavior Summary

| Auto-Reconnect | Relay Fails | Behavior |
|----------------|-------------|----------|
| **ON** (default) | Any relay closes | App detects every ~15s and triggers `reconnect()` automatically. Yjs doc preserved. |
| **OFF** | Any relay closes | Relay stays closed. Status panel shows "Retry Connections" button. User clicks to manually trigger `reconnect()`. |

Both paths preserve the Yjs document, chat history, and all room state across the reconnect.

---

## Auto-Reconnect Interval

15 seconds — checks for failed relays every 15s. This is a new behavior (currently there is no auto-reconnect at all). Low overhead, reasonable recovery time, avoids hammering servers that may be temporarily down.

---

## Verification

1. **Build check**: `npm run build` — ensure no TypeScript errors
2. **Unit tests**: `npm test` — ensure existing tests pass
3. **Manual testing**:
   - Open settings, verify Auto-Reconnect toggle appears with description
   - Toggle OFF, verify the setting persists after page reload
   - With auto-reconnect OFF: open the connection status panel, verify "Retry Connections" button appears when relays are closed
   - Click "Retry Connections", verify connections are rebuilt
   - With auto-reconnect ON: verify connections auto-recover without user intervention (may need to simulate relay failure by temporarily disabling network)
4. **Backward compatibility**: Existing localStorage settings without `autoReconnect` field should default to `true`
