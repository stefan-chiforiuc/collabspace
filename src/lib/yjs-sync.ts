import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { TrysteroRoom } from './trystero';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

export class TrysteroProvider {
  doc: Y.Doc;
  awareness: Awareness;
  private trystero: TrysteroRoom;
  private _destroy: (() => void)[] = [];

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
          syncProtocol.readSyncMessage(decoder, encoder, doc, this);

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

    // When a new peer joins, send them our state
    trystero.onPeerJoin((peerId) => {
      // Send sync step 1
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeSyncStep1(encoder, doc);
      trystero.sendSync(encoding.toUint8Array(encoder), [peerId]);

      // Send awareness state
      const awarenessUpdate = encodeAwarenessUpdate(
        this.awareness,
        Array.from(this.awareness.getStates().keys())
      );
      trystero.sendAwareness(awarenessUpdate, [peerId]);
    });
  }

  destroy() {
    this._destroy.forEach((fn) => fn());
    this._destroy = [];
    this.awareness.destroy();
  }
}
