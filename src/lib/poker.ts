import * as Y from 'yjs';
import { getPoker } from './yjs-doc';
import type { PokerRound, CardSet } from './types';

export function startPokerRound(
  doc: Y.Doc,
  topic: string,
  cardSet: CardSet,
  startedBy: string,
  startedByName: string,
): void {
  const poker = getPoker(doc);
  const currentRound = poker.get('round') as number | undefined;

  const round: PokerRound = {
    topic,
    cardSet,
    votes: {},
    revealed: false,
    round: (currentRound ?? 0) + 1,
    startedBy,
    startedByName,
    startedAt: Date.now(),
  };

  // Set all fields on the Y.Map
  poker.set('topic', round.topic);
  poker.set('cardSet', round.cardSet);
  poker.set('votes', round.votes);
  poker.set('revealed', round.revealed);
  poker.set('round', round.round);
  poker.set('startedBy', round.startedBy);
  poker.set('startedByName', round.startedByName);
  poker.set('startedAt', round.startedAt);
  poker.set('active', true);
}

export function submitVote(
  doc: Y.Doc,
  peerId: string,
  card: string,
): void {
  const poker = getPoker(doc);
  if (poker.get('revealed') || !poker.get('active')) return;

  const votes = (poker.get('votes') as Record<string, string>) || {};
  poker.set('votes', { ...votes, [peerId]: card });
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
  poker.set('votes', {});
  poker.set('topic', '');
}

export function getPokerState(doc: Y.Doc): PokerRound & { active: boolean } {
  const poker = getPoker(doc);

  return {
    topic: (poker.get('topic') as string) || '',
    cardSet: (poker.get('cardSet') as CardSet) || 'fibonacci',
    votes: (poker.get('votes') as Record<string, string>) || {},
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
