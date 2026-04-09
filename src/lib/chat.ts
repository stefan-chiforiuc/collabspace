import * as Y from 'yjs';
import type { ChatMessage } from './types';
import { getChat } from './yjs-doc';

export function sendChatMessage(
  doc: Y.Doc,
  text: string,
  authorId: string,
  authorName: string,
): void {
  const chat = getChat(doc);
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    author: authorId,
    authorName,
    text,
    timestamp: Date.now(),
    type: 'user',
    reactions: {},
  };
  chat.push([message]);
}

export function sendSystemMessage(doc: Y.Doc, text: string): void {
  const chat = getChat(doc);
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    author: '',
    authorName: '',
    text,
    timestamp: Date.now(),
    type: 'system',
    reactions: {},
  };
  chat.push([message]);
}

export function getChatMessages(doc: Y.Doc): ChatMessage[] {
  return getChat(doc).toArray();
}
