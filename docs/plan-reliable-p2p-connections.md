# Plan: Reliable P2P Connections for Mobile Devices

## Problem
Two phones joining the same room can't connect because:
- Signaling works (MQTT brokers are connected)
- WebRTC fails because TURN relay is unreachable (Metered Open Relay is down/degraded)
- Mobile carriers use symmetric NAT → STUN alone doesn't work → TURN is required

## Solution: Three-phase approach

### Architecture Principle
**Phase 3 is the foundation.** MQTT data relay makes the app work for everyone without any
TURN server. Phases 1 and 2 add TURN for better performance. This inverts the dependency:
instead of "TURN required, MQTT for signaling," it becomes "MQTT for everything, TURN as
an optimization."

---

## Phase 1: MQTT Data Relay Fallback (Zero Infrastructure)

**Goal:** When WebRTC fails (no TURN), relay Yjs sync data through the MQTT brokers that
are already connected. Every user gets a working app without any setup.

### How it works
1. Both phones connect to MQTT brokers (already working)
2. The `TrysteroProvider` (yjs-sync.ts) sends sync messages via Trystero data channels
3. When no WebRTC peer connects within ~15 seconds, activate MQTT relay mode
4. In relay mode, Yjs sync/awareness messages are published to MQTT room topic directly
   using the mqtt client (not WebRTC data channels)
5. Both peers receive each other's Yjs updates through the broker
6. If WebRTC later connects (TURN becomes available), seamlessly upgrade to direct P2P

### What works in relay mode
- Chat (text via Yjs)
- Polls, poker, timer (all Yjs-based)
- Notepad collaboration (Yjs + TipTap)
- Participant awareness (cursors, names)

### What doesn't work in relay mode
- Audio/video (MediaStream requires WebRTC)
- Latency will be higher (~100-300ms vs ~50ms direct)

### Implementation
- **New file:** `src/lib/mqtt-relay.ts` — MQTT pub/sub relay for Yjs messages
- **Modified:** `src/lib/yjs-sync.ts` — TrysteroProvider gains a fallback transport
- **Modified:** `src/hooks/useRoom.ts` — detect WebRTC failure, activate relay mode
- **Modified:** `src/lib/trystero.ts` — expose MQTT client for direct pub/sub
- **UI:** Connection indicator shows "Relay mode" (orange) vs "Direct P2P" (green)

### Estimated scope: ~150 lines new code, ~50 lines modified

---

## Phase 2: Additional Built-in TURN Providers

**Goal:** Add working TURN servers as built-in providers for better performance.

### Providers to add

**ExpressTURN (free tier, static credentials):**
- URLs: `turn:relay1.expressturn.com:3478`, `turns:relay1.expressturn.com:5349`
- Static credentials from their free tier documentation
- No signup needed for basic embedded use
- ~1 TB/month free
- Added as a built-in provider (like Open Relay)

**Metered with API key (optional, user-configured):**
- Same endpoints as Open Relay but with dedicated API key
- User signs up at metered.ca → gets API key → pastes in settings
- More reliable than shared-secret open relay
- 20 GB/month free tier

### TURN credential sharing via Yjs doc
When the room creator has working TURN:
1. Creator generates short-lived TURN credentials
2. Credentials are written to the Yjs doc meta map: `meta.set('turnServers', [...])`
3. Other peers (who may have connected via MQTT relay) receive the credentials
4. They reconnect using the shared TURN credentials → upgrade to direct P2P

This means: **Creator sets up TURN once → all participants benefit automatically.**

### Implementation
- **Modified:** `src/lib/connection-settings.ts` — add ExpressTURN default provider
- **Modified:** `src/lib/turn-config.ts` — handle ExpressTURN static credentials
- **New logic in:** `src/hooks/useRoom.ts` — publish/subscribe TURN credentials via Yjs doc
- **Modified:** `src/lib/yjs-sync.ts` — detect shared TURN credentials → trigger reconnect

### Estimated scope: ~100 lines new code, ~40 lines modified

---

## Phase 3: Cloudflare TURN with Guided Setup + Invite URL Sharing

**Goal:** Best-quality connections via Cloudflare's global anycast TURN network.
1 TB/month free tier.

### Why Cloudflare can't be fully automatic
- No OAuth flow for TURN key creation — user must create the key in Cloudflare Dashboard
- The TURN credential generation API at `rtc.live.cloudflare.com` likely doesn't support
  CORS → can't call directly from the browser
- Solution: user deploys a tiny Cloudflare Worker (free tier) that proxies the API call
- OR: user generates credentials manually and the app caches them

### UX Flow — Room Creator (one-time setup)

