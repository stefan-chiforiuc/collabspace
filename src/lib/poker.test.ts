import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createYDoc } from './yjs-doc';
import { startPokerRound, submitVote, revealVotes, resetPoker, getPokerState, calculatePokerResults } from './poker';

function makeDoc() {
  return createYDoc({
    roomCode: 'test-room-0000',
    roomName: 'Test Room',
    createdAt: Date.now(),
    settings: { maxParticipants: 6 },
  });
}

describe('Planning Poker', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = makeDoc();
  });

  it('starts a round with correct state', () => {
    startPokerRound(doc, 'Estimate login', 'fibonacci', 'peer1', 'Alice');
    const state = getPokerState(doc);
    expect(state.active).toBe(true);
    expect(state.topic).toBe('Estimate login');
    expect(state.cardSet).toBe('fibonacci');
    expect(state.revealed).toBe(false);
    expect(state.round).toBe(1);
    expect(state.votes).toEqual({});
  });

  it('accepts votes when not revealed', () => {
    startPokerRound(doc, 'Topic', 'fibonacci', 'peer1', 'Alice');
    submitVote(doc, 'peer1', '5');
    submitVote(doc, 'peer2', '8');
    const state = getPokerState(doc);
    expect(state.votes).toEqual({ peer1: '5', peer2: '8' });
  });

  it('blocks votes after reveal', () => {
    startPokerRound(doc, 'Topic', 'fibonacci', 'peer1', 'Alice');
    submitVote(doc, 'peer1', '5');
    revealVotes(doc);
    submitVote(doc, 'peer2', '8');
    const state = getPokerState(doc);
    expect(state.revealed).toBe(true);
    expect(state.votes).toEqual({ peer1: '5' });
  });

  it('resets the round', () => {
    startPokerRound(doc, 'Topic', 'fibonacci', 'peer1', 'Alice');
    submitVote(doc, 'peer1', '5');
    resetPoker(doc);
    const state = getPokerState(doc);
    expect(state.active).toBe(false);
    expect(state.votes).toEqual({});
  });

  it('increments round number', () => {
    startPokerRound(doc, 'Round 1', 'fibonacci', 'peer1', 'Alice');
    expect(getPokerState(doc).round).toBe(1);
    resetPoker(doc);
    startPokerRound(doc, 'Round 2', 'fibonacci', 'peer1', 'Alice');
    expect(getPokerState(doc).round).toBe(2);
  });

  it('calculates results with consensus', () => {
    const result = calculatePokerResults({ peer1: '5', peer2: '5', peer3: '5' });
    expect(result.average).toBe(5);
    expect(result.consensus).toBe(true);
    expect(result.distribution).toEqual({ '5': 3 });
  });

  it('calculates results without consensus', () => {
    const result = calculatePokerResults({ peer1: '3', peer2: '8', peer3: '5' });
    expect(result.average).toBeCloseTo(5.3, 0);
    expect(result.consensus).toBe(false);
  });

  it('excludes non-numeric votes from average', () => {
    const result = calculatePokerResults({ peer1: '5', peer2: '?', peer3: '\u2615' });
    expect(result.average).toBe(5);
  });
});
