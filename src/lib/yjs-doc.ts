import * as Y from 'yjs';
import type { RoomMeta, ChatMessage } from './types';

export function createYDoc(meta: RoomMeta): Y.Doc {
  const doc = new Y.Doc();

  const metaMap = doc.getMap('meta');
  metaMap.set('roomCode', meta.roomCode);
  metaMap.set('roomName', meta.roomName);
  metaMap.set('createdAt', meta.createdAt);
  metaMap.set('maxParticipants', meta.settings.maxParticipants);

  // Declare structures (lazy init — just accessing them registers the type)
  doc.getArray<ChatMessage>('chat');
  doc.getMap('polls');
  doc.getMap('poker');
  doc.getMap('timer');

  return doc;
}

export function getChat(doc: Y.Doc): Y.Array<ChatMessage> {
  return doc.getArray<ChatMessage>('chat');
}

export function getMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('meta');
}
