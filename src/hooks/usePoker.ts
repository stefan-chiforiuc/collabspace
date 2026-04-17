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
import { dispatchNotification } from '../lib/notifications';
import type { PokerRound, CardSet } from '../lib/types';

export function usePoker(doc: Y.Doc, localPeerId: () => string, localName: string) {
  const [state, setState] = createSignal<PokerRound & { active: boolean }>(getPokerState(doc));

  const pokerMap = getPoker(doc);

  const update = () => {
    setState(getPokerState(doc));
  };

  // Observe the top-level poker map (topic, revealed, round, etc.)
  pokerMap.observe(update);

  // Also observe the nested votesMap so individual vote changes trigger updates.
  // The votesMap may not exist yet, so we watch for it to appear and attach.
  let votesMapCleanup: (() => void) | null = null;

  function attachVotesObserver() {
    const votesMap = pokerMap.get('votesMap') as Y.Map<string> | undefined;
    if (votesMap && !votesMapCleanup) {
      votesMap.observe(update);
      votesMapCleanup = () => votesMap.unobserve(update);
    }
  }

  // Attach now if it already exists
  attachVotesObserver();

  // Re-check whenever the poker map changes (votesMap might appear)
  const deepObserver = () => {
    attachVotesObserver();
  };
  pokerMap.observeDeep(deepObserver);

  update();

  onCleanup(() => {
    pokerMap.unobserve(update);
    pokerMap.unobserveDeep(deepObserver);
    votesMapCleanup?.();
  });

  return {
    state,
    startRound: (topic: string, cardSet: CardSet) => {
      startPokerRound(doc, topic, cardSet, localPeerId(), localName);
      dispatchNotification(doc, 'poker_started', localPeerId(), localName, `${localName} started Planning Poker`, 'poker');
    },
    vote: (card: string) => {
      submitVote(doc, localPeerId(), card);
    },
    reveal: () => {
      revealVotes(doc);
    },
    reset: () => {
      resetPoker(doc);
    },
    getResults: () => calculatePokerResults(state().votes),
    hasVoted: () => localPeerId() in state().votes,
    myVote: () => state().votes[localPeerId()] || null,
  };
}
