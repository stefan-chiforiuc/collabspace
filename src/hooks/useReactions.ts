import { createSignal, onCleanup } from 'solid-js';
import * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { getReactions } from '../lib/yjs-doc';
import {
  sendReaction,
  getRecentReactions,
  setRaiseHand,
  getHandsRaised,
  REACTION_DURATION_MS,
} from '../lib/reactions';
import type { Reaction } from '../lib/types';

export function useReactions(
  doc: Y.Doc,
  awareness: Awareness,
  localPeerId: string,
  localName: string,
) {
  const [recent, setRecent] = createSignal<Reaction[]>([]);
  const [handRaised, setHandRaised] = createSignal(false);
  const [handsUp, setHandsUp] = createSignal<{ peerId: string; name: string }[]>([]);

  const reactionsArray = getReactions(doc);

  const updateReactions = () => {
    setRecent(getRecentReactions(doc));
  };

  const updateHands = () => {
    setHandsUp(getHandsRaised(awareness));
  };

  reactionsArray.observe(updateReactions);
  awareness.on('change', updateHands);
  updateReactions();
  updateHands();

  // Prune old reactions periodically
  const pruneInterval = setInterval(updateReactions, 1000);

  onCleanup(() => {
    reactionsArray.unobserve(updateReactions);
    awareness.off('change', updateHands);
    clearInterval(pruneInterval);
  });

  return {
    recent,
    handsUp,
    handRaised,
    react: (emoji: string) => {
      sendReaction(doc, emoji, localPeerId, localName);
    },
    toggleHand: () => {
      const next = !handRaised();
      setHandRaised(next);
      setRaiseHand(awareness, next);
    },
  };
}
