import { onCleanup, Show } from 'solid-js';
import { useRoom } from '../hooks/useRoom';
import ParticipantList from './ParticipantList';
import ChatPanel from './ChatPanel';
import Button from './ui/Button';

interface RoomViewProps {
  roomCode: string;
}

export default function RoomView(props: RoomViewProps) {
  const room = useRoom(props.roomCode);

  onCleanup(() => room.leave());

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/room/${props.roomCode}`;
    await navigator.clipboard.writeText(url);
  };

  const handleLeave = () => {
    room.leave();
    window.location.hash = '/';
  };

  return (
    <div class="h-screen flex flex-col">
      {/* Header */}
      <header class="flex items-center justify-between px-4 py-3 border-b border-surface-700 bg-surface-800/80 backdrop-blur-sm">
        <div class="flex items-center gap-3">
          <span class="font-mono text-sm text-primary-400 bg-surface-900 px-3 py-1 rounded-lg">
            {props.roomCode}
          </span>
          <Show when={room.isConnected()}>
            <span class="w-2 h-2 rounded-full bg-success" />
          </Show>
          <Show when={!room.isConnected()}>
            <span class="w-2 h-2 rounded-full bg-warning animate-pulse" />
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopyLink}>
            Copy Link
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLeave}>
            Leave
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div class="flex-1 flex overflow-hidden">
        <aside class="w-56 border-r border-surface-700 overflow-y-auto hidden md:block">
          <ParticipantList participants={room.participants()} />
        </aside>
        <main class="flex-1 flex flex-col">
          <ChatPanel
            messages={room.messages()}
            onSend={room.sendMessage}
            localPeerId={room.localPeerId()}
          />
        </main>
      </div>
    </div>
  );
}
