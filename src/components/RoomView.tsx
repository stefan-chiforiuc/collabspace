import { createSignal, onCleanup, Show, For } from 'solid-js';
import { useRoom } from '../hooks/useRoom';
import { usePolls } from '../hooks/usePolls';
import { usePoker } from '../hooks/usePoker';
import { useTimer } from '../hooks/useTimer';
import { useReactions } from '../hooks/useReactions';
import { useNotepad } from '../hooks/useNotepad';
import { useNotifications } from '../hooks/useNotifications';
import { useMedia } from '../hooks/useMedia';
import { hasRoomPassword, verifyRoomPassword } from '../lib/room-password';
import { saveConnectionSettings } from '../lib/connection-settings';
import { dispatchNotification } from '../lib/notifications';
import ParticipantList from './ParticipantList';
import ChatPanel from './ChatPanel';
import PollPanel from './PollPanel';
import PokerPanel from './PokerPanel';
import TimerPanel from './TimerPanel';
import NotepadPanel from './NotepadPanel';
import ReactionsBar from './ReactionsBar';
import PasswordGate from './PasswordGate';
import ConnectionStatusPanel from './ConnectionStatus';
import ConnectionSettingsPanel from './ConnectionSettingsPanel';
import SharePanel from './SharePanel';
import NotificationToast from './NotificationToast';
import MediaControls from './MediaControls';
import VideoGrid from './VideoGrid';
import Button from './ui/Button';
import Card from './ui/Card';

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
  const [passwordVerified, setPasswordVerified] = createSignal(props.isCreator);
  const [passwordError, setPasswordError] = createSignal('');
  const [checkingPassword, setCheckingPassword] = createSignal(!props.isCreator);

  const room = useRoom(props.roomCode, props.password, props.isCreator);
  const polls = usePolls(room.doc, room.localPeerId(), room.localName);
  const poker = usePoker(room.doc, room.localPeerId(), room.localName);
  const timer = useTimer(room.doc, room.localPeerId(), room.localName);

  const reactions = useReactions(room.doc, room.awareness, room.localPeerId(), room.localName);
  const localColor = () => {
    const p = room.participants().find((p) => p.peerId === room.localPeerId());
    return p?.color || '#818cf8';
  };
  const notepad = useNotepad(room.doc, room.awareness, room.localName, localColor());

  // Notification system
  const notifs = useNotifications(room.doc, room.localPeerId());

  // Media (audio/video)
  const media = useMedia(room.trysteroRoom, room.awareness, room.localPeerId());

  const [activeTab, setActiveTab] = createSignal<Tab>('chat');
  const [showParticipants, setShowParticipants] = createSignal(false);
  const [showConnectionStatus, setShowConnectionStatus] = createSignal(false);
  const [showConnectionSettings, setShowConnectionSettings] = createSignal(false);
  const [showSharePanel, setShowSharePanel] = createSignal(false);

  // Password gate for joiners
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

    checkPassword();
    meta.observe(checkPassword);

    const timeout = setTimeout(() => {
      if (!resolved) resolve(false);
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

  const handleLeave = () => {
    media.stopAllMedia();
    room.leave();
    window.location.hash = '/';
  };

  const handleSettingsApply = async (settings: Parameters<typeof saveConnectionSettings>[0]) => {
    setShowConnectionSettings(false);
    await room.reconnect(settings);
  };

  const handleNotificationAction = (notif: { type: string; targetTab?: string }) => {
    if (notif.type === 'media_started') {
      if (!media.audioEnabled()) media.toggleAudio();
    } else if (notif.targetTab) {
      setActiveTab(notif.targetTab as Tab);
    }
  };

  const handleToggleAudio = async () => {
    const wasEnabled = media.audioEnabled();
    await media.toggleAudio();
    if (!wasEnabled && media.audioEnabled()) {
      dispatchNotification(room.doc, 'media_started', room.localPeerId(), room.localName, `${room.localName} started audio`, undefined);
    }
  };

  const handleToggleVideo = async () => {
    const wasEnabled = media.videoEnabled();
    await media.toggleVideo();
    if (!wasEnabled && media.videoEnabled()) {
      dispatchNotification(room.doc, 'media_started', room.localPeerId(), room.localName, `${room.localName} started video`, undefined);
    }
  };

  return (
    <>
      {/* Password gate for joiners */}
      <Show when={checkingPassword()}>
        <div class="min-h-screen flex items-center justify-center p-4">
          <div class="text-surface-400 text-sm animate-pulse">Connecting to room...</div>
        </div>
      </Show>

      <Show when={!checkingPassword() && !passwordVerified()}>
        <PasswordGate
          roomCode={props.roomCode}
          onSubmit={handlePasswordSubmit}
          error={passwordError()}
        />
      </Show>

      {/* Connection failed — recovery screen */}
      <Show when={passwordVerified() && room.connectionState() === 'failed'}>
        <div class="min-h-screen flex items-center justify-center p-4">
          <Card class="w-full max-w-sm space-y-4 text-center">
            <div class="text-2xl">&#x26A0;&#xFE0F;</div>
            <h2 class="text-lg font-semibold text-surface-200">Could not connect to room</h2>
            <p class="text-surface-400 text-sm">
              Unable to establish a P2P connection. This may be caused by a firewall or network restriction.
            </p>
            <div class="space-y-2">
              <Button class="w-full" onClick={() => room.reconnect()}>
                Try Again
              </Button>
              <Button variant="secondary" class="w-full" onClick={() => setShowConnectionSettings(true)}>
                Connection Settings
              </Button>
              <Button variant="ghost" class="w-full" onClick={() => { window.location.hash = '/'; }}>
                Create New Room
              </Button>
            </div>
          </Card>

          {/* Settings panel overlay on failed screen */}
          <Show when={showConnectionSettings()}>
            <ConnectionSettingsPanel
              settings={room.connectionSettings()}
              onApply={handleSettingsApply}
              onClose={() => setShowConnectionSettings(false)}
              showReconnect
            />
          </Show>
        </div>
      </Show>

      {/* Main room view */}
      <Show when={passwordVerified() && room.connectionState() !== 'failed'}>
        <div class="h-screen flex flex-col relative">
          {/* Notification toasts */}
          <NotificationToast
            notifications={notifs.notifications()}
            onAction={handleNotificationAction}
            onDismiss={notifs.dismiss}
          />

          {/* Header */}
          <header class="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b border-surface-700 bg-surface-800/80 backdrop-blur-sm" role="banner">
            <div class="flex items-center gap-2 sm:gap-3 min-w-0">
              <span class="font-mono text-xs sm:text-sm text-primary-400 bg-surface-900 px-2 sm:px-3 py-1 rounded-lg truncate max-w-[120px] sm:max-w-none">
                {props.roomCode}
              </span>
              {/* Connection status indicator */}
              <button
                onClick={() => setShowConnectionStatus(!showConnectionStatus())}
                class="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-surface-700/50 transition-colors cursor-pointer"
                aria-label="Connection details"
              >
                <span class={`w-2 h-2 rounded-full shrink-0 ${room.isConnected() ? 'bg-success' : room.connectionState() === 'connecting' ? 'bg-warning animate-pulse' : 'bg-error'}`} role="status" />
                <span class="text-[10px] text-surface-500 hidden sm:inline">
                  {room.connectionStatus().mqtt.connected + room.connectionStatus().torrent.connected} relays
                </span>
              </button>
              {/* Settings gear */}
              <button
                onClick={() => setShowConnectionSettings(!showConnectionSettings())}
                class="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-700/50 transition-colors cursor-pointer text-surface-400 hover:text-surface-200"
                aria-label="Connection settings"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
                </svg>
              </button>
              {/* Mobile participants */}
              <button
                onClick={() => setShowParticipants(!showParticipants())}
                class="md:hidden flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-700/50 hover:bg-surface-700 transition-colors cursor-pointer"
                aria-label={`${room.participants().length} participants`}
              >
                <div class="flex -space-x-1">
                  <For each={room.participants().slice(0, 4)}>
                    {(p) => (
                      <span class="w-3 h-3 rounded-full border border-surface-800 shrink-0" style={{ "background-color": p.color }} />
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
              {/* Media controls (mic + camera) */}
              <MediaControls
                audioEnabled={media.audioEnabled()}
                videoEnabled={media.videoEnabled()}
                onToggleAudio={handleToggleAudio}
                onToggleVideo={handleToggleVideo}
              />
              {/* Compact timer */}
              <Show when={timer.state().mode !== 'stopped'}>
                <span class={`font-mono text-xs px-2 py-0.5 rounded hidden sm:inline ${timer.expired() ? 'bg-error/20 text-error animate-pulse' : 'bg-surface-700 text-surface-300'}`} role="timer">
                  {timer.formatted()}
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-1 sm:gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setShowSharePanel(!showSharePanel())} class="text-xs sm:text-sm">
                <span class="hidden sm:inline">Share</span>
                <span class="sm:hidden">
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                  </svg>
                </span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLeave} class="text-xs sm:text-sm">
                Leave
              </Button>
            </div>
          </header>

          {/* Connection status dropdown */}
          <Show when={showConnectionStatus()}>
            <ConnectionStatusPanel
              status={room.connectionStatus()}
              isConnected={room.isConnected()}
              autoReconnect={room.connectionSettings().autoReconnect}
              onRetry={() => room.retryFailedConnections()}
              onClose={() => setShowConnectionStatus(false)}
            />
          </Show>

          {/* Connection settings overlay */}
          <Show when={showConnectionSettings()}>
            <ConnectionSettingsPanel
              settings={room.connectionSettings()}
              onApply={handleSettingsApply}
              onClose={() => setShowConnectionSettings(false)}
              showReconnect
            />
          </Show>

          {/* Share panel dropdown */}
          <Show when={showSharePanel()}>
            <SharePanel
              roomCode={props.roomCode}
              onClose={() => setShowSharePanel(false)}
            />
          </Show>

          {/* Main content */}
          <div class="flex-1 flex overflow-hidden relative">
            {/* Desktop sidebar */}
            <aside class="w-56 border-r border-surface-700 overflow-y-auto hidden md:block" role="complementary" aria-label="Participants">
              <ParticipantList participants={room.participants()} />
            </aside>

            {/* Mobile participants drawer */}
            <Show when={showParticipants()}>
              <div class="md:hidden absolute inset-0 z-20 flex animate-fade-in">
                <div class="w-72 bg-surface-800/95 backdrop-blur-sm border-r border-surface-700 overflow-y-auto shadow-2xl animate-slide-in-left" role="dialog" aria-label="Participants">
                  <div class="flex items-center justify-between p-3 border-b border-surface-700">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-surface-200">Participants</span>
                      <span class="text-xs text-surface-500 bg-surface-700 px-1.5 py-0.5 rounded">{room.participants().length}/6</span>
                    </div>
                    <button onClick={() => setShowParticipants(false)} class="w-8 h-8 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 cursor-pointer transition-colors" aria-label="Close">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </button>
                  </div>
                  <ParticipantList participants={room.participants()} />
                </div>
                <div class="flex-1 bg-black/50 backdrop-blur-[2px]" onClick={() => setShowParticipants(false)} />
              </div>
            </Show>

            {/* Main panel */}
            <div class="flex-1 flex flex-col min-w-0">
              {/* Video grid (shown when anyone has media active) */}
              <Show when={media.anyVideoActive()}>
                <VideoGrid
                  localStream={media.localStream()}
                  remoteStreams={media.remoteStreams()}
                  participants={room.participants()}
                  localPeerId={room.localPeerId()}
                  audioEnabled={media.audioEnabled()}
                  videoEnabled={media.videoEnabled()}
                  peerMediaState={media.peerMediaState()}
                />
              </Show>

              {/* Audio-only strip (shown when audio active but no video) */}
              <Show when={media.anyMediaActive() && !media.anyVideoActive()}>
                <div class="flex items-center gap-2 px-3 py-1.5 border-b border-surface-700 bg-surface-800/50 text-xs text-surface-400">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" class="text-success shrink-0">
                    <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"/>
                  </svg>
                  <span>Audio call active</span>
                </div>
              </Show>

              <nav class="flex border-b border-surface-700 bg-surface-800/50 overflow-x-auto" role="tablist" aria-label="Room features">
                <For each={TABS}>
                  {(tab) => (
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      role="tab"
                      aria-selected={activeTab() === tab.id}
                      aria-controls={`panel-${tab.id}`}
                      class={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer relative whitespace-nowrap shrink-0 ${activeTab() === tab.id ? 'text-primary-400' : 'text-surface-400 hover:text-surface-200'}`}
                    >
                      {tab.label}
                      <Show when={activeTab() === tab.id}>
                        <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500" />
                      </Show>
                    </button>
                  )}
                </For>
              </nav>

              <div class="flex-1 flex flex-col overflow-hidden">
                <Show when={activeTab() === 'chat'}>
                  <div class="flex-1 flex flex-col" id="panel-chat" role="tabpanel">
                    <ChatPanel messages={room.messages()} onSend={room.sendMessage} localPeerId={room.localPeerId()} />
                  </div>
                </Show>
                <Show when={activeTab() === 'polls'}>
                  <div class="flex-1 flex flex-col overflow-hidden" id="panel-polls" role="tabpanel">
                    <PollPanel polls={polls.polls()} localPeerId={room.localPeerId()} onCreatePoll={polls.createPoll} onVote={polls.vote} onClose={polls.close} />
                  </div>
                </Show>
                <Show when={activeTab() === 'poker'}>
                  <div class="flex-1 flex flex-col overflow-hidden" id="panel-poker" role="tabpanel">
                    <PokerPanel state={poker.state()} participants={room.participants()} localPeerId={room.localPeerId()} hasVoted={poker.hasVoted()} myVote={poker.myVote()} onStartRound={poker.startRound} onVote={poker.vote} onReveal={poker.reveal} onReset={poker.reset} />
                  </div>
                </Show>
                <Show when={activeTab() === 'timer'}>
                  <div class="flex-1 flex flex-col overflow-hidden" id="panel-timer" role="tabpanel">
                    <TimerPanel state={timer.state()} remaining={timer.remaining()} formatted={timer.formatted()} expired={timer.expired()} onStart={timer.start} onPause={timer.pause} onResume={timer.resume} onStop={timer.stop} onDismiss={timer.dismissExpired} />
                  </div>
                </Show>
                <Show when={activeTab() === 'notes'}>
                  <div class="flex-1 flex flex-col overflow-hidden" id="panel-notes" role="tabpanel">
                    <NotepadPanel createEditor={notepad.createEditor} editor={notepad.editor()} onExportMarkdown={notepad.exportMarkdown} onExportText={notepad.exportText} onExportJSON={notepad.exportJSON} />
                  </div>
                </Show>
              </div>

              <ReactionsBar recent={reactions.recent()} handsUp={reactions.handsUp()} handRaised={reactions.handRaised()} onReact={reactions.react} onToggleHand={reactions.toggleHand} />
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
