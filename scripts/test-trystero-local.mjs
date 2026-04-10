/**
 * Full Trystero integration test against a local MQTT broker.
 *
 * This uses the ACTUAL @trystero-p2p/mqtt joinRoom function against a local
 * broker to verify the complete signaling + peer discovery pipeline.
 *
 * Note: WebRTC won't fully connect in Node.js (no RTCPeerConnection),
 * but we CAN verify that Trystero's announcement/subscription flow works.
 */

import { Aedes } from 'aedes';
import { WebSocketServer, createWebSocketStream } from 'ws';
import { createServer as createHttpServer } from 'http';

// Polyfill minimal globals that Trystero expects
if (typeof globalThis.WebSocket === 'undefined') {
  const { default: WS } = await import('ws');
  globalThis.WebSocket = WS;
}
if (typeof globalThis.RTCPeerConnection === 'undefined') {
  // Minimal stub — enough for joinRoom to not crash, but WebRTC won't actually work
  globalThis.RTCPeerConnection = class RTCPeerConnection {
    constructor() {
      this.localDescription = null;
      this.remoteDescription = null;
      this.connectionState = 'new';
      this.iceGatheringState = 'new';
      this.signalingState = 'stable';
    }
    createDataChannel() { return { binaryType: 'arraybuffer', bufferedAmountLowThreshold: 0, onmessage: null, onopen: null, onclose: null, onerror: null, close() {} }; }
    addEventListener() {}
    removeEventListener() {}
    setLocalDescription() { return Promise.resolve(); }
    setRemoteDescription() { return Promise.resolve(); }
    createOffer() { return Promise.resolve({ type: 'offer', sdp: '' }); }
    createAnswer() { return Promise.resolve({ type: 'answer', sdp: '' }); }
    addIceCandidate() { return Promise.resolve(); }
    addTrack() {}
    removeTrack() {}
    getSenders() { return []; }
    getReceivers() { return []; }
    close() { this.connectionState = 'closed'; }
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
if (typeof globalThis.addEventListener === 'undefined') {
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
}
if (typeof globalThis.crypto?.subtle === 'undefined') {
  const nodeCrypto = await import('crypto');
  globalThis.crypto = nodeCrypto.webcrypto;
}
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
  globalThis.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

// NOW we can import Trystero (after polyfills are in place)
const { joinRoom, selfId, getRelaySockets } = await import('@trystero-p2p/mqtt');

async function main() {
  console.log('='.repeat(70));
  console.log('Trystero Full Integration Test (Local MQTT Broker)');
  console.log('='.repeat(70));
  console.log(`selfId: ${selfId}`);

  // ── Start local MQTT broker ────────────────────────────────────────────
  const aedes = await Aedes.createBroker({});
  const httpServer = createHttpServer();
  const wsServer = new WebSocketServer({ server: httpServer });

  let brokerMsgCount = 0;
  aedes.on('publish', (packet) => {
    if (packet.topic.startsWith('$')) return;
    brokerMsgCount++;
    console.log(`  [broker] msg #${brokerMsgCount} topic=${packet.topic.slice(0, 25)}... len=${packet.payload.length}`);
  });

  wsServer.on('connection', (ws) => {
    const duplex = createWebSocketStream(ws);
    aedes.handle(duplex);
  });

  await new Promise((resolve) => httpServer.listen(19884, resolve));
  console.log('✓ Local MQTT broker started on ws://localhost:19884\n');

  const LOCAL_BROKER = 'ws://localhost:19884/mqtt';
  const ROOM = 'test-room-42';
  const APP_ID = 'collabspace-v2';

  // ── Join room as Peer A ────────────────────────────────────────────────
  console.log('─── Joining room as Peer A via Trystero joinRoom... ───');
  let peerA_sawJoin = false;
  let peerA_sawLeave = false;

  const roomA = joinRoom(
    { appId: APP_ID, relayUrls: [LOCAL_BROKER] },
    ROOM,
  );

  roomA.onPeerJoin((peerId) => {
    peerA_sawJoin = true;
    console.log(`  ★ Peer A saw PEER JOIN: ${peerId}`);
  });
  roomA.onPeerLeave((peerId) => {
    peerA_sawLeave = true;
    console.log(`  ★ Peer A saw PEER LEAVE: ${peerId}`);
  });

  console.log('  ✓ Peer A joined room');

  // Wait for relay connections to establish
  await new Promise(r => setTimeout(r, 3000));

  // Check relay socket status
  const socketsA = getRelaySockets();
  console.log(`  Relay sockets: ${Object.keys(socketsA).length}`);
  for (const [url, ws] of Object.entries(socketsA)) {
    console.log(`    ${url}: readyState=${ws.readyState} (1=OPEN)`);
  }

  // Wait for announcements to be sent
  console.log('\n  Waiting 8s for Trystero announce cycles...');
  await new Promise(r => setTimeout(r, 8000));

  console.log(`\n  Broker received ${brokerMsgCount} messages`);
  console.log(`  Peer A saw join: ${peerA_sawJoin}`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));

  const relayConnected = Object.values(socketsA).some(ws => ws.readyState === 1);
  console.log(`  Trystero connected to local broker: ${relayConnected ? '✓' : '✗'}`);
  console.log(`  Broker received messages: ${brokerMsgCount > 0 ? '✓' : '✗'} (${brokerMsgCount} total)`);
  console.log(`  selfId exported correctly: ${selfId ? '✓' : '✗'} (${selfId?.slice(0, 12)}...)`);
  console.log('');

  if (relayConnected && brokerMsgCount > 0) {
    console.log('  ✓ Trystero MQTT signaling works against a local broker.');
    console.log('  The issue is PUBLIC broker availability or WebRTC (STUN/TURN).');
  } else if (!relayConnected) {
    console.log('  ✗ Trystero could not connect to the local broker.');
    console.log('  There may be a library configuration issue.');
  } else {
    console.log('  ? Connected but no messages sent — possible timing issue.');
  }

  console.log('='.repeat(70));

  // Cleanup
  roomA.leave();
  aedes.close();
  httpServer.close();
  setTimeout(() => process.exit(0), 500);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
