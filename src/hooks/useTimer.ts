import { createSignal, onCleanup } from 'solid-js';
import * as Y from 'yjs';
import { getTimer } from '../lib/yjs-doc';
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getTimerState,
  getRemainingMs,
  formatTime,
} from '../lib/timer';
import { dispatchNotification } from '../lib/notifications';
import type { TimerState } from '../lib/types';

export function useTimer(doc: Y.Doc, localPeerId: string, localName: string) {
  const [state, setState] = createSignal<TimerState>(getTimerState(doc));
  const [remaining, setRemaining] = createSignal(0);
  const [expired, setExpired] = createSignal(false);

  const timerMap = getTimer(doc);

  const update = () => {
    const s = getTimerState(doc);
    setState(s);
    setRemaining(getRemainingMs(s));
    if (s.mode === 'running' && getRemainingMs(s) <= 0) {
      setExpired(true);
    }
  };

  timerMap.observe(update);
  update();

  // Tick every 100ms for smooth countdown
  const interval = setInterval(() => {
    const s = state();
    if (s.mode === 'running') {
      const r = getRemainingMs(s);
      setRemaining(r);
      if (r <= 0 && !expired()) {
        setExpired(true);
      }
    }
  }, 100);

  onCleanup(() => {
    timerMap.unobserve(update);
    clearInterval(interval);
  });

  return {
    state,
    remaining,
    expired,
    formatted: () => formatTime(remaining()),
    start: (durationMs: number) => {
      setExpired(false);
      startTimer(doc, durationMs, localPeerId, localName);
      dispatchNotification(doc, 'timer_started', localPeerId, localName, `${localName} started a timer`, 'timer');
    },
    pause: () => pauseTimer(doc),
    resume: () => resumeTimer(doc),
    stop: () => {
      setExpired(false);
      stopTimer(doc);
    },
    dismissExpired: () => setExpired(false),
  };
}
