import { joinRoom as mqttJoin, getRelaySockets as getMqttSockets } from '@trystero-p2p/mqtt';
import { joinRoom as torrentJoin, getRelaySockets as getTorrentSockets } from '@trystero-p2p/torrent';
import type { Room } from 'trystero';
import { APP_ID, DISCONNECT_GRACE_MS, MAX_PARTICIPANTS } from './constants';
import type { ConnectionSettings } from './connection-settings';
import type { TurnServerConfig } from './turn-config';

export type RelayStatus = {
  url: string;
  strategy: 'mqtt' | 'torrent';
  state: 'connecting' | 'open' | 'closed';
};

export type ConnectionStatus = {
  mqtt: { enabled: boolean; connected: number; total: number };
  torrent: { enabled: boolean; connected: number; total: number };
  turn: { mode: string; url: string } | null;
  relays: RelayStatus[];
  peerCount: number;
};

export interface TrysteroRoom {
  room: Room;
  sendSync: (data: Uint8Array, targetPeers?: string[]) => void;
  getSync: (cb: (data: Uint8Array, peerId: string) => void) => void;
  sendAwareness: (data: Uint8Array, targetPeers?: string[]) => void;
  getAwareness: (cb: (data: Uint8Array, peerId: string) => void) => void;
  onPeerJoin: (cb: (peerId: string) => void) => void;
  onPeerLeave: (cb: (peerId: string) => void) => void;
  getPeers: () => string[];
  getConnectionStatus: () => ConnectionStatus;
  hasFailedRelays: () => boolean;
  addStream: (stream: MediaStream, targetPeers?: string[]) => Promise<void>[];
  removeStream: (stream: MediaStream, targetPeers?: string[]) => void;
  onPeerStream: (cb: (stream: MediaStream, peerId: string, metadata?: unknown) => void) => void;
  leave: () => void;
}

function getSocketState(ws: WebSocket): 'connecting' | 'open' | 'closed' {
  switch (ws.readyState) {
    case WebSocket.CONNECTING: return 'connecting';
    case WebSocket.OPEN: return 'open';
    default: return 'closed';
  }
}

export function createTrysteroRoom(
  roomCode: string,
  settings: ConnectionSettings,
  turnServers: TurnServerConfig[] = [],
): TrysteroRoom {
  const turnConfig = turnServers.length > 0 ? turnServers : undefined;

  // Conditionally create strategy rooms based on settings
  const mqttRoom = settings.mqtt.enabled && settings.mqtt.servers.length > 0
    ? mqttJoin({
        appId: APP_ID,
        relayUrls: settings.mqtt.servers,
        relayRedundancy: Math.min(settings.mqtt.servers.length, 4),
        turnConfig,
      }, roomCode)
    : null;

  const torrentRoom = settings.torrent.enabled && settings.torrent.servers.length > 0
    ? torrentJoin({
        appId: APP_ID,
        relayUrls: settings.torrent.servers,
        relayRedundancy: Math.min(settings.torrent.servers.length, 3),
        turnConfig,
      }, roomCode)
    : null;

  // At least one strategy must be active
  const primaryRoom = mqttRoom || torrentRoom;
  if (!primaryRoom) {
    throw new Error('At least one signaling strategy (MQTT or BitTorrent) must be enabled');
  }

  // Create actions for each active strategy
  type ActionPair = [
    (data: Uint8Array, targets?: string[]) => void,
    (cb: (data: Uint8Array, peerId: string) => void) => void,
  ];

  const syncActions: ActionPair[] = [];
  const awarenessActions: ActionPair[] = [];

  if (mqttRoom) {
    const [s, g] = mqttRoom.makeAction<Uint8Array>('yjs-sync');
    syncActions.push([s, g]);
    const [sa, ga] = mqttRoom.makeAction<Uint8Array>('yjs-awareness');
    awarenessActions.push([sa, ga]);
  }
  if (torrentRoom) {
    const [s, g] = torrentRoom.makeAction<Uint8Array>('yjs-sync');
    syncActions.push([s, g]);
    const [sa, ga] = torrentRoom.makeAction<Uint8Array>('yjs-awareness');
    awarenessActions.push([sa, ga]);
  }

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
    if (peers.size >= MAX_PARTICIPANTS && !peers.has(peerId)) return;
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

  if (mqttRoom) {
    mqttRoom.onPeerJoin(handlePeerJoin);
    mqttRoom.onPeerLeave(handlePeerLeave);
  }
  if (torrentRoom) {
    torrentRoom.onPeerJoin(handlePeerJoin);
    torrentRoom.onPeerLeave(handlePeerLeave);
  }

  // Resolve TURN display info
  const turnInfo = (() => {
    if (settings.turn.mode === 'disabled') return null;
    if (settings.turn.mode === 'custom' && settings.turn.customUrl) {
      return { mode: 'custom', url: settings.turn.customUrl };
    }
    if (settings.turn.mode === 'auto') {
      return { mode: 'open-relay', url: 'global.relay.metered.ca' };
    }
    return null;
  })();

  const getConnectionStatus = (): ConnectionStatus => {
    const relays: RelayStatus[] = [];
    let mqttConnected = 0;
    let torrentConnected = 0;

    if (settings.mqtt.enabled) {
      const sockets = getMqttSockets();
      for (const [url, ws] of Object.entries(sockets)) {
        const state = getSocketState(ws as WebSocket);
        if (state === 'open') mqttConnected++;
        relays.push({ url, strategy: 'mqtt', state });
      }
    }

    if (settings.torrent.enabled) {
      const sockets = getTorrentSockets();
      for (const [url, ws] of Object.entries(sockets)) {
        const state = getSocketState(ws as WebSocket);
        if (state === 'open') torrentConnected++;
        relays.push({ url, strategy: 'torrent', state });
      }
    }

    return {
      mqtt: { enabled: settings.mqtt.enabled, connected: mqttConnected, total: settings.mqtt.servers.length },
      torrent: { enabled: settings.torrent.enabled, connected: torrentConnected, total: settings.torrent.servers.length },
      turn: turnInfo,
      relays,
      peerCount: peers.size,
    };
  };

  return {
    room: primaryRoom,
    sendSync: (data, targets) => {
      syncActions.forEach(([send]) => send(data, targets));
    },
    getSync: (cb) => {
      syncActions.forEach(([, get]) => get(cb));
    },
    sendAwareness: (data, targets) => {
      awarenessActions.forEach(([send]) => send(data, targets));
    },
    getAwareness: (cb) => {
      awarenessActions.forEach(([, get]) => get(cb));
    },
    onPeerJoin: (cb) => joinCallbacks.push(cb),
    onPeerLeave: (cb) => leaveCallbacks.push(cb),
    getPeers: () => [...peers],
    getConnectionStatus,
    hasFailedRelays: () => {
      const status = getConnectionStatus();
      return status.relays.some(r => r.state === 'closed');
    },
    addStream: (stream, targets) => primaryRoom.addStream(stream, targets),
    removeStream: (stream, targets) => primaryRoom.removeStream(stream, targets),
    onPeerStream: (cb) => primaryRoom.onPeerStream(cb),
    leave: () => {
      disconnectTimers.forEach((t) => clearTimeout(t));
      disconnectTimers.clear();
      mqttRoom?.leave();
      torrentRoom?.leave();
    },
  };
}
