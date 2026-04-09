import { For, Show } from 'solid-js';
import { QUICK_EMOJIS } from '../lib/reactions';
import type { Reaction } from '../lib/types';

interface ReactionsBarProps {
  recent: Reaction[];
  handsUp: { peerId: string; name: string }[];
  handRaised: boolean;
  onReact: (emoji: string) => void;
  onToggleHand: () => void;
}

export default function ReactionsBar(props: ReactionsBarProps) {
  return (
    <div class="border-t border-surface-700 bg-surface-800/80 backdrop-blur-sm">
      {/* Floating reactions */}
      <Show when={props.recent.length > 0}>
        <div class="flex items-center gap-1 px-3 py-1 overflow-hidden">
          <For each={props.recent}>
            {(r) => (
              <span
                class="text-lg animate-bounce"
                title={r.peerName}
              >
                {r.emoji}
              </span>
            )}
          </For>
        </div>
      </Show>

      {/* Raised hands */}
      <Show when={props.handsUp.length > 0}>
        <div class="flex items-center gap-2 px-3 py-1 text-xs text-warning">
          <span class="text-base">{'\u270b'}</span>
          <For each={props.handsUp}>
            {(h, i) => (
              <span>
                {h.name}{i() < props.handsUp.length - 1 ? ', ' : ''}
              </span>
            )}
          </For>
        </div>
      </Show>

      {/* Emoji bar + raise hand toggle */}
      <div class="flex items-center gap-1 px-3 py-2">
        <For each={QUICK_EMOJIS}>
          {(emoji) => (
            <button
              onClick={() => props.onReact(emoji)}
              class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-700 transition-colors text-base cursor-pointer"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          )}
        </For>
        <div class="w-px h-6 bg-surface-700 mx-1" />
        <button
          onClick={props.onToggleHand}
          class={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-base cursor-pointer ${
            props.handRaised
              ? 'bg-warning/20 ring-1 ring-warning'
              : 'hover:bg-surface-700'
          }`}
          title={props.handRaised ? 'Lower hand' : 'Raise hand'}
        >
          {'\u270b'}
        </button>
      </div>
    </div>
  );
}
