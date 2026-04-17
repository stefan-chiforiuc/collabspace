import { createSignal, onCleanup } from 'solid-js';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import { createTrysteroRoom, type TrysteroRoom, type ConnectionStatus } from '../lib/trystero';
import { createYDoc } from '../lib/yjs-doc';
import { TrysteroProvider, type AuthState } from '../lib/yjs-sync';
import { setLocalAwareness, getParticipantList, assignColor } from '../lib/participants';
import { sendChatMessage, sendSystemMessage, getChatMessages } from '../lib/chat';
import { deriveRoomKey } from '../lib/room-crypto';
import { getDisplayName } from '../lib/storage';
import { MAX_PARTICIPANTS } from '../lib/constants';
import { getConnectionSettings, saveConnectionSettings, type ConnectionSettings } from '../lib/connection-settings';
import { buildTurnServers, type TurnServerConfig } from '../lib/turn-config';
import { createMqttRelay, type RelayTransport } from '../lib/mqtt-relay';
import { publishTurnCredentials, watchSharedTurnCredentials } from '../lib/turn-sharing';
import { generateCloudflareCredentials } from '../lib/cloudflare-turn';
import type { Participant, ChatMessage } from '../lib/types';

export type RoomConnectionState = 'connecting' | 'connected' | 'relay' | 'failed';

const EMPTY_STATUS: ConnectionStatus = {
  mqtt: { enabled: false, connected: 0, total: 0 },
  torrent: { enabled: false, connected: 0, total: 0 },
  turn: null,
  relays: [],
  peerCount: 0,
  selfId: '',
  selfIdMatch: true,
  roomCode: '',
  appId: '',
  diagnostics: [],
  ice: { peerConnectionsCreated: 0, hasTurnServers: false, candidateTypes: [], iceStates: [], connectionStates: [] },
  mqttRelay: 'inactive',
};

