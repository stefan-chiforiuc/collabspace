import { createSignal, Show } from 'solid-js';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import ConnectionSettingsPanel from './ConnectionSettingsPanel';
import { getDisplayName, setDisplayName } from '../lib/storage';
import { getConnectionSettings, saveConnectionSettings } from '../lib/connection-settings';
import { encodeTurnServers } from '../lib/turn-encoding';
import type { ConnectionSettings } from '../lib/connection-settings';
import type { TurnServerConfig } from '../lib/turn-config';

interface LobbyProps {
  roomCode: string;
  sharedTurn?: TurnServerConfig[];
}

export default function Lobby(props: LobbyProps) {
  const [name, setName] = createSignal(getDisplayName() ?? '');
  const [password, setPassword] = createSignal('');
  const [showSettings, setShowSettings] = createSignal(false);
  const [settings, setSettings] = createSignal<ConnectionSettings>(getConnectionSettings());

  const canJoin = () => !!name().trim() && !!password().trim();

  const handleJoin = () => {
    if (!canJoin()) return;
    setDisplayName(name().trim());
    const encoded = btoa(password().trim());
    let hash = `/room/${props.roomCode}?pw=${encoded}`;
    if (props.sharedTurn && props.sharedTurn.length > 0) {
      hash += `&turn=${encodeTurnServers(props.sharedTurn)}`;
    }
    window.location.hash = hash;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleJoin();
  };

  const handleSettingsApply = (newSettings: ConnectionSettings) => {
    saveConnectionSettings(newSettings);
    setSettings(newSettings);
    setShowSettings(false);
  };

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <Card class="w-full max-w-md space-y-6">
        <div class="text-center space-y-2">
          <h1 class="text-3xl font-bold bg-gradient-to-r from-primary-400 to-primary-200 bg-clip-text text-transparent">
            CollabSpace
          </h1>
          <p class="text-surface-400 text-sm">
            Joining room{' '}
            <span class="font-mono text-primary-400">{props.roomCode}</span>
          </p>
        </div>

        <Input
          label="Your name"
          placeholder="Enter your display name"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          maxLength={30}
          autofocus
        />

        <Input
          label="Room password"
          placeholder="Enter room password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          maxLength={64}
        />

        <button
          onClick={() => setShowSettings(!showSettings())}
          class="text-xs text-surface-500 hover:text-surface-300 cursor-pointer w-full text-center"
        >
          {showSettings() ? 'Hide connection settings' : 'Connection settings...'}
        </button>

        <Show when={showSettings()}>
          <ConnectionSettingsPanel
            settings={settings()}
            onApply={handleSettingsApply}
            onClose={() => setShowSettings(false)}
            showReconnect={false}
          />
        </Show>

        <div class="flex gap-2">
          <Button
            variant="secondary"
            class="flex-1"
            onClick={() => { window.location.hash = '/'; }}
          >
            Back
          </Button>
          <Button
            class="flex-1"
            onClick={handleJoin}
            disabled={!canJoin()}
          >
            Join Room
          </Button>
        </div>
      </Card>
    </div>
  );
}
