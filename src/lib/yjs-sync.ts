import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { TrysteroRoom } from './trystero';
import type { RelayTransport } from './mqtt-relay';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

/** Retry delay before re-sending sync step 1 to a peer (ms) */
const SYNC_RETRY_DELAY = 500;
/** Max retries for initial sync handshake per peer */
const SYNC_MAX_RETRIES = 5;

export class TrysteroProvider {
  doc: Y.Doc;
  awareness: Awareness;
  private trystero: TrysteroRoom;
  private relay: RelayTransport | null = null;
  private _destroy: (() => void)[] = [];
  private syncedPeers = new Set<string>();
  private _relayActive = false;

  get relayActive() { return this._relayActive; }

  constructor(doc: Y.Doc, trystero: TrysteroRoom) {
    this.doc = doc;
    this.trystero = trystero;
    this.awareness = new Awareness(doc);

    // Handle incoming sync messages (from WebRTC)
    trystero.getSync((data, peerId) => this.handleIncomingSync(data, peerId));

    // Handle incoming awareness messages (from WebRTC)
    trystero.getAwareness((data, _peerId) => {
      try {
        applyAwarenessUpdate(this.awareness, data, this);
      } catch {
        // Ignore malformed awareness
      }
    });

    // Broadcast local doc updates
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === this) return; // Don't echo remote updates
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const encoded = encoding.toUint8Array(encoder);
      // Send via WebRTC (if connected) AND relay (if active)
      trystero.sendSync(encoded);
      this.relay?.sendSync(encoded);
    };
    doc.on('update', onUpdate);
    this._destroy.push(() => doc.off('update', onUpdate));

    // Broadcast awareness changes
    const onAwarenessChange = ({ added, updated, removed }: {
      added: number[]; updated: number[]; removed: number[];
    }) => {
      const changed = added.concat(updated, removed);
      const update = encodeAwarenessUpdate(this.awareness, changed);
      trystero.sendAwareness(update);
      this.relay?.sendAwareness(update);
    };
    this.awareness.on('change', onAwarenessChange);
    this._destroy.push(() => this.awareness.off('change', onAwarenessChange));

    // When a new peer joins via WebRTC, initiate sync
    trystero.onPeerJoin((peerId) => {
      this.syncedPeers.add(peerId);
      this.sendSyncStep1(peerId);
      this.sendAwarenessTo(peerId);
    });

    trystero.onPeerLeave((peerId) => {
      this.syncedPeers.delete(peerId);
    });
  }

  /**
   * Activate the MQTT relay fallback transport.
   * Messages are sent/received through MQTT in addition to WebRTC.
   */
  activateRelay(relay: RelayTransport) {
    if (this.relay) return; // Already active
    this.relay = relay;
    this._relayActive = true;
    console.log('[CollabSpace:relay] Relay transport activated in TrysteroProvider');

    // Handle incoming sync messages from relay
    relay.onSync((data, senderId) => this.handleIncomingSync(data, senderId));

    // Handle incoming awareness messages from relay
    relay.onAwareness((data, _senderId) => {
      try {
        applyAwarenessUpdate(this.awareness, data, this);
      } catch { /* ignore */ }
    });

    // When relay activates, send our full state so the other peer syncs up
    this.broadcastSyncStep1ViaRelay();
    this.broadcastAwarenessViaRelay();

    this._destroy.push(() => {
      this.relay = null;
      this._relayActive = false;
    });
  }

  /** Send sync step 1 to all peers via relay (broadcast, not targeted) */
  private broadcastSyncStep1ViaRelay() {
    if (!this.relay) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.relay.sendSync(encoding.toUint8Array(encoder));
  }

  /** Send full awareness state via relay */
  private broadcastAwarenessViaRelay() {
    if (!this.relay) return;
    const states = Array.from(this.awareness.getStates().keys());
    if (states.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, states);
    this.relay.sendAwareness(update);
  }

  /** Handle an incoming sync message (from either WebRTC or relay). */
  private handleIncomingSync(data: Uint8Array, peerId: string) {
    try {
      const decoder = decoding.createDecoder(data);
      const msgType = decoding.readVarUint(decoder);

      if (msgType === MSG_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        const messageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);

        // If we received a sync step 1 from a peer we haven't synced with yet,
        // also send our own sync step 1 so they get our state too
        if (messageType === 0 && !this.syncedPeers.has(peerId)) {
          this.syncedPeers.add(peerId);
          this.sendSyncStep1(peerId);
        }

        if (encoding.length(encoder) > 1) {
          const reply = encoding.toUint8Array(encoder);
          // Reply via both transports
          this.trystero.sendSync(reply, [peerId]);
          this.relay?.sendSync(reply);
        }
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private sendSyncStep1(peerId: string) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    const encoded = encoding.toUint8Array(encoder);
    this.trystero.sendSync(encoded, [peerId]);
    // Also send via relay (broadcast — relay doesn't support targeting)
    this.relay?.sendSync(encoded);
  }

  private sendAwarenessTo(peerId: string) {
    const states = Array.from(this.awareness.getStates().keys());
    if (states.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, states);
    this.trystero.sendAwareness(update, [peerId]);
    this.relay?.sendAwareness(update);
  }

  destroy() {
    this._destroy.forEach((fn) => fn());
    this._destroy = [];
    this.syncedPeers.clear();
    this.relay = null;
    this._relayActive = false;
    this.awareness.destroy();
  }
}
