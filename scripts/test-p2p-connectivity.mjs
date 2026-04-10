/**
 * Simulate two peers joining the same Trystero room via MQTT.
 * Tests whether the MQTT brokers actually relay signaling messages.
 *
 * This tests the EXACT same flow as the browser:
 *   1. Connect to MQTT brokers via WebSocket
 *   2. Subscribe to sha1("Trystero@collabspace-v2@<roomCode>") topic
 *   3. Publish { peerId: "..." } announcement
 *   4. Check if the other peer receives it
 */

import mqtt from 'mqtt';
import crypto from 'crypto';

const APP_ID = 'collabspace-v2';
const ROOM_CODE = 'test-debug-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
const LIB_NAME = 'Trystero';

// Same topic path construction as Trystero core
function topicPath(...parts) {
  return parts.join('@');
}

// Same SHA-1 hash as Trystero (but using base36 encoding like Trystero does)
async function sha1(str) {
  const hash = crypto.createHash('sha1').update(str).digest();
  return Array.from(hash).map(b => b.toString(36)).join('');
}

// Same selfId generation as Trystero
function genId(n) {
  const charSet = '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';
  return Array(n).fill(0).map(() => charSet[Math.floor(Math.random() * 62)]).join('');
}

const MQTT_SERVERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
  'wss://public:public@public.cloud.shiftr.io',
  'wss://broker-cn.emqx.io:8084/mqtt',
];

const TORRENT_TRACKERS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce',
];

// ─── Test 1: WebSocket connectivity ──────────────────────────────────────────

async function testWebSocketConnectivity(url, timeoutMs = 8000) {
  // Use dynamic import for ws if needed, or rely on mqtt's internal ws
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const client = mqtt.connect(url, {
        connectTimeout: timeoutMs,
        reconnectPeriod: 0, // don't auto-reconnect
      });

      const timer = setTimeout(() => {
        client.end(true);
        resolve({ url, ok: false, ms: Date.now() - start, error: 'timeout' });
      }, timeoutMs);

      client.on('connect', () => {
        clearTimeout(timer);
        const ms = Date.now() - start;
        client.end(true);
        resolve({ url, ok: true, ms, error: null });
      });

      client.on('error', (err) => {
        clearTimeout(timer);
        client.end(true);
        resolve({ url, ok: false, ms: Date.now() - start, error: err.message });
      });
    } catch (err) {
      resolve({ url, ok: false, ms: 0, error: String(err) });
    }
  });
}

// ─── Test 2: MQTT pub/sub round-trip ─────────────────────────────────────────

async function testMqttPubSub(brokerUrl, topic, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const peerA_id = genId(20);
    const peerB_id = genId(20);
    const results = { peerA_received: false, peerB_received: false };
    let settled = false;

    const finish = (success, detail) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { clientA.end(true); } catch {}
      try { clientB.end(true); } catch {}
      resolve({ brokerUrl, topic, success, detail, ...results });
    };

    const timer = setTimeout(() => {
      finish(false, `timeout after ${timeoutMs}ms — peerA_received=${results.peerA_received} peerB_received=${results.peerB_received}`);
    }, timeoutMs);

    // Peer A connects
    const clientA = mqtt.connect(brokerUrl, {
      connectTimeout: 5000,
      reconnectPeriod: 0,
      clientId: 'test-peerA-' + genId(8),
    });

    // Peer B connects
    const clientB = mqtt.connect(brokerUrl, {
      connectTimeout: 5000,
      reconnectPeriod: 0,
      clientId: 'test-peerB-' + genId(8),
    });

    let aConnected = false;
    let bConnected = false;

    const onBothConnected = () => {
      if (!aConnected || !bConnected) return;

      // Both subscribe to the topic
      clientA.subscribe(topic, (err) => {
        if (err) return finish(false, `peerA subscribe error: ${err.message}`);
      });
      clientB.subscribe(topic, (err) => {
        if (err) return finish(false, `peerB subscribe error: ${err.message}`);
      });

      // Wait a moment for subscriptions to propagate, then announce
      setTimeout(() => {
        // Peer A announces
        clientA.publish(topic, JSON.stringify({ peerId: peerA_id }));
        // Peer B announces after a small delay
        setTimeout(() => {
          clientB.publish(topic, JSON.stringify({ peerId: peerB_id }));
        }, 500);
      }, 1000);
    };

    clientA.on('connect', () => {
      aConnected = true;
      onBothConnected();
    });
    clientB.on('connect', () => {
      bConnected = true;
      onBothConnected();
    });

    clientA.on('error', (err) => finish(false, `peerA connect error: ${err.message}`));
    clientB.on('error', (err) => finish(false, `peerB connect error: ${err.message}`));

    // Listen for messages
    clientA.on('message', (_topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.peerId === peerB_id) {
          results.peerA_received = true;
          if (results.peerB_received) finish(true, 'both peers received each other\'s announcements');
        }
      } catch {}
    });

    clientB.on('message', (_topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.peerId === peerA_id) {
          results.peerB_received = true;
          if (results.peerA_received) finish(true, 'both peers received each other\'s announcements');
        }
      } catch {}
    });
  });
}

// ─── Test 3: WebSocket connectivity to torrent trackers ──────────────────────

