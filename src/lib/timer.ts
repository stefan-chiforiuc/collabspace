import * as Y from 'yjs';
import { getTimer } from './yjs-doc';
import type { TimerState, TimerMode } from './types';

export const TIMER_PRESETS = [
  { label: '1m', ms: 60_000 },
  { label: '2m', ms: 120_000 },
  { label: '5m', ms: 300_000 },
  { label: '10m', ms: 600_000 },
  { label: '15m', ms: 900_000 },
];

export function startTimer(
  doc: Y.Doc,
  durationMs: number,
  startedBy: string,
  startedByName: string,
): void {
  const timer = getTimer(doc);
  timer.set('duration', durationMs);
  timer.set('startedAt', Date.now());
  timer.set('pausedRemaining', 0);
  timer.set('mode', 'running');
  timer.set('startedBy', startedBy);
  timer.set('startedByName', startedByName);
}

export function pauseTimer(doc: Y.Doc): void {
  const timer = getTimer(doc);
  if (timer.get('mode') !== 'running') return;

  const startedAt = timer.get('startedAt') as number;
  const duration = timer.get('duration') as number;
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, duration - elapsed);

  timer.set('pausedRemaining', remaining);
  timer.set('mode', 'paused');
}

export function resumeTimer(doc: Y.Doc): void {
  const timer = getTimer(doc);
  if (timer.get('mode') !== 'paused') return;

  const remaining = timer.get('pausedRemaining') as number;
  timer.set('startedAt', Date.now());
  timer.set('duration', remaining);
  timer.set('pausedRemaining', 0);
  timer.set('mode', 'running');
}

export function stopTimer(doc: Y.Doc): void {
  const timer = getTimer(doc);
  timer.set('mode', 'stopped');
  timer.set('pausedRemaining', 0);
}

export function getTimerState(doc: Y.Doc): TimerState {
  const timer = getTimer(doc);
  return {
    duration: (timer.get('duration') as number) || 0,
    startedAt: (timer.get('startedAt') as number) || 0,
    pausedRemaining: (timer.get('pausedRemaining') as number) || 0,
    mode: (timer.get('mode') as TimerMode) || 'stopped',
    startedBy: (timer.get('startedBy') as string) || '',
    startedByName: (timer.get('startedByName') as string) || '',
  };
}

export function getRemainingMs(state: TimerState): number {
  if (state.mode === 'stopped') return 0;
  if (state.mode === 'paused') return state.pausedRemaining;

  const elapsed = Date.now() - state.startedAt;
  return Math.max(0, state.duration - elapsed);
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
