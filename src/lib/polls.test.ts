import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createYDoc } from './yjs-doc';
import { createPoll, votePoll, closePoll, getPollList, getPollResults } from './polls';
import type { Poll } from './types';

function makeDoc() {
  return createYDoc({
    roomCode: 'test-room-0000',
    roomName: 'Test Room',
    createdAt: Date.now(),
    settings: { maxParticipants: 6 },
  }, true);
}

describe('Polls', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = makeDoc();
  });

  it('creates a poll with correct structure', () => {
    const id = createPoll(doc, 'Best framework?', ['SolidJS', 'Svelte', 'React'], 'single', 'peer1', 'Alice');
    const polls = getPollList(doc);
    expect(polls).toHaveLength(1);
    expect(polls[0].id).toBe(id);
    expect(polls[0].question).toBe('Best framework?');
    expect(polls[0].options).toEqual(['SolidJS', 'Svelte', 'React']);
    expect(polls[0].type).toBe('single');
    expect(polls[0].closed).toBe(false);
    expect(polls[0].votes).toEqual({});
  });

  it('allows voting on a poll (single choice)', () => {
    const id = createPoll(doc, 'Pick one', ['A', 'B'], 'single', 'peer1', 'Alice');
    votePoll(doc, id, 'peer2', 1);
    const polls = getPollList(doc);
    expect(polls[0].votes).toEqual({ peer2: 1 });
  });

  it('allows voting on a poll (multi choice)', () => {
    const id = createPoll(doc, 'Pick many', ['A', 'B', 'C'], 'multi', 'peer1', 'Alice');
    votePoll(doc, id, 'peer2', [0, 2]);
    const polls = getPollList(doc);
    expect(polls[0].votes).toEqual({ peer2: [0, 2] });
  });

  it('prevents voting on a closed poll', () => {
    const id = createPoll(doc, 'Closed', ['A', 'B'], 'single', 'peer1', 'Alice');
    closePoll(doc, id, 'peer1');
    votePoll(doc, id, 'peer2', 0);
    const polls = getPollList(doc);
    expect(polls[0].votes).toEqual({});
    expect(polls[0].closed).toBe(true);
  });

  it('calculates poll results correctly', () => {
    const id = createPoll(doc, 'Test', ['A', 'B', 'C'], 'single', 'peer1', 'Alice');
    votePoll(doc, id, 'peer1', 0);
    votePoll(doc, id, 'peer2', 0);
    votePoll(doc, id, 'peer3', 2);
    const polls = getPollList(doc);
    const results = getPollResults(polls[0]);
    expect(results[0]).toEqual({ option: 'A', count: 2, percentage: 67 });
    expect(results[1]).toEqual({ option: 'B', count: 0, percentage: 0 });
    expect(results[2]).toEqual({ option: 'C', count: 1, percentage: 33 });
  });

  it('returns multiple polls', () => {
    createPoll(doc, 'First', ['A', 'B'], 'single', 'peer1', 'Alice');
    createPoll(doc, 'Second', ['C', 'D'], 'single', 'peer1', 'Alice');
    const polls = getPollList(doc);
    expect(polls).toHaveLength(2);
    const questions = polls.map((p) => p.question);
    expect(questions).toContain('First');
    expect(questions).toContain('Second');
  });
});
