import { createSignal, onCleanup } from 'solid-js';
import * as Y from 'yjs';
import { getPoker } from '../lib/yjs-doc';
import {
  startPokerRound,
  submitVote,
  revealVotes,
  resetPoker,
  getPokerState,
  calculatePokerResults,
} from '../lib/poker';
import type { PokerRound, CardSet } from '../lib/types';

export function usePoker(doc: Y.Doc, localPeerId: string, localName: string) {
  const [state, setState] = createSignal<PokerRound & { active: boolean }>(getPokerState(doc));

  const pokerMap = getPoker(doc);

  const update = () => {
    setState(getPokerState(doc));
  };

  pokerMap.observe(update);
  update();

  onCleanup(() => pokerMap.unobserve(update));

  return {
    state,
    startRound: (topic: string, cardSet: CardSet) => {
      startPokerRound(doc, topic, cardSet, localPeerId, localName);
    },
    vote: (card: string) => {
      submitVote(doc, localPeerId, card);
    },
    reveal: () => {
      revealVotes(doc);
    },
    reset: () => {
      resetPoker(doc);
    },
    getResults: () => calculatePokerResults(state().votes),
    hasVoted: () => localPeerId in state().votes,
    myVote: () => state().votes[localPeerId] || null,
  };
}
