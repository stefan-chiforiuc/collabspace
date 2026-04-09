import { createSignal, Show, For } from 'solid-js';
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
  password?: string;
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
  const room = useRoom(props.roomCode, props.password);
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
  const [showParticipants, setShowParticipants] = createSignal(false);

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
      <header class="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-surface-700 bg-surface-800/80 backdrop-blur-sm" role="banner">
        <div class="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile participants toggle */}
          <button
            onClick={() => setShowParticipants(!showParticipants())}
            class="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-700 transition-colors cursor-pointer text-surface-400"
            aria-label={`${room.participants().length} participants`}
            aria-expanded={showParticipants()}
          >
            <span class="text-xs font-semibold">{room.participants().length}</span>
          </button>
          <span class="font-mono text-xs sm:text-sm text-primary-400 bg-surface-900 px-2 sm:px-3 py-1 rounded-lg truncate max-w-[140px] sm:max-w-none">
            {props.roomCode}
          </span>
          <Show when={room.isConnected()}>
            <span class="w-2 h-2 rounded-full bg-success shrink-0" aria-label="Connected" role="status" />
          </Show>
          <Show when={!room.isConnected()}>
            <span class="w-2 h-2 rounded-full bg-warning animate-pulse shrink-0" aria-label="Reconnecting" role="status" />
          </Show>
          {/* Compact timer in header when running */}
          <Show when={timer.state().mode !== 'stopped'}>
            <span
              class={`font-mono text-xs px-2 py-0.5 rounded hidden sm:inline ${
                timer.expired() ? 'bg-error/20 text-error animate-pulse' : 'bg-surface-700 text-surface-300'
              }`}
              role="timer"
              aria-label={`Timer: ${timer.formatted()}`}
            >
              {timer.formatted()}
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1 sm:gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={handleCopyLink} class="text-xs sm:text-sm">
            <span class="hidden sm:inline">Copy Link</span>
            <span class="sm:hidden">Copy</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLeave} class="text-xs sm:text-sm">
            Leave
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div class="flex-1 flex overflow-hidden relative">
        {/* Sidebar — participants (desktop) */}
        <aside class="w-56 border-r border-surface-700 overflow-y-auto hidden md:block" role="complementary" aria-label="Participants">
          <ParticipantList participants={room.participants()} />
        </aside>

        {/* Mobile participants drawer */}
        <Show when={showParticipants()}>
          <div class="md:hidden absolute inset-0 z-20 flex">
            <div class="w-64 bg-surface-800 border-r border-surface-700 overflow-y-auto shadow-xl" role="dialog" aria-label="Participants">
              <div class="flex items-center justify-between p-3 border-b border-surface-700">
                <span class="text-sm font-semibold text-surface-200">Participants</span>
                <button
                  onClick={() => setShowParticipants(false)}
                  class="w-7 h-7 flex items-center justify-center rounded text-surface-400 hover:text-surface-200 hover:bg-surface-700 cursor-pointer"
                  aria-label="Close participants"
                >
                  x
                </button>
              </div>
              <ParticipantList participants={room.participants()} />
            </div>
            <div
              class="flex-1 bg-black/40"
              onClick={() => setShowParticipants(false)}
            />
          </div>
        </Show>

        {/* Main panel */}
        <div class="flex-1 flex flex-col min-w-0">
          {/* Tab bar — scrollable on mobile */}
          <nav class="flex border-b border-surface-700 bg-surface-800/50 overflow-x-auto" role="tablist" aria-label="Room features">
            <For each={TABS}>
              {(tab) => (
                <button
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab() === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  class={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer relative whitespace-nowrap shrink-0
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
              <div class="flex-1 flex flex-col" id="panel-chat" role="tabpanel">
                <ChatPanel
                  messages={room.messages()}
                  onSend={room.sendMessage}
                  localPeerId={room.localPeerId()}
                />
              </div>
            </Show>

            <Show when={activeTab() === 'polls'}>
              <div class="flex-1 flex flex-col overflow-hidden" id="panel-polls" role="tabpanel">
                <PollPanel
                  polls={polls.polls()}
                  localPeerId={room.localPeerId()}
                  onCreatePoll={polls.createPoll}
                  onVote={polls.vote}
                  onClose={polls.close}
                />
              </div>
            </Show>

            <Show when={activeTab() === 'poker'}>
              <div class="flex-1 flex flex-col overflow-hidden" id="panel-poker" role="tabpanel">
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
              </div>
            </Show>

            <Show when={activeTab() === 'timer'}>
              <div class="flex-1 flex flex-col overflow-hidden" id="panel-timer" role="tabpanel">
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
              </div>
            </Show>

            <Show when={activeTab() === 'notes'}>
              <div class="flex-1 flex flex-col overflow-hidden" id="panel-notes" role="tabpanel">
                <NotepadPanel
                  createEditor={notepad.createEditor}
                  editor={notepad.editor()}
                  onExportMarkdown={notepad.exportMarkdown}
                  onExportText={notepad.exportText}
                  onExportJSON={notepad.exportJSON}
                />
              </div>
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
