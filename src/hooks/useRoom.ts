import { createSignal, onCleanup } from 'solid-js';
import { createTrysteroRoom, type TrysteroRoom } from '../lib/trystero';
import { createYDoc } from '../lib/yjs-doc';
import { TrysteroProvider } from '../lib/yjs-sync';
import { setLocalAwareness, getParticipantList, assignColor } from '../lib/participants';
import { sendChatMessage, sendSystemMessage, getChatMessages } from '../lib/chat';
import { setRoomPassword } from '../lib/room-password';
import { getDisplayName } from '../lib/storage';
import { MAX_PARTICIPANTS } from '../lib/constants';
import type { Participant, ChatMessage } from '../lib/types';

export function useRoom(roomCode: string, password?: string, isCreator: boolean = false) {
  const [participants, setParticipants] = createSignal<Participant[]>([]);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);
  const [localPeerId, setLocalPeerId] = createSignal('');

  // Only the creator writes initial meta — joiners receive it via Yjs sync
  const doc = createYDoc({
    roomCode,
    roomName: roomCode,
    createdAt: Date.now(),
    settings: { maxParticipants: MAX_PARTICIPANTS },
  }, isCreator);

  // Create Trystero room
  const trystero: TrysteroRoom = createTrysteroRoom(roomCode);

  // Set local user in awareness BEFORE creating provider,
  // so the awareness snapshot sent to peers includes our info
  const name = getDisplayName() || 'Anonymous';
  const colorIndex = Math.floor(Math.random() * 6);

  // Bridge Yjs sync over Trystero
  const provider = new TrysteroProvider(doc, trystero);

  // Set awareness immediately after provider creation
  setLocalAwareness(provider.awareness, name, assignColor(colorIndex));
  setLocalPeerId(String(doc.clientID));

  // Track participants from awareness
  const updateParticipants = () => {
    setParticipants(getParticipantList(provider.awareness));
  };
  provider.awareness.on('change', updateParticipants);
  updateParticipants();

  // Track chat messages
  const chatArray = doc.getArray('chat');
  const updateMessages = () => {
    setMessages(getChatMessages(doc));
  };
  chatArray.observe(updateMessages);
  updateMessages();

  // Track connection state — use awareness to look up peer names
  trystero.onPeerJoin((_peerId) => {
    setIsConnected(true);
    // Delay the system message slightly so awareness has time to sync
    setTimeout(() => {
      const allParticipants = getParticipantList(provider.awareness);
      // The newest participant is the one who just joined (highest joinedAt)
      const newest = allParticipants
        .filter(p => p.peerId !== String(doc.clientID))
        .sort((a, b) => b.joinedAt - a.joinedAt)[0];
      const peerName = newest?.name || 'Someone';
      sendSystemMessage(doc, `${peerName} joined`);
    }, 1000);
  });

  trystero.onPeerLeave((_peerId) => {
    if (trystero.getPeers().length === 0) {
      setIsConnected(false);
    }
    sendSystemMessage(doc, `A participant left`);
  });

  // Set room password if provided (creator flow)
  if (password) {
    setRoomPassword(doc, password);
  }

  const leave = () => {
    provider.destroy();
    trystero.leave();
    doc.destroy();
  };

  onCleanup(leave);

  return {
    participants,
    messages,
    isConnected,
    localPeerId,
    localName: name,
    doc,
    awareness: provider.awareness,
    sendMessage: (text: string) => {
      sendChatMessage(doc, text, String(doc.clientID), name);
    },
    leave,
  };
}
