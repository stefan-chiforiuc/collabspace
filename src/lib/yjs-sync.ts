import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { TrysteroRoom } from './trystero';
import type { RelayTransport } from './mqtt-relay';
import { encryptPayload, decryptPayload, createCanary, verifyCanary } from './room-crypto';

/**
 * Auth state for the room-level encryption gate.
 *
 * - `pending`:  we've derived a key but haven't yet verified any canary
 *               against it (either no peer is connected yet, or the
 *               handshake is still in flight).
 * - `verified`: at least one peer broadcast an encrypted canary that
 *               decrypted cleanly under our key — we and they share the
 *               same room password.
 * - `failed`:   a peer broadcast a canary that did NOT decrypt under our
 *               key. Our password is wrong (or tampered traffic).
 */
export type AuthState = 'pending' | 'verified' | 'failed';

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
  private cryptoKey: CryptoKey;
  private _authState: AuthState = 'pending';
  private authListeners: ((state: AuthState) => void)[] = [];

  get relayActive() { return this._relayActive; }
  get authState() { return this._authState; }
  onAuthStateChange(cb: (state: AuthState) => void) {
    this.authListeners.push(cb);
  }
  private setAuthState(next: AuthState) {
    // 'verified' is sticky — once we've proven the key, don't downgrade on
    // a later garbage packet from a tamper/noise source.
    if (this._authState === 'verified') return;
    if (this._authState === next) return;
    this._authState = next;
    this.authListeners.forEach((cb) => cb(next));
  }

  /**
   * @param doc       — the Y.Doc to sync
   * @param trystero  — Trystero room wrapper
   * @param cryptoKey — room-level AES-GCM key (derived from code+password).
   *                    All outgoing payloads are encrypted with this key and
   *                    all incoming payloads must decrypt under it to be
   *                    accepted. This is the E2E gate that makes the MQTT
   *                    relay fallback safe to use.
   */
  constructor(doc: Y.Doc, trystero: TrysteroRoom, cryptoKey: CryptoKey) {
    this.doc = doc;
    this.trystero = trystero;
    this.cryptoKey = cryptoKey;
    this.awareness = new Awareness(doc);

    // Handle incoming sync messages (from WebRTC)
    trystero.getSync((data, peerId) => {
      this.decryptAndRoute(data, (plain) => this.handleIncomingSync(plain, peerId));
    });

    // Handle incoming awareness messages (from WebRTC)
    trystero.getAwareness((data, _peerId) => {
      this.decryptAndRoute(data, (plain) => {
        try {
          applyAwarenessUpdate(this.awareness, plain, this);
        } catch {
          // Ignore malformed awareness
        }
      });
    });

    // Broadcast local doc updates
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === this) return; // Don't echo remote updates
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const encoded = encoding.toUint8Array(encoder);
      this.sendEncryptedSync(encoded);
    };
    doc.on('update', onUpdate);
    this._destroy.push(() => doc.off('update', onUpdate));

    // Broadcast awareness changes
    const onAwarenessChange = ({ added, updated, removed }: {
      added: number[]; updated: number[]; removed: number[];
    }) => {
      const changed = added.concat(updated, removed);
      const update = encodeAwarenessUpdate(this.awareness, changed);
      this.sendEncryptedAwareness(update);
    };
    this.awareness.on('change', onAwarenessChange);
    this._destroy.push(() => this.awareness.off('change', onAwarenessChange));

    // Listen for auth canaries from other peers. A canary that decrypts
    // cleanly under our key proves we share a password with the sender.
    trystero.getCanary((data, _peerId) => {
      verifyCanary(this.cryptoKey, data)
        .then((ok) => {
          this.setAuthState(ok ? 'verified' : 'failed');
        })
        .catch(() => {
          this.setAuthState('failed');
        });
    });

    // When a new peer joins via WebRTC, initiate sync AND broadcast a canary
    // so the remote end can confirm our password matches theirs.
    trystero.onPeerJoin((peerId) => {
      this.syncedPeers.add(peerId);
      this.sendSyncStep1(peerId);
      this.sendAwarenessTo(peerId);
      this.sendCanaryTo(peerId);
    });

    trystero.onPeerLeave((peerId) => {
      this.syncedPeers.delete(peerId);
    });
  }

  /** Send an encrypted canary to a newly joined peer. */
  private sendCanaryTo(peerId: string) {
    createCanary(this.cryptoKey)
      .then((ct) => {
        this.trystero.sendCanary(ct, [peerId]);
      })
      .catch(() => { /* drop */ });
  }

  /** Encrypt a plaintext payload then emit on all active transports. */
  private sendEncryptedSync(plain: Uint8Array, targets?: string[]) {
    encryptPayload(this.cryptoKey, plain)
      .then((ct) => {
        this.trystero.sendSync(ct, targets);
        // Relay has no peer targeting — only emit non-targeted sends
        if (!targets) this.relay?.sendSync(ct);
      })
      .catch(() => { /* drop on encrypt failure */ });
  }

  private sendEncryptedAwareness(plain: Uint8Array, targets?: string[]) {
    encryptPayload(this.cryptoKey, plain)
      .then((ct) => {
        this.trystero.sendAwareness(ct, targets);
        if (!targets) this.relay?.sendAwareness(ct);
      })
      .catch(() => { /* drop */ });
  }

  /** Decrypt an incoming payload and route the plaintext to a handler. */
  private decryptAndRoute(data: Uint8Array, handle: (plain: Uint8Array) => void) {
    decryptPayload(this.cryptoKey, data)
      .then((plain) => {
        if (plain) handle(plain);
        // Silently drop payloads that fail auth — wrong password or
        // tampered traffic. Never expose the raw bytes to Yjs.
      })
      .catch(() => { /* drop */ });
  }

  /**
   * Activate the MQTT relay fallback transport.
   * Messages are sent/received through MQTT in addition to WebRTC. Relay
   * payloads go through the same encryption wrapper — the broker never sees
   * plaintext Yjs updates.
   */
  activateRelay(relay: RelayTransport) {
    if (this.relay) return; // Already active
    this.relay = relay;
    this._relayActive = true;
    console.log('[CollabSpace:relay] Relay transport activated in TrysteroProvider');

    // Handle incoming sync messages from relay
    relay.onSync((data, senderId) => {
      this.decryptAndRoute(data, (plain) => this.handleIncomingSync(plain, senderId));
    });

    // Handle incoming awareness messages from relay
    relay.onAwareness((data, _senderId) => {
      this.decryptAndRoute(data, (plain) => {
        try {
          applyAwarenessUpdate(this.awareness, plain, this);
        } catch { /* ignore */ }
      });
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
    const plain = encoding.toUint8Array(encoder);
    encryptPayload(this.cryptoKey, plain)
      .then((ct) => { this.relay?.sendSync(ct); })
      .catch(() => { /* drop */ });
  }

  /** Send full awareness state via relay */
  private broadcastAwarenessViaRelay() {
    if (!this.relay) return;
    const states = Array.from(this.awareness.getStates().keys());
    if (states.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, states);
    encryptPayload(this.cryptoKey, update)
      .then((ct) => { this.relay?.sendAwareness(ct); })
      .catch(() => { /* drop */ });
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
          // Reply via both transports. Targeted over WebRTC (peerId),
          // broadcast over relay (no targeting available).
          this.sendEncryptedSync(reply, [peerId]);
          // Also broadcast to relay so late joiners in relay mode catch up.
          if (this.relay) {
            encryptPayload(this.cryptoKey, reply)
              .then((ct) => this.relay?.sendSync(ct))
              .catch(() => { /* drop */ });
          }
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
    const plain = encoding.toUint8Array(encoder);
    // Targeted over WebRTC, broadcast over relay
    this.sendEncryptedSync(plain, [peerId]);
    if (this.relay) {
      encryptPayload(this.cryptoKey, plain)
        .then((ct) => this.relay?.sendSync(ct))
        .catch(() => { /* drop */ });
    }
  }

  private sendAwarenessTo(peerId: string) {
    const states = Array.from(this.awareness.getStates().keys());
    if (states.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, states);
    this.sendEncryptedAwareness(update, [peerId]);
    if (this.relay) {
      encryptPayload(this.cryptoKey, update)
        .then((ct) => this.relay?.sendAwareness(ct))
        .catch(() => { /* drop */ });
    }
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
