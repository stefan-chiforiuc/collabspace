/**
 * MQTT Data Relay — fallback transport when WebRTC fails.
 *
 * Creates an independent MQTT connection to relay Yjs sync and awareness
 * messages through the broker. This works even when TURN is unreachable
 * and WebRTC can't establish a direct peer connection.
 *
 * Uses a dedicated topic namespace to avoid collision with Trystero signaling.
 */
import mqtt from 'mqtt';

const RELAY_PREFIX = 'collabspace-relay/v1';

export type RelayState = 'inactive' | 'connecting' | 'active' | 'failed';

export type RelayTransport = {
  state: () => RelayState;
  sendSync: (data: Uint8Array) => void;
  sendAwareness: (data: Uint8Array) => void;
  onSync: (cb: (data: Uint8Array, senderId: string) => void) => void;
  onAwareness: (cb: (data: Uint8Array, senderId: string) => void) => void;
  destroy: () => void;
};

/**
 * Create a relay transport that sends/receives Yjs messages via MQTT.
 *
 * @param roomCode — the room code (used in the MQTT topic)
 * @param peerId — this peer's unique ID (to avoid echo)
 * @param brokerUrls — list of MQTT broker WSS URLs to try
 */
export function createMqttRelay(
  roomCode: string,
  peerId: string,
  brokerUrls: string[],
): RelayTransport {
  let state: RelayState = 'connecting';
  let client: mqtt.MqttClient | null = null;
  let syncCb: ((data: Uint8Array, senderId: string) => void) | null = null;
  let awarenessCb: ((data: Uint8Array, senderId: string) => void) | null = null;

  const syncTopic = `${RELAY_PREFIX}/${roomCode}/sync`;
  const awarenessTopic = `${RELAY_PREFIX}/${roomCode}/awareness`;

  console.log(`[CollabSpace:relay] Creating MQTT relay for room="${roomCode}" peerId="${peerId.slice(0, 8)}..."`);
  console.log(`[CollabSpace:relay] Trying ${brokerUrls.length} broker(s): ${brokerUrls.join(', ')}`);

  // Try connecting to brokers in order until one works
  const tryConnect = (urlIndex: number) => {
    if (urlIndex >= brokerUrls.length) {
      console.log('[CollabSpace:relay] All brokers failed');
      state = 'failed';
      return;
    }

    const url = brokerUrls[urlIndex];
    console.log(`[CollabSpace:relay] Connecting to ${url}...`);

    const c = mqtt.connect(url, {
      clientId: `cs-relay-${peerId.slice(0, 8)}-${Date.now().toString(36)}`,
      connectTimeout: 10_000,
      reconnectPeriod: 5_000,
      clean: true,
    });

    c.on('connect', () => {
      console.log(`[CollabSpace:relay] Connected to ${url}`);
      client = c;
      state = 'active';

      // Subscribe to both topics
      c.subscribe([syncTopic, awarenessTopic], (err) => {
        if (err) {
          console.error('[CollabSpace:relay] Subscribe failed:', err);
          state = 'failed';
        } else {
          console.log(`[CollabSpace:relay] Subscribed to relay topics`);
        }
      });
    });

    c.on('message', (topic, payload) => {
      try {
        // Messages are JSON-encoded: { from: peerId, data: base64 }
        const msg = JSON.parse(payload.toString()) as { from: string; data: string };
        // Ignore our own messages
        if (msg.from === peerId) return;

        const decoded = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));

        if (topic === syncTopic && syncCb) {
          syncCb(decoded, msg.from);
        } else if (topic === awarenessTopic && awarenessCb) {
          awarenessCb(decoded, msg.from);
        }
      } catch {
        // Ignore malformed messages
      }
    });

    c.on('error', (err) => {
      console.log(`[CollabSpace:relay] Error on ${url}: ${err.message}`);
      // If not yet connected, try next broker
      if (state === 'connecting') {
        c.end(true);
        tryConnect(urlIndex + 1);
      }
    });

    // Timeout for this broker — try next if slow
    setTimeout(() => {
      if (state === 'connecting' && !client) {
        console.log(`[CollabSpace:relay] Timeout on ${url}, trying next...`);
        c.end(true);
        tryConnect(urlIndex + 1);
      }
    }, 8_000);
  };

  tryConnect(0);

  const publish = (topic: string, data: Uint8Array) => {
    if (!client || state !== 'active') return;
    const payload = JSON.stringify({
      from: peerId,
      data: btoa(String.fromCharCode(...data)),
    });
    client.publish(topic, payload);
  };

  return {
    state: () => state,
    sendSync: (data) => publish(syncTopic, data),
    sendAwareness: (data) => publish(awarenessTopic, data),
    onSync: (cb) => { syncCb = cb; },
    onAwareness: (cb) => { awarenessCb = cb; },
    destroy: () => {
      console.log('[CollabSpace:relay] Destroying MQTT relay');
      state = 'inactive';
      syncCb = null;
      awarenessCb = null;
      if (client) {
        try {
          client.unsubscribe([syncTopic, awarenessTopic]);
          client.end(true);
        } catch { /* ignore */ }
        client = null;
      }
    },
  };
}
