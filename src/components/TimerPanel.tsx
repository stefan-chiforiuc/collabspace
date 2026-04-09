import { Show } from 'solid-js';
import { TIMER_PRESETS } from '../lib/timer';
import type { TimerState } from '../lib/types';
import Button from './ui/Button';
import Card from './ui/Card';

interface TimerPanelProps {
  state: TimerState;
  remaining: number;
  formatted: string;
  expired: boolean;
  onStart: (durationMs: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDismiss: () => void;
}

export default function TimerPanel(props: TimerPanelProps) {
  const isRunning = () => props.state.mode === 'running';
  const isPaused = () => props.state.mode === 'paused';
  const isStopped = () => props.state.mode === 'stopped';
  const progress = () => {
    if (props.state.duration === 0) return 0;
    return Math.max(0, Math.min(100, (props.remaining / props.state.duration) * 100));
  };

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between p-4 border-b border-surface-700">
        <h2 class="text-sm font-semibold text-surface-200">Timer</h2>
        <Show when={!isStopped()}>
          <span class="text-xs text-surface-500">
            {isRunning() ? 'Running' : 'Paused'}
          </span>
        </Show>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Timer display */}
        <Card class="p-6 text-center space-y-4">
          {/* Countdown */}
          <div
            class={`text-5xl font-mono font-bold ${
              props.expired
                ? 'text-error animate-pulse'
                : props.remaining < 10000 && !isStopped()
                ? 'text-warning'
                : 'text-surface-100'
            }`}
          >
            {isStopped() && !props.expired ? '00:00' : props.formatted}
          </div>

          {/* Progress bar */}
          <Show when={!isStopped()}>
            <div class="h-1.5 bg-surface-700 rounded-full overflow-hidden">
              <div
                class={`h-full rounded-full transition-all duration-200 ${
                  props.expired ? 'bg-error' : props.remaining < 10000 ? 'bg-warning' : 'bg-primary-500'
                }`}
                style={{ width: `${progress()}%` }}
              />
            </div>
          </Show>

          {/* Expired alert */}
          <Show when={props.expired}>
            <div class="bg-error/10 border border-error/30 rounded-lg px-4 py-2">
              <p class="text-sm text-error font-medium">Time's up!</p>
            </div>
            <Button size="sm" variant="secondary" onClick={props.onDismiss}>
              Dismiss
            </Button>
          </Show>

          {/* Controls */}
          <div class="flex items-center justify-center gap-2">
            <Show when={isRunning()}>
              <Button size="sm" variant="secondary" onClick={props.onPause}>
                Pause
              </Button>
              <Button size="sm" variant="ghost" onClick={props.onStop}>
                Stop
              </Button>
            </Show>
            <Show when={isPaused()}>
              <Button size="sm" onClick={props.onResume}>
                Resume
              </Button>
              <Button size="sm" variant="ghost" onClick={props.onStop}>
                Stop
              </Button>
            </Show>
          </div>
        </Card>

        {/* Presets (when stopped) */}
        <Show when={isStopped() && !props.expired}>
          <Card class="p-4 space-y-3">
            <p class="text-xs text-surface-500 uppercase tracking-wide">Quick Start</p>
            <div class="grid grid-cols-3 gap-2">
              {TIMER_PRESETS.map((preset) => (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => props.onStart(preset.ms)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </Card>
        </Show>
      </div>
    </div>
  );
}
