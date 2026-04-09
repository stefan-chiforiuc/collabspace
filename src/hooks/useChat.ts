import { createSignal, onCleanup } from 'solid-js';
import * as Y from 'yjs';
import { getChatMessages, sendChatMessage } from '../lib/chat';
import type { ChatMessage } from '../lib/types';

export function useChat(doc: Y.Doc, localPeerId: string, localName: string) {
  const [messages, setMessages] = createSignal<ChatMessage[]>([]);

  const chatArray = doc.getArray('chat');
  const update = () => setMessages(getChatMessages(doc));

  chatArray.observe(update);
  update();

  onCleanup(() => chatArray.unobserve(update));

  return {
    messages,
    sendMessage: (text: string) => {
      sendChatMessage(doc, text, localPeerId, localName);
    },
  };
}
