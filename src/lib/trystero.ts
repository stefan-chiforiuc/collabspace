import { joinRoom as mqttJoin } from '@trystero-p2p/mqtt';
import { joinRoom as torrentJoin } from '@trystero-p2p/torrent';
import type { Room } from 'trystero';
import { APP_ID, DISCONNECT_GRACE_MS, MAX_PARTICIPANTS } from './constants';

export interface TrysteroRoom {
  room: Room;
  sendSync: (data: Uint8Array, targetPeers?: string[]) => void;
  getSync: (cb: (data: Uint8Array, peerId: string) => void) => void;
  sendAwareness: (data: Uint8Array, targetPeers?: string[]) => void;
  getAwareness: (cb: (data: Uint8Array, peerId: string) => void) => void;
  onPeerJoin: (cb: (peerId: string) => void) => void;
  onPeerLeave: (cb: (peerId: string) => void) => void;
  getPeers: () => string[];
  leave: () => void;
}

// Signaling strategy: MQTT brokers (enterprise-grade, highly reliable)
// Fallback: BitTorrent trackers via WebTorrent
//
// MQTT brokers (HiveMQ, Mosquitto, EMQX) have near-100% uptime.
// If MQTT fails for any reason, torrent trackers provide a second path.

const MQTT_BROKERS = [
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

export function createTrysteroRoom(roomCode: string): TrysteroRoom {
  // Use both MQTT and torrent rooms simultaneously for maximum reliability.
  // Peers discover each other through whichever strategy connects first.
  const mqttRoom = mqttJoin(
    { appId: APP_ID, relayUrls: MQTT_BROKERS, relayRedundancy: 4 },
    roomCode
  );

  const torrentRoom = torrentJoin(
    { appId: APP_ID, relayUrls: TORRENT_TRACKERS, relayRedundancy: 3 },
    roomCode
  );

  // Merge actions from both rooms — messages go out on both, received from either
  const [mqttSendSync, mqttGetSync] = mqttRoom.makeAction<Uint8Array>('yjs-sync');
  const [mqttSendAwareness, mqttGetAwareness] = mqttRoom.makeAction<Uint8Array>('yjs-awareness');
  const [torrentSendSync, torrentGetSync] = torrentRoom.makeAction<Uint8Array>('yjs-sync');
  const [torrentSendAwareness, torrentGetAwareness] = torrentRoom.makeAction<Uint8Array>('yjs-awareness');

  const peers = new Set<string>();
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const joinCallbacks: ((peerId: string) => void)[] = [];
  const leaveCallbacks: ((peerId: string) => void)[] = [];

  const handlePeerJoin = (peerId: string) => {
    const timer = disconnectTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(peerId);
    }

    if (peers.size >= MAX_PARTICIPANTS && !peers.has(peerId)) {
      return;
    }

    // Only fire callbacks for genuinely new peers
    if (!peers.has(peerId)) {
      peers.add(peerId);
      joinCallbacks.forEach((cb) => cb(peerId));
    }
  };

  const handlePeerLeave = (peerId: string) => {
    if (!peers.has(peerId)) return;
    const timer = setTimeout(() => {
      peers.delete(peerId);
      disconnectTimers.delete(peerId);
      leaveCallbacks.forEach((cb) => cb(peerId));
    }, DISCONNECT_GRACE_MS);
    disconnectTimers.set(peerId, timer);
  };

  mqttRoom.onPeerJoin(handlePeerJoin);
  mqttRoom.onPeerLeave(handlePeerLeave);
  torrentRoom.onPeerJoin(handlePeerJoin);
  torrentRoom.onPeerLeave(handlePeerLeave);

  return {
    room: mqttRoom, // Primary room reference
    sendSync: (data, targets) => {
      mqttSendSync(data, targets);
      torrentSendSync(data, targets);
    },
    getSync: (cb) => {
      mqttGetSync(cb);
      torrentGetSync(cb);
    },
    sendAwareness: (data, targets) => {
      mqttSendAwareness(data, targets);
      torrentSendAwareness(data, targets);
    },
    getAwareness: (cb) => {
      mqttGetAwareness(cb);
      torrentGetAwareness(cb);
    },
    onPeerJoin: (cb) => joinCallbacks.push(cb),
    onPeerLeave: (cb) => leaveCallbacks.push(cb),
    getPeers: () => [...peers],
    leave: () => {
      disconnectTimers.forEach((t) => clearTimeout(t));
      disconnectTimers.clear();
      mqttRoom.leave();
      torrentRoom.leave();
    },
  };
}
