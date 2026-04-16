import * as Y from 'yjs';
import { getPoker } from './yjs-doc';
import type { PokerRound, CardSet } from './types';

function getVotesMap(doc: Y.Doc): Y.Map<string> {
  const poker = getPoker(doc);
  let votesMap = poker.get('votesMap') as Y.Map<string> | undefined;
  if (!votesMap) {
    votesMap = new Y.Map<string>();
    poker.set('votesMap', votesMap);
  }
  return votesMap;
}

export function startPokerRound(
  doc: Y.Doc,
  topic: string,
  cardSet: CardSet,
  startedBy: string,
  startedByName: string,
): void {
  const poker = getPoker(doc);
  const currentRound = poker.get('round') as number | undefined;

  poker.set('topic', topic);
  poker.set('cardSet', cardSet);
  poker.set('revealed', false);
  poker.set('round', (currentRound ?? 0) + 1);
  poker.set('startedBy', startedBy);
  poker.set('startedByName', startedByName);
  poker.set('startedAt', Date.now());
  poker.set('active', true);

  // Clear all votes using the nested Y.Map (each key is a peerId)
  const votesMap = getVotesMap(doc);
  for (const key of [...votesMap.keys()]) {
    votesMap.delete(key);
  }
  // Also clear legacy plain-object votes
  poker.delete('votes');
}

export function submitVote(
  doc: Y.Doc,
  peerId: string,
  card: string,
): void {
  const poker = getPoker(doc);
  if (poker.get('revealed') || !poker.get('active')) return;

  // Write directly to the nested Y.Map — each peer's vote is an independent
  // CRDT entry, so concurrent votes don't overwrite each other.
  const votesMap = getVotesMap(doc);
  votesMap.set(peerId, card);
}

export function revealVotes(doc: Y.Doc): void {
  const poker = getPoker(doc);
  if (poker.get('revealed') || !poker.get('active')) return;

  poker.set('revealed', true);
}

export function resetPoker(doc: Y.Doc): void {
  const poker = getPoker(doc);
  poker.set('active', false);
  poker.set('revealed', false);
  poker.set('topic', '');

  const votesMap = getVotesMap(doc);
  for (const key of [...votesMap.keys()]) {
    votesMap.delete(key);
  }
  poker.delete('votes');
}

export function getPokerState(doc: Y.Doc): PokerRound & { active: boolean } {
  const poker = getPoker(doc);

  // Read votes from the nested Y.Map
  const votesMap = getVotesMap(doc);
  const votes: Record<string, string> = {};
  votesMap.forEach((value, key) => {
    votes[key] = value;
  });

  // Fallback: merge any legacy plain-object votes (old sessions)
  const legacyVotes = poker.get('votes') as Record<string, string> | undefined;
  if (legacyVotes && typeof legacyVotes === 'object') {
    for (const [k, v] of Object.entries(legacyVotes)) {
      if (!(k in votes)) votes[k] = v;
    }
  }

  return {
    topic: (poker.get('topic') as string) || '',
    cardSet: (poker.get('cardSet') as CardSet) || 'fibonacci',
    votes,
    revealed: (poker.get('revealed') as boolean) || false,
    round: (poker.get('round') as number) || 0,
    startedBy: (poker.get('startedBy') as string) || '',
    startedByName: (poker.get('startedByName') as string) || '',
    startedAt: (poker.get('startedAt') as number) || 0,
    active: (poker.get('active') as boolean) || false,
  };
}

export function calculatePokerResults(votes: Record<string, string>): {
  average: number | null;
  consensus: boolean;
  distribution: Record<string, number>;
} {
  const values = Object.values(votes);
  const numeric = values
    .map(Number)
    .filter((n) => !isNaN(n));

  const distribution: Record<string, number> = {};
  values.forEach((v) => {
    distribution[v] = (distribution[v] || 0) + 1;
  });

  const average = numeric.length > 0
    ? Math.round((numeric.reduce((a, b) => a + b, 0) / numeric.length) * 10) / 10
    : null;

  const uniqueValues = new Set(values);
  const consensus = uniqueValues.size === 1 && values.length > 1;

  return { average, consensus, distribution };
}
