import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { getReactions } from './yjs-doc';
import type { Reaction } from './types';

export const QUICK_EMOJIS = ['\ud83d\udc4d', '\ud83d\udc4e', '\ud83d\ude02', '\ud83c\udf89', '\u2764\ufe0f', '\ud83d\ude2e', '\ud83d\ude4f', '\ud83d\udd25'];

export const REACTION_DURATION_MS = 3000;

export function sendReaction(
  doc: Y.Doc,
  emoji: string,
  peerId: string,
  peerName: string,
): void {
  const reactions = getReactions(doc);
  const reaction: Reaction = {
    id: crypto.randomUUID(),
    emoji,
    peerId,
    peerName,
    timestamp: Date.now(),
  };
  reactions.push([reaction]);
}

export function getRecentReactions(doc: Y.Doc): Reaction[] {
  const reactions = getReactions(doc);
  const now = Date.now();
  return reactions.toArray().filter((r) => now - r.timestamp < REACTION_DURATION_MS);
}

export function setRaiseHand(awareness: Awareness, raised: boolean): void {
  awareness.setLocalStateField('handRaised', raised);
}

export function getHandsRaised(awareness: Awareness): { peerId: string; name: string }[] {
  const raised: { peerId: string; name: string }[] = [];
  awareness.getStates().forEach((state, clientId) => {
    if (state.handRaised && state.user) {
      raised.push({ peerId: String(clientId), name: state.user.name || 'Anonymous' });
    }
  });
  return raised;
}
