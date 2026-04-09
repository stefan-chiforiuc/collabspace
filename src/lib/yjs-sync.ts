import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { TrysteroRoom } from './trystero';

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
  private _destroy: (() => void)[] = [];
  private syncedPeers = new Set<string>();

  constructor(doc: Y.Doc, trystero: TrysteroRoom) {
    this.doc = doc;
    this.trystero = trystero;
    this.awareness = new Awareness(doc);

    // Handle incoming sync messages
    trystero.getSync((data, peerId) => {
      try {
        const decoder = decoding.createDecoder(data);
        const msgType = decoding.readVarUint(decoder);

        if (msgType === MSG_SYNC) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MSG_SYNC);
          const messageType = syncProtocol.readSyncMessage(decoder, encoder, doc, this);

          // If we received a sync step 1 from a peer we haven't synced with yet,
          // also send our own sync step 1 so they get our state too
          if (messageType === 0 && !this.syncedPeers.has(peerId)) {
            this.syncedPeers.add(peerId);
            this.sendSyncStep1(peerId);
          }

          if (encoding.length(encoder) > 1) {
            trystero.sendSync(encoding.toUint8Array(encoder), [peerId]);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // Handle incoming awareness messages
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
      trystero.sendSync(encoding.toUint8Array(encoder));
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
    };
    this.awareness.on('change', onAwarenessChange);
    this._destroy.push(() => this.awareness.off('change', onAwarenessChange));

    // When a new peer joins, initiate sync with retries
    // Both sides send sync step 1 — this ensures bidirectional state exchange
    trystero.onPeerJoin((peerId) => {
      this.syncedPeers.add(peerId);
      this.sendSyncStep1WithRetry(peerId, 0);
      this.sendAwarenessTo(peerId);
    });

    // Clean up synced peer tracking on leave
    trystero.onPeerLeave((peerId) => {
      this.syncedPeers.delete(peerId);
    });
  }

  private sendSyncStep1(peerId: string) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.trystero.sendSync(encoding.toUint8Array(encoder), [peerId]);
  }

  /** Send sync step 1 with retries to handle data channel not being ready yet */
  private sendSyncStep1WithRetry(peerId: string, attempt: number) {
    if (attempt >= SYNC_MAX_RETRIES) return;
    if (!this.syncedPeers.has(peerId)) return; // Peer left

    this.sendSyncStep1(peerId);

    // Retry in case the data channel wasn't ready
    const timer = setTimeout(() => {
      this.sendSyncStep1WithRetry(peerId, attempt + 1);
    }, SYNC_RETRY_DELAY * (attempt + 1));

    this._destroy.push(() => clearTimeout(timer));
  }

  private sendAwarenessTo(peerId: string) {
    const states = Array.from(this.awareness.getStates().keys());
    if (states.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, states);
    this.trystero.sendAwareness(update, [peerId]);
  }

  destroy() {
    this._destroy.forEach((fn) => fn());
    this._destroy = [];
    this.syncedPeers.clear();
    this.awareness.destroy();
  }
}
