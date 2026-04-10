import * as Y from 'yjs';
import type { RoomMeta, ChatMessage, Reaction } from './types';
import type { NotificationEvent } from './notifications';

export function createYDoc(meta: RoomMeta, isCreator: boolean): Y.Doc {
  const doc = new Y.Doc();

  // Only the room creator writes initial meta — joiners receive it via Yjs sync
  if (isCreator) {
    const metaMap = doc.getMap('meta');
    metaMap.set('roomCode', meta.roomCode);
    metaMap.set('roomName', meta.roomName);
    metaMap.set('createdAt', meta.createdAt);
    metaMap.set('maxParticipants', meta.settings.maxParticipants);
  }

  // Declare structures (lazy init — just accessing them registers the type)
  doc.getArray<ChatMessage>('chat');
  doc.getMap('polls');
  doc.getMap('poker');
  doc.getMap('timer');
  doc.getArray<Reaction>('reactions');
  doc.getArray<NotificationEvent>('notifications');
  doc.getXmlFragment('notepad');

  return doc;
}

export function getChat(doc: Y.Doc): Y.Array<ChatMessage> {
  return doc.getArray<ChatMessage>('chat');
}

export function getMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('meta');
}

export function getPolls(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('polls');
}

export function getPoker(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('poker');
}

export function getTimer(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('timer');
}

export function getReactions(doc: Y.Doc): Y.Array<Reaction> {
  return doc.getArray<Reaction>('reactions');
}
