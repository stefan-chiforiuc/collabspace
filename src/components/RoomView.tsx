import { createSignal, onCleanup, Show, For } from 'solid-js';
import { useRoom } from '../hooks/useRoom';
import { usePolls } from '../hooks/usePolls';
import { usePoker } from '../hooks/usePoker';
import { useTimer } from '../hooks/useTimer';
import { useReactions } from '../hooks/useReactions';
import { useNotepad } from '../hooks/useNotepad';
import { hasRoomPassword, verifyRoomPassword } from '../lib/room-password';
import ParticipantList from './ParticipantList';
import ChatPanel from './ChatPanel';
import PollPanel from './PollPanel';
import PokerPanel from './PokerPanel';
import TimerPanel from './TimerPanel';
import NotepadPanel from './NotepadPanel';
import ReactionsBar from './ReactionsBar';
import PasswordGate from './PasswordGate';
import ConnectionStatusPanel from './ConnectionStatus';
import Button from './ui/Button';

interface RoomViewProps {
  roomCode: string;
  password?: string;
  isCreator: boolean;
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
  // Creators skip the password gate entirely
  const [passwordVerified, setPasswordVerified] = createSignal(props.isCreator);
  const [passwordError, setPasswordError] = createSignal('');
  const [checkingPassword, setCheckingPassword] = createSignal(!props.isCreator);

  const room = useRoom(props.roomCode, props.password, props.isCreator);
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
  const [showConnectionStatus, setShowConnectionStatus] = createSignal(false);

  // For joiners: watch the Yjs doc meta for a password hash.
  // Once the doc syncs and we can see whether a password is set, either:
  // - Show password gate if room is protected
  // - Auto-verify if room has no password
  if (!props.isCreator) {
    const meta = room.doc.getMap('meta');
    let resolved = false;

    const resolve = (hasPassword: boolean) => {
      if (resolved) return;
      resolved = true;
      setCheckingPassword(false);
      setPasswordVerified(!hasPassword);
    };

    const checkPassword = () => {
      if (hasRoomPassword(room.doc)) {
        resolve(true);
      } else if (meta.get('roomCode')) {
        resolve(false);
      }
    };

    // Check immediately and also observe changes (for when sync completes)
    checkPassword();
    meta.observe(checkPassword);

    // Timeout fallback: if P2P sync is slow (mobile, poor connection),
    // assume no password after 10 seconds and let the joiner in
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolve(false);
      }
    }, 10_000);
    onCleanup(() => clearTimeout(timeout));
  }

  const handlePasswordSubmit = async (attempt: string) => {
    const valid = await verifyRoomPassword(room.doc, attempt);
    if (valid) {
      setPasswordVerified(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/room/${props.roomCode}`;
    await navigator.clipboard.writeText(url);
  };

  const handleLeave = () => {
    room.leave();
    window.location.hash = '/';
  };

  return (
    <>
      {/* Password gate for joiners */}
      <Show when={checkingPassword()}>
        <div class="min-h-screen flex items-center justify-center p-4">
          <div class="text-surface-400 text-sm">Connecting to room...</div>
        </div>
      </Show>

      <Show when={!checkingPassword() && !passwordVerified()}>
        <PasswordGate
          roomCode={props.roomCode}
          onSubmit={handlePasswordSubmit}
          error={passwordError()}
        />
      </Show>

      {/* Main room view — only shown after password verification */}
      <Show when={passwordVerified()}>
        <div class="h-screen flex flex-col relative">
          {/* Header */}
          <header class="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-surface-700 bg-surface-800/80 backdrop-blur-sm" role="banner">
            <div class="flex items-center gap-2 sm:gap-3 min-w-0">
              <span class="font-mono text-xs sm:text-sm text-primary-400 bg-surface-900 px-2 sm:px-3 py-1 rounded-lg truncate max-w-[120px] sm:max-w-none">
                {props.roomCode}
              </span>
              {/* Connection status indicator — tap to see details */}
              <button
                onClick={() => setShowConnectionStatus(!showConnectionStatus())}
                class="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-surface-700/50 transition-colors cursor-pointer"
                aria-label={`Connection: ${room.isConnected() ? 'connected' : 'connecting'} — tap for details`}
              >
                <span class={`w-2 h-2 rounded-full shrink-0 ${room.isConnected() ? 'bg-success' : 'bg-warning animate-pulse'}`} role="status" />
                <span class="text-[10px] text-surface-500 hidden sm:inline">
                  {room.connectionStatus().mqtt.connected + room.connectionStatus().torrent.connected} relays
                </span>
              </button>
              {/* Mobile participants — colored dots + toggle */}
              <button
                onClick={() => setShowParticipants(!showParticipants())}
                class="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-700/50 hover:bg-surface-700 transition-colors cursor-pointer"
                aria-label={`${room.participants().length} participants — tap to show`}
                aria-expanded={showParticipants()}
              >
                <div class="flex -space-x-1">
                  <For each={room.participants().slice(0, 4)}>
                    {(p) => (
                      <span
                        class="w-3 h-3 rounded-full border border-surface-800 shrink-0"
                        style={{ "background-color": p.color }}
                        title={p.name}
                      />
                    )}
                  </For>
                  <Show when={room.participants().length > 4}>
                    <span class="w-3 h-3 rounded-full bg-surface-600 border border-surface-800 flex items-center justify-center shrink-0">
                      <span class="text-[7px] text-surface-300">+{room.participants().length - 4}</span>
                    </span>
                  </Show>
                </div>
                <span class="text-[10px] text-surface-400 ml-0.5">{room.participants().length}</span>
              </button>
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

          {/* Connection status panel — dropdown */}
          <Show when={showConnectionStatus()}>
            <ConnectionStatusPanel
              status={room.connectionStatus()}
              isConnected={room.isConnected()}
              onClose={() => setShowConnectionStatus(false)}
            />
          </Show>

          {/* Main content */}
          <div class="flex-1 flex overflow-hidden relative">
            {/* Sidebar — participants (desktop) */}
            <aside class="w-56 border-r border-surface-700 overflow-y-auto hidden md:block" role="complementary" aria-label="Participants">
              <ParticipantList participants={room.participants()} />
            </aside>

            {/* Mobile participants drawer — slides in from left */}
            <Show when={showParticipants()}>
              <div class="md:hidden absolute inset-0 z-20 flex animate-fade-in">
                <div class="w-72 bg-surface-800/95 backdrop-blur-sm border-r border-surface-700 overflow-y-auto shadow-2xl animate-slide-in-left" role="dialog" aria-label="Participants">
                  <div class="flex items-center justify-between p-3 border-b border-surface-700">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-surface-200">Participants</span>
                      <span class="text-xs text-surface-500 bg-surface-700 px-1.5 py-0.5 rounded">
                        {room.participants().length}/{6}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowParticipants(false)}
                      class="w-8 h-8 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 cursor-pointer transition-colors"
                      aria-label="Close participants"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      </svg>
                    </button>
                  </div>
                  <ParticipantList participants={room.participants()} />
                </div>
                <div
                  class="flex-1 bg-black/50 backdrop-blur-[2px]"
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
      </Show>
    </>
  );
}