async function testTorrentTracker(url, timeoutMs = 8000) {
  // Torrent trackers use raw WebSocket, not MQTT
  // We need the ws package for Node.js
  const { default: WebSocket } = await import('ws');

  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const ws = new WebSocket(url);

      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        resolve({ url, ok: false, ms: Date.now() - start, error: 'timeout' });
      }, timeoutMs);

      ws.on('open', () => {
        clearTimeout(timer);
        const ms = Date.now() - start;
        try { ws.close(); } catch {}
        resolve({ url, ok: true, ms, error: null });
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        resolve({ url, ok: false, ms: Date.now() - start, error: err.message });
      });
    } catch (err) {
      resolve({ url, ok: false, ms: 0, error: String(err) });
    }
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('CollabSpace P2P Connection Diagnostic Test');
  console.log('='.repeat(70));
  console.log(`Room code:  ${ROOM_CODE}`);
  console.log(`App ID:     ${APP_ID}`);

  const rootTopicPlaintext = topicPath(LIB_NAME, APP_ID, ROOM_CODE);
  const rootTopic = await sha1(rootTopicPlaintext);
  console.log(`Topic path: ${rootTopicPlaintext}`);
  console.log(`SHA1 topic: ${rootTopic}`);
  console.log('');

  // ── Test 1: MQTT Broker WebSocket Connectivity ────────────────────────────
  console.log('─'.repeat(70));
  console.log('TEST 1: MQTT Broker WebSocket Connectivity');
  console.log('─'.repeat(70));

  const mqttConnResults = await Promise.all(
    MQTT_SERVERS.map(url => testWebSocketConnectivity(url))
  );

  for (const r of mqttConnResults) {
    const status = r.ok ? '✓ OK' : '✗ FAIL';
    const host = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
    console.log(`  ${status.padEnd(8)} ${host.padEnd(35)} ${r.ok ? r.ms + 'ms' : r.error}`);
  }

  const mqttReachable = mqttConnResults.filter(r => r.ok);
  console.log(`\n  Result: ${mqttReachable.length}/${MQTT_SERVERS.length} MQTT brokers reachable`);
  console.log('');

  // ── Test 2: Torrent Tracker WebSocket Connectivity ────────────────────────
  console.log('─'.repeat(70));
  console.log('TEST 2: WebTorrent Tracker Connectivity');
  console.log('─'.repeat(70));

  const torrentResults = await Promise.all(
    TORRENT_TRACKERS.map(url => testTorrentTracker(url))
  );

  for (const r of torrentResults) {
    const status = r.ok ? '✓ OK' : '✗ FAIL';
    const host = (() => { try { return new URL(r.url).hostname; } catch { return r.url; } })();
    console.log(`  ${status.padEnd(8)} ${host.padEnd(35)} ${r.ok ? r.ms + 'ms' : r.error}`);
  }

  const torrentReachable = torrentResults.filter(r => r.ok);
  console.log(`\n  Result: ${torrentReachable.length}/${TORRENT_TRACKERS.length} torrent trackers reachable`);
  console.log('');

  // ── Test 3: MQTT Pub/Sub Round-Trip (the critical test) ───────────────────
  console.log('─'.repeat(70));
  console.log('TEST 3: MQTT Pub/Sub Signaling Round-Trip');
  console.log('        (simulates two peers announcing on the same room topic)');
  console.log('─'.repeat(70));

  if (mqttReachable.length === 0) {
    console.log('  ⚠ SKIPPED: No MQTT brokers reachable');
  } else {
    for (const broker of mqttReachable) {
      const host = (() => { try { return new URL(broker.url).hostname; } catch { return broker.url; } })();
      console.log(`\n  Testing ${host}...`);

      const result = await testMqttPubSub(broker.url, rootTopic, 15000);

      if (result.success) {
        console.log(`  ✓ SUCCESS: ${result.detail}`);
      } else {
        console.log(`  ✗ FAIL: ${result.detail}`);
        console.log(`    peerA received peerB: ${result.peerA_received}`);
        console.log(`    peerB received peerA: ${result.peerB_received}`);
      }
    }
  }

  console.log('');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));

  const anyMqttPubSub = mqttReachable.length > 0;
  const anyTorrent = torrentReachable.length > 0;

  if (mqttReachable.length === 0 && torrentReachable.length === 0) {
    console.log('  ✗ CRITICAL: No relay servers are reachable!');
    console.log('    Peers CANNOT discover each other. All brokers/trackers are down or blocked.');
    console.log('    This is likely the root cause of the multi-device issue.');
  } else if (mqttReachable.length > 0) {
    console.log(`  MQTT:    ${mqttReachable.length}/${MQTT_SERVERS.length} brokers reachable`);
    console.log(`  Torrent: ${torrentReachable.length}/${TORRENT_TRACKERS.length} trackers reachable`);
    console.log('');
    console.log('  If pub/sub tests passed: signaling infrastructure is working.');
    console.log('  The issue may be WebRTC connection (STUN/TURN) failing on mobile.');
    console.log('');
    console.log('  If pub/sub tests failed: brokers connect but don\'t relay messages.');
    console.log('  This means the brokers are partially broken or rate-limiting.');
  }

  console.log('');
  console.log('  Next steps:');
  console.log('  1. Deploy the diagnostic build and check ConnectionStatus on both phones');
  console.log('  2. Tap "Test Relays" on each phone to check connectivity');
  console.log('  3. Look for [peer] PEER JOIN events in the diagnostics log');
  console.log('  4. If relays connect but no peers join → WebRTC/TURN issue');
  console.log('  5. If relays don\'t connect → network/broker issue');
  console.log('='.repeat(70));

  // Force exit since MQTT clients may keep event loop alive
  setTimeout(() => process.exit(0), 1000);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
