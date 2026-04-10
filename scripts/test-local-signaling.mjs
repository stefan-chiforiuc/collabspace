/**
 * End-to-end signaling test using a LOCAL MQTT broker.
 *
 * Spins up an in-process MQTT broker (aedes), then simulates two "peers"
 * connecting to it and exchanging announcements via the exact same topic
 * structure Trystero uses.
 *
 * This proves whether the signaling flow works when brokers are functional.
 */

import { Aedes } from 'aedes';
import { createServer } from 'net';
import { WebSocketServer, createWebSocketStream } from 'ws';
import { createServer as createHttpServer } from 'http';
import mqtt from 'mqtt';
import crypto from 'crypto';

const APP_ID = 'collabspace-v2';
const ROOM_CODE = 'calm-river-7291';  // Example room code

function topicPath(...parts) { return parts.join('@'); }

async function sha1(str) {
  const hash = crypto.createHash('sha1').update(str).digest();
  return Array.from(hash).map(b => b.toString(36)).join('');
}

function genId(n) {
  const charSet = '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';
  return Array(n).fill(0).map(() => charSet[Math.floor(Math.random() * 62)]).join('');
}

async function main() {
  console.log('='.repeat(70));
  console.log('Local MQTT Signaling Test');
  console.log('='.repeat(70));

  // ── Step 1: Start local MQTT broker with WebSocket support ─────────────
  const aedes = await Aedes.createBroker({});
  const httpServer = createHttpServer();
  const wsServer = new WebSocketServer({ server: httpServer });

  // Wire WebSocket connections to aedes
  wsServer.on('connection', (ws, req) => {
    const duplex = createWebSocketStream(ws);
    aedes.handle(duplex);
  });

  await new Promise((resolve) => httpServer.listen(19883, resolve));
  console.log('✓ Local MQTT broker started on ws://localhost:19883');

  // Track broker events for debugging
  let publishCount = 0;
  let subscribeCount = 0;
  aedes.on('publish', (packet) => {
    // Skip internal $SYS topics
    if (packet.topic.startsWith('$')) return;
    publishCount++;
    console.log(`  [broker] publish topic="${packet.topic.slice(0,30)}..." payload=${packet.payload.toString().slice(0,60)}`);
  });
  aedes.on('subscribe', (subscriptions) => {
    subscribeCount++;
    for (const sub of subscriptions) {
      console.log(`  [broker] subscribe topic="${sub.topic.slice(0,30)}..."`);
    }
  });

  // ── Step 2: Compute the topic (same as Trystero) ──────────────────────
  const rootTopicPlaintext = topicPath('Trystero', APP_ID, ROOM_CODE);
  const rootTopic = await sha1(rootTopicPlaintext);
  console.log(`\nRoom: ${ROOM_CODE}`);
  console.log(`Topic plaintext: ${rootTopicPlaintext}`);
  console.log(`Topic SHA1: ${rootTopic}`);

  const peerA_id = genId(20);
  const peerB_id = genId(20);
  console.log(`Peer A selfId: ${peerA_id}`);
  console.log(`Peer B selfId: ${peerB_id}\n`);

  const selfTopicA = await sha1(topicPath(rootTopicPlaintext, peerA_id));
  const selfTopicB = await sha1(topicPath(rootTopicPlaintext, peerB_id));

  // ── Step 3: Simulate two peers ────────────────────────────────────────
  const results = {
    peerA_connected: false,
    peerB_connected: false,
    peerA_subscribed: false,
    peerB_subscribed: false,
    peerA_received_B_announcement: false,
    peerB_received_A_announcement: false,
    peerA_received_offer: false,
    peerB_sent_offer: false,
  };

  const BROKER_URL = 'ws://localhost:19883/mqtt';

  // ── Peer A (room creator) ──
  console.log('─── Peer A (creator) connecting... ───');
  const clientA = mqtt.connect(BROKER_URL, {
    clientId: 'peerA-' + genId(8),
    reconnectPeriod: 0,
  });

  await new Promise((resolve, reject) => {
    clientA.on('connect', () => {
      results.peerA_connected = true;
      console.log('  ✓ Peer A connected to broker');
      resolve();
    });
    clientA.on('error', reject);
    setTimeout(() => reject(new Error('Peer A connect timeout')), 5000);
  });

  // Subscribe to root topic + self topic
  await new Promise((resolve, reject) => {
    clientA.subscribe([rootTopic, selfTopicA], (err) => {
      if (err) return reject(err);
      results.peerA_subscribed = true;
      console.log('  ✓ Peer A subscribed to root topic and self topic');
      resolve();
    });
  });

  // Announce on root topic (same as Trystero)
  clientA.publish(rootTopic, JSON.stringify({ peerId: peerA_id }));
  console.log('  ✓ Peer A announced on root topic');

  // ── Peer B (joiner) ──
  console.log('\n─── Peer B (joiner) connecting... ───');
  const clientB = mqtt.connect(BROKER_URL, {
    clientId: 'peerB-' + genId(8),
    reconnectPeriod: 0,
  });

  await new Promise((resolve, reject) => {
    clientB.on('connect', () => {
      results.peerB_connected = true;
      console.log('  ✓ Peer B connected to broker');
      resolve();
    });
    clientB.on('error', reject);
    setTimeout(() => reject(new Error('Peer B connect timeout')), 5000);
  });

  // Subscribe to root topic + self topic
  await new Promise((resolve, reject) => {
    clientB.subscribe([rootTopic, selfTopicB], (err) => {
      if (err) return reject(err);
      results.peerB_subscribed = true;
      console.log('  ✓ Peer B subscribed to root topic and self topic');
      resolve();
    });
  });

  // Set up message handlers
  const messagePromise = new Promise((resolve) => {
    let resolved = false;
    const checkDone = () => {
      if (results.peerA_received_B_announcement && results.peerB_received_A_announcement && !resolved) {
        resolved = true;
        resolve();
      }
    };

    clientA.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.peerId === peerB_id && topic === rootTopic) {
          results.peerA_received_B_announcement = true;
          console.log('  ✓ Peer A received Peer B announcement on root topic');

          // Simulate: A sends an offer to B's self topic
          // In real Trystero, this is an encrypted WebRTC offer
          const mockOffer = JSON.stringify({ peerId: peerA_id, offer: 'mock-sdp-offer' });
          clientA.publish(selfTopicB, mockOffer);
          results.peerB_sent_offer = true;
          console.log('  ✓ Peer A sent offer to Peer B\'s self topic');
        }
        checkDone();
      } catch {}
    });

    clientB.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.peerId === peerA_id && topic === rootTopic) {
          results.peerB_received_A_announcement = true;
          console.log('  ✓ Peer B received Peer A announcement on root topic');
        }
        if (data.offer && topic === selfTopicB) {
          results.peerA_received_offer = true;
          console.log('  ✓ Peer B received offer from Peer A on self topic');
        }
        checkDone();
      } catch {}
    });

    setTimeout(() => {
      if (!resolved) { resolved = true; resolve(); }
    }, 10000);
  });

  // Peer B announces
  clientB.publish(rootTopic, JSON.stringify({ peerId: peerB_id }));
  console.log('  ✓ Peer B announced on root topic');

  // Peer A re-announces (simulating Trystero's periodic re-announce)
  setTimeout(() => {
    clientA.publish(rootTopic, JSON.stringify({ peerId: peerA_id }));
    console.log('  ✓ Peer A re-announced (periodic)');
  }, 1000);

  // Wait for messages
  console.log('\n─── Waiting for message exchange... ───');
  await messagePromise;

  // Give a moment for the offer to arrive
  await new Promise(r => setTimeout(r, 2000));

  // ── Results ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log(`  Broker publishes:  ${publishCount}`);
  console.log(`  Broker subscribes: ${subscribeCount}`);
  console.log('');
  console.log(`  Peer A connected:                 ${results.peerA_connected ? '✓' : '✗'}`);
  console.log(`  Peer B connected:                 ${results.peerB_connected ? '✓' : '✗'}`);
  console.log(`  Peer A subscribed:                ${results.peerA_subscribed ? '✓' : '✗'}`);
  console.log(`  Peer B subscribed:                ${results.peerB_subscribed ? '✓' : '✗'}`);
  console.log(`  Peer A received B's announcement: ${results.peerA_received_B_announcement ? '✓' : '✗'}`);
  console.log(`  Peer B received A's announcement: ${results.peerB_received_A_announcement ? '✓' : '✗'}`);
  console.log(`  Peer B received offer from A:     ${results.peerA_received_offer ? '✓' : '✗'}`);

  const allPassed = Object.values(results).every(v => v === true);

  console.log('');
  if (allPassed) {
    console.log('  ✓ ALL TESTS PASSED');
    console.log('');
    console.log('  The signaling flow works correctly when MQTT brokers are functional.');
    console.log('  The multi-device issue is caused by:');
    console.log('    1. Public MQTT brokers being down/unreliable, OR');
    console.log('    2. WebRTC STUN/TURN connection failing on mobile networks');
    console.log('');
    console.log('  Recommendation: test relay connectivity on the actual phones');
    console.log('  using the built-in "Test Relays" button in Connection Status.');
  } else {
    console.log('  ✗ SOME TESTS FAILED');
    console.log('  There may be a signaling logic issue.');
  }
  console.log('='.repeat(70));

  // Cleanup
  clientA.end(true);
  clientB.end(true);
  aedes.close();
  httpServer.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
