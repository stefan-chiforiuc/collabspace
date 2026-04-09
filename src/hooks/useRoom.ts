import { createSignal, onCleanup } from 'solid-js';
import { createTrysteroRoom, type TrysteroRoom } from '../lib/trystero';
import { createYDoc } from '../lib/yjs-doc';
import { TrysteroProvider } from '../lib/yjs-sync';
import { setLocalAwareness, getParticipantList, assignColor } from '../lib/participants';
import { sendChatMessage, sendSystemMessage, getChatMessages } from '../lib/chat';
import { getDisplayName } from '../lib/storage';
import { MAX_PARTICIPANTS } from '../lib/constants';
import type { Participant, ChatMessage } from '../lib/types';

export function useRoom(roomCode: string) {
  const [participants, setParticipants] = createSignal<Participant[]>([]);
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);
  const [localPeerId, setLocalPeerId] = createSignal('');

  // Create Yjs doc
  const doc = createYDoc({
    roomCode,
    roomName: roomCode,
    createdAt: Date.now(),
    settings: { maxParticipants: MAX_PARTICIPANTS },
  });

  // Create Trystero room
  const trystero: TrysteroRoom = createTrysteroRoom(roomCode);

  // Bridge Yjs sync over Trystero
  const provider = new TrysteroProvider(doc, trystero);

  // Set local user in awareness
  const name = getDisplayName() || 'Anonymous';
  const colorIndex = Math.floor(Math.random() * 6);
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

  // Track connection state
  trystero.onPeerJoin((peerId) => {
    setIsConnected(true);
    const peerStates = provider.awareness.getStates();
    const peerState = peerStates.get(Number(peerId));
    const peerName = peerState?.user?.name || 'Someone';
    sendSystemMessage(doc, `${peerName} joined`);
  });

  trystero.onPeerLeave((peerId) => {
    if (trystero.getPeers().length === 0) {
      setIsConnected(false);
    }
    sendSystemMessage(doc, `A participant left`);
  });

  // Mark connected once awareness is set
  setIsConnected(true);

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
    sendMessage: (text: string) => {
      sendChatMessage(doc, text, String(doc.clientID), name);
    },
    leave,
  };
}
