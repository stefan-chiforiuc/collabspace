import { joinRoom as trysteroJoin } from 'trystero/nostr';
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

export function createTrysteroRoom(roomCode: string): TrysteroRoom {
  const room = trysteroJoin({ appId: APP_ID }, roomCode);

  const [sendSync, getSync] = room.makeAction<Uint8Array>('yjs-sync');
  const [sendAwareness, getAwareness] = room.makeAction<Uint8Array>('yjs-awareness');

  const peers = new Set<string>();
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const joinCallbacks: ((peerId: string) => void)[] = [];
  const leaveCallbacks: ((peerId: string) => void)[] = [];

  room.onPeerJoin((peerId) => {
    // Cancel pending disconnect if reconnecting
    const timer = disconnectTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(peerId);
    }

    if (peers.size >= MAX_PARTICIPANTS && !peers.has(peerId)) {
      return; // At capacity
    }

    peers.add(peerId);
    joinCallbacks.forEach((cb) => cb(peerId));
  });

  room.onPeerLeave((peerId) => {
    // Grace period before removing
    const timer = setTimeout(() => {
      peers.delete(peerId);
      disconnectTimers.delete(peerId);
      leaveCallbacks.forEach((cb) => cb(peerId));
    }, DISCONNECT_GRACE_MS);
    disconnectTimers.set(peerId, timer);
  });

  return {
    room,
    sendSync: (data, targets) => sendSync(data, targets),
    getSync: (cb) => getSync(cb),
    sendAwareness: (data, targets) => sendAwareness(data, targets),
    getAwareness: (cb) => getAwareness(cb),
    onPeerJoin: (cb) => joinCallbacks.push(cb),
    onPeerLeave: (cb) => leaveCallbacks.push(cb),
    getPeers: () => [...peers],
    leave: () => {
      disconnectTimers.forEach((t) => clearTimeout(t));
      disconnectTimers.clear();
      room.leave();
    },
  };
}
