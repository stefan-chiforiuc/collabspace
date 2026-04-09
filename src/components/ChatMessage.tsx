import { Show } from 'solid-js';
import type { ChatMessage } from '../lib/types';

interface ChatMessageProps {
  message: ChatMessage;
  isLocal: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessageComponent(props: ChatMessageProps) {
  return (
    <Show
      when={props.message.type === 'user'}
      fallback={
        <div class="text-center text-xs text-surface-500 italic py-1">
          {props.message.text}
        </div>
      }
    >
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-2">
          <span
            class="text-xs font-semibold"
            style={{ color: props.isLocal ? '#818cf8' : undefined }}
          >
            {props.message.authorName}
            {props.isLocal && ' (you)'}
          </span>
          <span class="text-xs text-surface-500">
            {formatTime(props.message.timestamp)}
          </span>
        </div>
        <p class="text-sm text-surface-200 break-words">
          {props.message.text}
        </p>
      </div>
    </Show>
  );
}
