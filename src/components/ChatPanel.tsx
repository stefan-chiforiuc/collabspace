import { createSignal, For, createEffect, onMount } from 'solid-js';
import type { ChatMessage } from '../lib/types';
import ChatMessageComponent from './ChatMessage';
import Button from './ui/Button';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  localPeerId: string;
}

export default function ChatPanel(props: ChatPanelProps) {
  const [text, setText] = createSignal('');
  let listRef: HTMLDivElement | undefined;

  // Auto-scroll to bottom on new messages
  createEffect(() => {
    const _ = props.messages.length;
    if (listRef) {
      requestAnimationFrame(() => {
        listRef!.scrollTop = listRef!.scrollHeight;
      });
    }
  });

  const handleSend = () => {
    const msg = text().trim();
    if (!msg) return;
    props.onSend(msg);
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Messages */}
      <div ref={listRef} class="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite">
        {props.messages.length === 0 && (
          <p class="text-center text-surface-500 text-sm mt-8">
            No messages yet. Start the conversation!
          </p>
        )}
        <For each={props.messages}>
          {(msg) => (
            <ChatMessageComponent
              message={msg}
              isLocal={msg.author === props.localPeerId}
            />
          )}
        </For>
      </div>

      {/* Input */}
      <div class="border-t border-surface-700 p-3 flex gap-2">
        <input
          type="text"
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          class="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-4 py-2 text-surface-100
            placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500
            focus:border-transparent text-sm"
        />
        <Button onClick={handleSend} disabled={!text().trim()} size="md">
          Send
        </Button>
      </div>
    </div>
  );
}
