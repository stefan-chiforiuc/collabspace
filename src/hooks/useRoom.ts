import { createSignal, onCleanup } from 'solid-js';
import { Awareness } from 'y-protocols/awareness';
import { createTrysteroRoom, type TrysteroRoom, type ConnectionStatus } from '../lib/trystero';
import { createYDoc } from '../lib/yjs-doc';
import { TrysteroProvider } from '../lib/yjs-sync';
import { setLocalAwareness, getParticipantList, assignColor } from '../lib/participants';
import { sendChatMessage, sendSystemMessage, getChatMessages } from '../lib/chat';
import { setRoomPassword } from '../lib/room-password';
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

  // Reactive signal for the trystero room (used by useMedia to react to reconnects)
  const [trysteroRef, setTrysteroRef] = createSignal<TrysteroRoom | null>(null);

  // Mutable refs for current trystero + provider (swapped on reconnect)
  let trystero: TrysteroRoom | null = null;
  let provider: TrysteroProvider | null = null;
  let relay: RelayTransport | null = null;
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
    trystero = t;
    setTrysteroRef(t);
    provider = new TrysteroProvider(doc, t);

    // Sync the provider's awareness with our standalone awareness state
    setLocalAwareness(provider.awareness, name, color);
    setLocalPeerId(String(doc.clientID));

    // Track participants from provider's awareness (it's the one connected to the network)
    const updateParticipants = () => {
      setParticipants(getParticipantList(provider!.awareness));
    };
    provider.awareness.on('change', updateParticipants);
    updateParticipants();

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
      sendSystemMessage(doc, `A participant left`);
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

    // Auto-reconnect polling — detect failed relays and rebuild transport
    if (autoReconnectInterval) clearInterval(autoReconnectInterval);
    if (settings().autoReconnect) {
      autoReconnectInterval = setInterval(() => {
        if (trystero?.hasFailedRelays() && connectionState() === 'connected') {
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

  // Set room password if creator
  if (password) {
    setRoomPassword(doc, password);
  }

  // Start initial connection (with shared TURN from invite URL if available)
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

  const leave = () => {
    unwatchTurn?.();
    teardownTransport();
    doc.destroy();
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
    reconnect,
    retryFailedConnections: () => reconnect(),
    leave,
  };
}