#### Option A: Cloudflare Worker (recommended)
1. In Connection Settings, tap "Setup Cloudflare TURN"
2. Guided wizard with 4 steps:
   a. "Create a free Cloudflare account" → link to cloudflare.com/sign-up
   b. "Create a TURN key" → link to Dashboard → Calls → TURN Keys
   c. "Deploy the credential worker" → one-click deploy template for a Worker
      that generates TURN credentials (we provide the Worker code)
   d. "Paste your Worker URL below" → e.g., `https://my-turn.workers.dev`
3. App tests the Worker URL → shows success/failure
4. Saved in localStorage — works for all future rooms

#### Option B: Manual credential paste (simpler, shorter-lived)
1. User goes to Cloudflare Dashboard, generates credentials manually
2. Pastes turn URL + username + credential into "Add custom TURN server"
3. Credentials expire after TTL (24-48h), user must regenerate

### UX Flow — Room Joiner

#### Via invite link (best experience)
1. Creator's app generates short-lived TURN credentials via Worker
2. Credentials are base64-encoded in the invite URL hash fragment:
   `#/room/calm-river-7291?turn=<base64>&pw=<optional>`
3. Joiner clicks link → TURN credentials extracted → used immediately
4. Joiner doesn't need Cloudflare account or any setup

#### Via room code (still works)
1. Joiner types room code manually
2. Connects via MQTT relay (Phase 1)
3. Receives shared TURN credentials from Yjs doc (Phase 2)
4. Reconnects with TURN → upgraded to direct P2P

### Invite URL format
```
https://app.github.io/collabspace/#/room/<code>?creator=1&pw=<pw>&turn=<base64>
```
Where `turn` base64 decodes to:
```json
[{"urls":["turn:turn.cloudflare.com:443?transport=tcp"],"username":"...","credential":"..."}]
```

Fragment-only (never sent to any server). Credentials are short-lived (24h).

### Share panel enhancement
The existing SharePanel shows room code + copy button. Enhance to:
- "Share Link" (full URL with TURN credentials) — primary action
- "Room Code" (for manual entry) — secondary, with note that it may be slower

### Implementation
- **New file:** `src/lib/cloudflare-turn.ts` — Worker URL storage, credential generation
- **Modified:** `src/hooks/useHashRouter.ts` — parse `turn` param from URL
- **Modified:** `src/components/SharePanel.tsx` — generate invite URL with TURN credentials
- **Modified:** `src/hooks/useRoom.ts` — use TURN credentials from URL
- **Modified:** `src/components/ConnectionSettingsPanel.tsx` — Cloudflare setup wizard
- **New file:** `worker/turn-proxy.js` — Cloudflare Worker code (provided for user to deploy)

### Estimated scope: ~200 lines new code, ~80 lines modified

---

## Implementation Order

```
Phase 1 (MQTT relay)    ← makes app WORK for everyone, no setup needed
    ↓
Phase 2 (more TURN)     ← makes it FASTER, credentials shared via Yjs
    ↓
Phase 3 (Cloudflare)    ← makes it BEST, credentials shared via invite URL
```

Each phase is independently useful. Phase 1 alone solves the user's problem.

---

## Key Design Decisions

### Q: Why Phase 1 before Phase 2?
A: MQTT relay is the only solution that requires ZERO setup from ANY user. It makes the
room code flow work without TURN. Without it, room codes are broken for mobile users.

### Q: Won't MQTT relay be too slow?
A: For text collaboration (chat, notepad, polls), latency of 100-300ms is fine. Audio/video
won't work, but that's already broken without TURN. The relay is strictly better than nothing.

### Q: Could MQTT brokers rate-limit relay traffic?
A: Public MQTT brokers allow reasonable message rates. Yjs sync messages are small (typically
<1KB). At ~10 messages/second during active editing, this is well within broker limits.
We should add message batching/throttling to be safe.

### Q: Is putting TURN credentials in the URL secure?
A: Yes — they're short-lived (24h), in the hash fragment (never sent to servers), and only
authorize WebRTC relay traffic. No worse than how every WebRTC app sends credentials to
the browser.

### Q: What if the Cloudflare Worker CORS approach doesn't work?
A: The Worker IS the CORS solution. The Worker runs on Cloudflare's domain, calls the TURN
API server-side, and returns credentials with proper CORS headers. This is the documented
pattern from Cloudflare.

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| MQTT brokers rate-limit relay data | Low | Batch messages, throttle to 10msg/s |
| ExpressTURN changes/removes free tier | Medium | Multiple providers, Cloudflare backup |
| Cloudflare TURN API changes | Low | Cloudflare is stable, versioned API |
| Invite URLs too long for SMS | Medium | QR code option, room code fallback |
| User confused by Cloudflare setup | Medium | Step-by-step wizard with screenshots |
