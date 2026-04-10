import { joinRoom as mqttJoin, getRelaySockets as getMqttSockets, selfId as mqttSelfId } from '@trystero-p2p/mqtt';
import { joinRoom as torrentJoin, getRelaySockets as getTorrentSockets, selfId as torrentSelfId } from '@trystero-p2p/torrent';
import type { Room } from 'trystero';
import { APP_ID, DISCONNECT_GRACE_MS, MAX_PARTICIPANTS } from './constants';
import type { ConnectionSettings } from './connection-settings';
import type { TurnServerConfig } from './turn-config';
import { getIceSummary, getIceLog } from './webrtc-diagnostics';

// Diagnostic: verify selfId is shared between strategies (same @trystero-p2p/core instance)
export const selfId = mqttSelfId;
const selfIdMatch = mqttSelfId === torrentSelfId;
console.log(`[CollabSpace] selfId=${mqttSelfId} mqtt/torrent match=${selfIdMatch}`);

export type RelayStatus = {
  url: string;
  strategy: 'mqtt' | 'torrent';
  state: 'connecting' | 'open' | 'closed';
};

export type DiagnosticEvent = {
  time: number;
  type: 'relay' | 'peer' | 'info' | 'error' | 'ice';
  message: string;
};

export type IceInfo = {
  peerConnectionsCreated: number;
  hasTurnServers: boolean;
  candidateTypes: string[];  // host, srflx, relay
  iceStates: string[];
  connectionStates: string[];
};

