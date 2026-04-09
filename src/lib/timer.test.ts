import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createYDoc } from './yjs-doc';
import { startTimer, pauseTimer, resumeTimer, stopTimer, getTimerState, getRemainingMs, formatTime } from './timer';

function makeDoc() {
  return createYDoc({
    roomCode: 'test-room-0000',
    roomName: 'Test Room',
    createdAt: Date.now(),
    settings: { maxParticipants: 6 },
  }, true);
}

describe('Timer', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = makeDoc();
  });

  it('starts a timer', () => {
    startTimer(doc, 60_000, 'peer1', 'Alice');
    const state = getTimerState(doc);
    expect(state.mode).toBe('running');
    expect(state.duration).toBe(60_000);
    expect(state.startedBy).toBe('peer1');
  });

  it('pauses a running timer', () => {
    startTimer(doc, 60_000, 'peer1', 'Alice');
    pauseTimer(doc);
    const state = getTimerState(doc);
    expect(state.mode).toBe('paused');
    expect(state.pausedRemaining).toBeGreaterThan(0);
    expect(state.pausedRemaining).toBeLessThanOrEqual(60_000);
  });

  it('resumes a paused timer', () => {
    startTimer(doc, 60_000, 'peer1', 'Alice');
    pauseTimer(doc);
    resumeTimer(doc);
    const state = getTimerState(doc);
    expect(state.mode).toBe('running');
  });

  it('stops a timer', () => {
    startTimer(doc, 60_000, 'peer1', 'Alice');
    stopTimer(doc);
    const state = getTimerState(doc);
    expect(state.mode).toBe('stopped');
  });

  it('computes remaining ms for a running timer', () => {
    startTimer(doc, 60_000, 'peer1', 'Alice');
    const remaining = getRemainingMs(getTimerState(doc));
    expect(remaining).toBeGreaterThan(59_000);
    expect(remaining).toBeLessThanOrEqual(60_000);
  });

  it('returns 0 remaining for stopped timer', () => {
    expect(getRemainingMs(getTimerState(doc))).toBe(0);
  });
});

describe('formatTime', () => {
  it('formats minutes and seconds', () => {
    expect(formatTime(90_000)).toBe('01:30');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(300_000)).toBe('05:00');
    expect(formatTime(59_999)).toBe('01:00');
    expect(formatTime(1_000)).toBe('00:01');
  });
});
