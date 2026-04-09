import { createSignal, onCleanup, Show, For } from 'solid-js';
import { useRoom } from '../hooks/useRoom';
import { usePolls } from '../hooks/usePolls';
import { usePoker } from '../hooks/usePoker';
import { useTimer } from '../hooks/useTimer';
import { useReactions } from '../hooks/useReactions';
import { useNotepad } from '../hooks/useNotepad';
import ParticipantList from './ParticipantList';
import ChatPanel from './ChatPanel';
import PollPanel from './PollPanel';
import PokerPanel from './PokerPanel';
import TimerPanel from './TimerPanel';
import NotepadPanel from './NotepadPanel';
import ReactionsBar from './ReactionsBar';
import Button from './ui/Button';

interface RoomViewProps {
  roomCode: string;
}

type Tab = 'chat' | 'polls' | 'poker' | 'timer' | 'notes';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'polls', label: 'Polls' },
  { id: 'poker', label: 'Poker' },
  { id: 'timer', label: 'Timer' },
  { id: 'notes', label: 'Notes' },
];

export default function RoomView(props: RoomViewProps) {
  const room = useRoom(props.roomCode);
  const polls = usePolls(room.doc, room.localPeerId(), room.localName);
  const poker = usePoker(room.doc, room.localPeerId(), room.localName);
  const timer = useTimer(room.doc, room.localPeerId(), room.localName);
  const reactions = useReactions(room.doc, room.awareness, room.localPeerId(), room.localName);

  // Find the local participant's color for cursor display
  const localColor = () => {
    const p = room.participants().find((p) => p.peerId === room.localPeerId());
    return p?.color || '#818cf8';
  };
  const notepad = useNotepad(room.doc, room.awareness, room.localName, localColor());

  const [activeTab, setActiveTab] = createSignal<Tab>('chat');

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
          {/* Compact timer in header when running */}
          <Show when={timer.state().mode !== 'stopped'}>
            <span
              class={`font-mono text-xs px-2 py-0.5 rounded ${
                timer.expired() ? 'bg-error/20 text-error animate-pulse' : 'bg-surface-700 text-surface-300'
              }`}
            >
              {timer.formatted()}
            </span>
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
        {/* Sidebar — participants */}
        <aside class="w-56 border-r border-surface-700 overflow-y-auto hidden md:block">
          <ParticipantList participants={room.participants()} />
        </aside>

        {/* Main panel */}
        <div class="flex-1 flex flex-col">
          {/* Tab bar */}
          <nav class="flex border-b border-surface-700 bg-surface-800/50">
            <For each={TABS}>
              {(tab) => (
                <button
                  onClick={() => setActiveTab(tab.id)}
                  class={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer relative
                    ${
                      activeTab() === tab.id
                        ? 'text-primary-400'
                        : 'text-surface-400 hover:text-surface-200'
                    }`}
                >
                  {tab.label}
                  <Show when={activeTab() === tab.id}>
                    <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                  </Show>
                </button>
              )}
            </For>
          </nav>

          {/* Tab content */}
          <div class="flex-1 flex flex-col overflow-hidden">
            <Show when={activeTab() === 'chat'}>
              <div class="flex-1 flex flex-col">
                <ChatPanel
                  messages={room.messages()}
                  onSend={room.sendMessage}
                  localPeerId={room.localPeerId()}
                />
              </div>
            </Show>

            <Show when={activeTab() === 'polls'}>
              <PollPanel
                polls={polls.polls()}
                localPeerId={room.localPeerId()}
                onCreatePoll={polls.createPoll}
                onVote={polls.vote}
                onClose={polls.close}
              />
            </Show>

            <Show when={activeTab() === 'poker'}>
              <PokerPanel
                state={poker.state()}
                participants={room.participants()}
                localPeerId={room.localPeerId()}
                hasVoted={poker.hasVoted()}
                myVote={poker.myVote()}
                onStartRound={poker.startRound}
                onVote={poker.vote}
                onReveal={poker.reveal}
                onReset={poker.reset}
              />
            </Show>

            <Show when={activeTab() === 'timer'}>
              <TimerPanel
                state={timer.state()}
                remaining={timer.remaining()}
                formatted={timer.formatted()}
                expired={timer.expired()}
                onStart={timer.start}
                onPause={timer.pause}
                onResume={timer.resume}
                onStop={timer.stop}
                onDismiss={timer.dismissExpired}
              />
            </Show>

            <Show when={activeTab() === 'notes'}>
              <NotepadPanel
                createEditor={notepad.createEditor}
                editor={notepad.editor()}
                onExportMarkdown={notepad.exportMarkdown}
                onExportText={notepad.exportText}
                onExportJSON={notepad.exportJSON}
              />
            </Show>
          </div>

          {/* Reactions bar — always visible */}
          <ReactionsBar
            recent={reactions.recent()}
            handsUp={reactions.handsUp()}
            handRaised={reactions.handRaised()}
            onReact={reactions.react}
            onToggleHand={reactions.toggleHand}
          />
        </div>
      </div>
    </div>
  );
}