export function useRoom(roomCode: string, password?: string, isCreator: boolean = false, sharedTurn?: TurnServerConfig[]) {
  const [participants, setParticipants] = createSignal<Participant[]>([]);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);
  const [localPeerId, setLocalPeerId] = createSignal('');
  const [connectionState, setConnectionState] = createSignal<RoomConnectionState>('connecting');
  const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>(EMPTY_STATUS);
  const [settings, setSettings] = createSignal<ConnectionSettings>(getConnectionSettings());
  const [authState, setAuthState] = createSignal<AuthState>('pending');
  // Mutable password — starts from the caller-provided value and can be
  // replaced at runtime via setPassword() when the user answers the
  // password gate after an auth-failure.
  let currentPassword: string | undefined = password;

  // Yjs doc persists across reconnects
  const doc = createYDoc({
    roomCode,
    roomName: roomCode,
    createdAt: Date.now(),
    settings: { maxParticipants: MAX_PARTICIPANTS },
  }, isCreator);

  const name = getDisplayName() || 'Anonymous';
  const colorIndex = Math.floor(Math.random() * 6);
  const color = assignColor(colorIndex);

  // Standalone awareness — always available, even before transport connects.
  // The TrysteroProvider will use its own awareness internally, but we expose
  // this one so hooks (useReactions, useNotepad) can bind immediately.
  const awareness = new Awareness(doc);
  setLocalAwareness(awareness, name, color);

  // Cache of last-known name per awareness clientID (as a string). Populated
  // from awareness changes and read when posting "<name> left" chat messages
  // after an awareness state is removed (graceful leave or heartbeat timeout).
  const peerNameCache = new Map<string, string>();

  // Reactive signal for the trystero room (used by useMedia to react to reconnects)
  const [trysteroRef, setTrysteroRef] = createSignal<TrysteroRoom | null>(null);

  // Mutable refs for current trystero + provider (swapped on reconnect)
  let trystero: TrysteroRoom | null = null;
  let provider: TrysteroProvider | null = null;
  let relay: RelayTransport | null = null;
  // Room-level symmetric key (derived from roomCode + password). Used by
  // TrysteroProvider to encrypt all sync and awareness payloads so neither
  // the MQTT broker nor any passive observer can read them.
  let roomKey: CryptoKey | null = null;
  let statusInterval: ReturnType<typeof setInterval> | null = null;
  let connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  let autoReconnectInterval: ReturnType<typeof setInterval> | null = null;
  let relayTimeout: ReturnType<typeof setTimeout> | null = null;
  let unwatchTurn: (() => void) | null = null;
  /** TURN servers built from local settings (used for sharing) */
  let localTurnServers: TurnServerConfig[] = [];

  /** How long to wait for WebRTC before activating MQTT relay fallback */
  const RELAY_FALLBACK_DELAY_MS = 15_000;

  // Track chat messages (bound to doc, survives reconnect)
  const chatArray = doc.getArray('chat');
  const updateMessages = () => setMessages(getChatMessages(doc));
  chatArray.observe(updateMessages);
  updateMessages();

  // Wire up a trystero room + provider to the existing doc
  function wireTransport(t: TrysteroRoom) {
    if (!roomKey) {
      throw new Error('wireTransport called before roomKey was derived');
    }
    trystero = t;
    setTrysteroRef(t);
    provider = new TrysteroProvider(doc, t, roomKey);
    // Surface the provider's auth state so the UI can react to wrong passwords.
    setAuthState(provider.authState);
    provider.onAuthStateChange((s) => setAuthState(s));

    // Sync the provider's awareness with our standalone awareness state
    setLocalAwareness(provider.awareness, name, color);
    setLocalPeerId(String(doc.clientID));

    // Track participants from provider's awareness (it's the one connected to the network)
    const updateParticipants = () => {
      const list = getParticipantList(provider!.awareness);
      // Keep last-known name per clientID so we can still identify a peer in
      // chat after their awareness state is removed (graceful leave or timeout).
      list.forEach((p) => peerNameCache.set(p.peerId, p.name));
      setParticipants(list);
    };
    provider.awareness.on('change', updateParticipants);
    updateParticipants();

    // When any awareness state is removed (graceful leave broadcasts a removal,
    // or the y-protocols heartbeat times out on hard disconnect), post a named
    // "X left" message to chat. Deterministic leader election — only the peer
    // with the smallest remaining clientID posts — prevents every remaining
    // peer from duplicating the message.
    const onAwarenessRemove = ({ removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      if (removed.length === 0) return;
      const myId = doc.clientID;
      const remainingIds = Array.from(provider!.awareness.getStates().keys());
      if (remainingIds.length === 0) return;
      const leaderId = Math.min(...remainingIds);
      if (leaderId !== myId) return;
      for (const removedId of removed) {
        if (removedId === myId) continue;
        const peerName = peerNameCache.get(String(removedId)) ?? 'Someone';
        sendSystemMessage(doc, `${peerName} left`);
        peerNameCache.delete(String(removedId));
      }
    };
    provider.awareness.on('update', onAwarenessRemove);

    // Peer events
    t.onPeerJoin((_peerId) => {
      setIsConnected(true);
      setConnectionState('connected');
      // Clear the connection timeout on success
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      setTimeout(() => {
        const allParticipants = getParticipantList(provider!.awareness);
        const newest = allParticipants
          .filter(p => p.peerId !== String(doc.clientID))
          .sort((a, b) => b.joinedAt - a.joinedAt)[0];
        const peerName = newest?.name || 'Someone';
        sendSystemMessage(doc, `${peerName} joined`);
      }, 1000);
    });

    t.onPeerLeave((_peerId) => {
      if (t.getPeers().length === 0) {
        setIsConnected(false);
      }
      // Chat-side notification is driven by awareness removal (graceful leave)
      // or awareness heartbeat timeout (hard disconnect). That path names the
      // peer and de-duplicates via leader election, so nothing is posted here.
    });

    // Poll connection status
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(() => {
      if (trystero) setConnectionStatus(trystero.getConnectionStatus());
    }, 2000);
    // Initial status
    setConnectionStatus(t.getConnectionStatus());

    // Connection timeout — if no peer connects within 30s, mark as failed
    // (only for joiners, creators may be alone in the room)
    if (!isCreator) {
      if (connectionTimeout) clearTimeout(connectionTimeout);
      connectionTimeout = setTimeout(() => {
        if (!isConnected() && connectionState() !== 'relay') {
          setConnectionState('failed');
        }
      }, 30_000);
    } else {
      // Creator is "connected" immediately (they're the first one in)
      setConnectionState('connected');
    }

    // MQTT relay fallback — if no WebRTC peer joins within RELAY_FALLBACK_DELAY_MS,
    // activate relay mode so Yjs sync works through the MQTT broker.
    if (relayTimeout) clearTimeout(relayTimeout);
    relayTimeout = setTimeout(() => {
      if (!isConnected() && !relay) {
        activateRelay();
      }
    }, RELAY_FALLBACK_DELAY_MS);

    // Auto-reconnect polling — detect failed relays and rebuild transport.
    // Only reconnect if ALL relays of a strategy are down AND we have no
    // active WebRTC peers. Signaling relay closures are irrelevant when
    // direct P2P is working.
    if (autoReconnectInterval) clearInterval(autoReconnectInterval);
    if (settings().autoReconnect) {
      autoReconnectInterval = setInterval(() => {
        if (
          trystero?.hasFailedRelays() &&
          !trystero.hasPeers() &&
          connectionState() === 'connected'
        ) {
          console.log('[CollabSpace:reconnect] All relays failed and no peers — reconnecting');
          reconnect();
        }
      }, 15_000);
    }
  }

  // Activate MQTT relay fallback
  function activateRelay() {
    if (relay) return;
    const s = settings();
    const brokerUrls = s.mqtt.enabled ? s.mqtt.servers : [];
    if (brokerUrls.length === 0) {
      console.log('[CollabSpace:relay] No MQTT brokers available for relay');
      return;
    }

    console.log('[CollabSpace:relay] Activating MQTT relay fallback...');
    trystero?.setMqttRelayState('connecting');
    relay = createMqttRelay(roomCode, String(doc.clientID), brokerUrls);

    // Poll relay state until it becomes active
    const pollRelay = setInterval(() => {
      const state = relay?.state();
      if (state === 'active' && provider) {
        clearInterval(pollRelay);
        provider.activateRelay(relay!);
        trystero?.setMqttRelayState('active');
        setConnectionState('relay');
        setIsConnected(true);
        // Clear the failed timeout
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        sendSystemMessage(doc, 'Connected via relay (no direct P2P)');
        console.log('[CollabSpace:relay] MQTT relay is active — Yjs sync operational');
      } else if (state === 'failed') {
        clearInterval(pollRelay);
        trystero?.setMqttRelayState('failed');
        console.log('[CollabSpace:relay] MQTT relay failed to connect');
      }
    }, 500);

    // Give up polling after 15s
    setTimeout(() => clearInterval(pollRelay), 15_000);
  }

  // Tear down current transport (preserves doc)
  function teardownTransport() {
    if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
    if (connectionTimeout) { clearTimeout(connectionTimeout); connectionTimeout = null; }
    if (autoReconnectInterval) { clearInterval(autoReconnectInterval); autoReconnectInterval = null; }
    if (relayTimeout) { clearTimeout(relayTimeout); relayTimeout = null; }
    localTurnServers = [];
    relay?.destroy();
    relay = null;
    provider?.destroy();
    trystero?.leave();
    provider = null;
    trystero = null;
    setTrysteroRef(null);
  }

  // Initial async connection
  async function connect(s: ConnectionSettings, extraTurnServers?: TurnServerConfig[]) {
    setConnectionState('connecting');
    setIsConnected(false);
    try {
      // Derive the room key. Same (roomCode, password) pair always yields
      // the same key on both peers, so no key exchange is needed. This is
      // awaited every time connect() runs so setPassword-triggered
      // reconnects pick up the new password.
      if (!roomKey) {
        roomKey = await deriveRoomKey(roomCode, currentPassword);
      }
      const settingsTurn = await buildTurnServers(s);
      // Also try Cloudflare TURN if configured
      const cfCreds = await generateCloudflareCredentials();
      const cfTurn: TurnServerConfig[] = cfCreds ? [cfCreds] : [];
      const turnServers = [...settingsTurn, ...cfTurn, ...(extraTurnServers || [])];
      localTurnServers = turnServers;
      const t = createTrysteroRoom(roomCode, s, turnServers);
      wireTransport(t);

      // If we have TURN servers, publish them for other peers (e.g., those on relay)
      if (turnServers.length > 0) {
        publishTurnCredentials(doc, turnServers);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      setConnectionState('failed');
    }
  }

  // Reconnect with new settings (preserves Yjs doc + chat history)
  async function reconnect(newSettings?: ConnectionSettings, extraTurn?: TurnServerConfig[]) {
    const s = newSettings || settings();
    if (newSettings) {
      saveConnectionSettings(newSettings);
      setSettings(newSettings);
    }
    teardownTransport();
    await connect(s, extraTurn);
  }

  /**
   * Update the password and reconnect. The joiner calls this from the
   * password gate after the initial attempt's auth canary failed. Forces
   * key re-derivation on the next connect().
   */
  async function setPassword(newPassword: string) {
    currentPassword = newPassword;
    roomKey = null;
    setAuthState('pending');
    teardownTransport();
    await connect(settings());
  }

  // Start initial connection (with shared TURN from invite URL if available).
  // The password is folded into the room key via deriveRoomKey — wrong
  // password means every incoming payload fails AES-GCM authentication and
  // is silently dropped. No plaintext password material ever touches the doc.
  connect(settings(), sharedTurn);

  // Watch for shared TURN credentials from other peers.
  // If we're in relay mode and receive working TURN creds, reconnect with them.
  unwatchTurn = watchSharedTurnCredentials(doc, (creds) => {
    const currentState = connectionState();
    // Only attempt reconnect if we're in relay mode or failed
    if (currentState !== 'relay' && currentState !== 'failed') return;
    // Don't reconnect if the shared servers are the same as what we already have
    if (localTurnServers.length > 0) return;

    console.log('[CollabSpace:turn-share] Received shared TURN from peer, reconnecting...');
    sendSystemMessage(doc, 'Received TURN credentials — upgrading to direct P2P...');

    // Reconnect with the shared TURN servers added to our config
    const s = settings();
    teardownTransport();
    connect(s, creds.servers);
  });

  let leaveScheduled = false;
  const leave = () => {
    if (leaveScheduled) return;
    leaveScheduled = true;
    unwatchTurn?.();
    // Broadcast explicit awareness removal so remote peers drop us from their
    // participant lists immediately (no 45s DISCONNECT_GRACE_MS wait) and
    // their leader posts the named "X left" chat message.
    if (provider && provider.awareness.getStates().has(doc.clientID)) {
      try {
        removeAwarenessStates(provider.awareness, [doc.clientID], 'local-leave');
      } catch (e) {
        console.warn('[useRoom] Failed to broadcast awareness removal on leave:', e);
      }
    }
    // Let the provider flush the awareness update over Trystero before we kill
    // transport. Short delay — best-effort, page navigation may cancel it.
    setTimeout(() => {
      teardownTransport();
      doc.destroy();
    }, 150);
  };

  onCleanup(leave);

  return {
    participants,
    messages,
    isConnected,
    connectionState,
    connectionStatus,
    connectionSettings: settings,
    localPeerId,
    localName: name,
    doc,
    awareness,
    sendMessage: (text: string) => {
      sendChatMessage(doc, text, String(doc.clientID), name);
    },
    trysteroRoom: trysteroRef,
    turnServers: () => localTurnServers,
    authState,
    setPassword,
    reconnect,
    retryFailedConnections: () => reconnect(),
    leave,
  };
}