export type ConnectionStatus = {
  mqtt: { enabled: boolean; connected: number; total: number };
  torrent: { enabled: boolean; connected: number; total: number };
  turn: { mode: string; url: string } | null;
  relays: RelayStatus[];
  peerCount: number;
  selfId: string;
  selfIdMatch: boolean;
  roomCode: string;
  appId: string;
  diagnostics: DiagnosticEvent[];
  ice: IceInfo;
  mqttRelay: 'inactive' | 'connecting' | 'active' | 'failed';
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
  setMqttRelayState: (state: 'inactive' | 'connecting' | 'active' | 'failed') => void;
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
  const diagnostics: DiagnosticEvent[] = [];
  const diag = (type: DiagnosticEvent['type'], message: string) => {
    const event = { time: Date.now(), type, message };
    diagnostics.push(event);
    if (diagnostics.length > 100) diagnostics.shift();
    console.log(`[CollabSpace:${type}] ${message}`);
  };

  diag('info', `Creating room: appId=${APP_ID} roomCode=${roomCode}`);
  diag('info', `selfId=${selfId} selfIdMatch=${selfIdMatch}`);
  diag('info', `MQTT enabled=${settings.mqtt.enabled} servers=${settings.mqtt.servers.length}`);
  diag('info', `Torrent enabled=${settings.torrent.enabled} servers=${settings.torrent.servers.length}`);
  const enabledTurnCount = settings.turn.providers.filter(p => p.enabled).length;
  diag('info', `TURN providers=${enabledTurnCount}/${settings.turn.providers.length} enabled, turnServers=${turnServers.length}`);
  if (turnServers.length > 0) {
    diag('info', `TURN urls=${JSON.stringify(turnServers.map(t => typeof t.urls === 'string' ? t.urls : t.urls[0]))}`);
  }

  // Conditionally create strategy rooms based on settings
  let mqttRoom: Room | null = null;
  if (settings.mqtt.enabled && settings.mqtt.servers.length > 0) {
    try {
      diag('relay', `Joining MQTT room "${roomCode}" via ${settings.mqtt.servers.join(', ')}`);
      mqttRoom = mqttJoin({
        appId: APP_ID,
        relayUrls: settings.mqtt.servers,
        relayRedundancy: Math.min(settings.mqtt.servers.length, 4),
        turnConfig,
      }, roomCode);
      diag('relay', 'MQTT joinRoom call succeeded');
    } catch (err) {
      diag('error', `MQTT joinRoom failed: ${err}`);
    }
  }

  let torrentRoom: Room | null = null;
  if (settings.torrent.enabled && settings.torrent.servers.length > 0) {
    try {
      diag('relay', `Joining Torrent room "${roomCode}" via ${settings.torrent.servers.join(', ')}`);
      torrentRoom = torrentJoin({
        appId: APP_ID,
        relayUrls: settings.torrent.servers,
        relayRedundancy: Math.min(settings.torrent.servers.length, 3),
        turnConfig,
      }, roomCode);
      diag('relay', 'Torrent joinRoom call succeeded');
    } catch (err) {
      diag('error', `Torrent joinRoom failed: ${err}`);
    }
  }

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

  const handlePeerJoin = (source: string) => (peerId: string) => {
    diag('peer', `PEER JOIN via ${source}: peerId=${peerId} (already known=${peers.has(peerId)})`);
    const timer = disconnectTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(peerId);
      diag('peer', `Cleared disconnect timer for ${peerId}`);
    }
    if (peers.size >= MAX_PARTICIPANTS && !peers.has(peerId)) {
      diag('peer', `Rejected peer ${peerId}: room full (${peers.size}/${MAX_PARTICIPANTS})`);
      return;
    }
    if (!peers.has(peerId)) {
      peers.add(peerId);
      diag('peer', `New peer added: ${peerId} (total peers: ${peers.size})`);
      joinCallbacks.forEach((cb) => cb(peerId));
    }
  };

  const handlePeerLeave = (source: string) => (peerId: string) => {
    diag('peer', `PEER LEAVE via ${source}: peerId=${peerId} (known=${peers.has(peerId)})`);
    if (!peers.has(peerId)) return;
    const timer = setTimeout(() => {
      peers.delete(peerId);
      disconnectTimers.delete(peerId);
      diag('peer', `Peer removed after grace period: ${peerId} (total peers: ${peers.size})`);
      leaveCallbacks.forEach((cb) => cb(peerId));
    }, DISCONNECT_GRACE_MS);
    disconnectTimers.set(peerId, timer);
  };

  if (mqttRoom) {
    mqttRoom.onPeerJoin(handlePeerJoin('mqtt'));
    mqttRoom.onPeerLeave(handlePeerLeave('mqtt'));
    diag('relay', 'MQTT peer handlers registered');
  }
  if (torrentRoom) {
    torrentRoom.onPeerJoin(handlePeerJoin('torrent'));
    torrentRoom.onPeerLeave(handlePeerLeave('torrent'));
    diag('relay', 'Torrent peer handlers registered');
  }

  // Resolve TURN display info
  const enabledProviders = settings.turn.providers.filter(p => p.enabled);
  const turnInfo = enabledProviders.length > 0
    ? { mode: `${enabledProviders.length} provider(s)`, url: enabledProviders.map(p => p.label).join(', ') }
    : null;

  // Track previous relay states to detect changes
  let prevRelayStates: Record<string, string> = {};
  // MQTT relay state (set externally by useRoom)
  let mqttRelayState: 'inactive' | 'connecting' | 'active' | 'failed' = 'inactive';

  const getConnectionStatus = (): ConnectionStatus => {
    const relays: RelayStatus[] = [];
    let mqttConnected = 0;
    let torrentConnected = 0;

    if (settings.mqtt.enabled) {
      const sockets = getMqttSockets();
      const socketCount = Object.keys(sockets).length;
      if (socketCount === 0 && settings.mqtt.servers.length > 0) {
        diag('relay', `MQTT: getRelaySockets returned 0 sockets (expected ${settings.mqtt.servers.length})`);
      }
      for (const [url, ws] of Object.entries(sockets)) {
        const state = getSocketState(ws as WebSocket);
        if (state === 'open') mqttConnected++;
        relays.push({ url, strategy: 'mqtt', state });
        // Log state changes
        if (prevRelayStates[url] !== state) {
          diag('relay', `MQTT ${url}: ${prevRelayStates[url] || 'new'} → ${state}`);
          prevRelayStates[url] = state;
        }
      }
    }

    if (settings.torrent.enabled) {
      const sockets = getTorrentSockets();
      const socketCount = Object.keys(sockets).length;
      if (socketCount === 0 && settings.torrent.servers.length > 0) {
        diag('relay', `Torrent: getRelaySockets returned 0 sockets (expected ${settings.torrent.servers.length})`);
      }
      for (const [url, ws] of Object.entries(sockets)) {
        const state = getSocketState(ws as WebSocket);
        if (state === 'open') torrentConnected++;
        relays.push({ url, strategy: 'torrent', state });
        if (prevRelayStates[url] !== state) {
          diag('relay', `Torrent ${url}: ${prevRelayStates[url] || 'new'} → ${state}`);
          prevRelayStates[url] = state;
        }
      }
    }

    // Merge ICE diagnostics into the event log
    const iceSummary = getIceSummary();
    const iceEvents = getIceLog();
    const allDiagnostics: DiagnosticEvent[] = [...diagnostics, ...iceEvents]
      .sort((a, b) => a.time - b.time);

    return {
      mqtt: { enabled: settings.mqtt.enabled, connected: mqttConnected, total: settings.mqtt.servers.length },
      torrent: { enabled: settings.torrent.enabled, connected: torrentConnected, total: settings.torrent.servers.length },
      turn: turnInfo,
      relays,
      peerCount: peers.size,
      selfId,
      selfIdMatch,
      roomCode,
      appId: APP_ID,
      diagnostics: allDiagnostics,
      mqttRelay: mqttRelayState,
      ice: {
        peerConnectionsCreated: iceSummary.peerConnectionsCreated,
        hasTurnServers: iceSummary.hasTurnServers,
        candidateTypes: [...iceSummary.candidateTypesLocal],
        iceStates: iceSummary.iceStates,
        connectionStates: iceSummary.connectionStates,
      },
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
    setMqttRelayState: (s) => { mqttRelayState = s; },
    leave: () => {
      disconnectTimers.forEach((t) => clearTimeout(t));
      disconnectTimers.clear();
      mqttRoom?.leave();
      torrentRoom?.leave();
    },
  };
}
