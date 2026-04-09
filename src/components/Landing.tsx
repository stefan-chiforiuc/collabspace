import { createSignal, Show } from 'solid-js';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import { generateRoomCode } from '../lib/room-code';
import { getDisplayName, setDisplayName } from '../lib/storage';

export default function Landing() {
  const [name, setName] = createSignal(getDisplayName() ?? '');
  const [joinCode, setJoinCode] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [showAdvanced, setShowAdvanced] = createSignal(false);

  const handleCreate = () => {
    if (name().trim()) setDisplayName(name().trim());
    const code = generateRoomCode();
    const pw = password().trim();
    // Pass creator flag + optional password via hash fragment
    if (pw) {
      const encoded = btoa(pw);
      window.location.hash = `/room/${code}?creator=1&pw=${encoded}`;
    } else {
      window.location.hash = `/room/${code}?creator=1`;
    }
  };

  const handleJoin = () => {
    const code = joinCode().trim().toLowerCase();
    if (!code) return;
    if (name().trim()) setDisplayName(name().trim());
    window.location.hash = `/room/${code}`;
  };

  const handleJoinKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleJoin();
  };

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <Card class="w-full max-w-md space-y-6">
        <div class="text-center space-y-2">
          <h1 class="text-3xl font-bold bg-gradient-to-r from-primary-400 to-primary-200 bg-clip-text text-transparent">
            CollabSpace
          </h1>
          <p class="text-surface-400 text-sm">
            P2P collaboration, no servers needed
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

        <div class="space-y-2">
          <Button onClick={handleCreate} size="lg" class="w-full">
            Create Room
          </Button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced())}
            class="text-xs text-surface-500 hover:text-surface-300 cursor-pointer w-full text-center"
          >
            {showAdvanced() ? 'Hide options' : 'Room options...'}
          </button>
        </div>

        <Show when={showAdvanced()}>
          <Input
            label="Room password (optional)"
            placeholder="Leave empty for open room"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            maxLength={64}
          />
        </Show>

        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-surface-700" />
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="bg-surface-800 px-2 text-surface-500">or join existing</span>
          </div>
        </div>

        <div class="flex gap-2">
          <Input
            placeholder="calm-river-7291"
            value={joinCode()}
            onInput={(e) => setJoinCode(e.currentTarget.value)}
            onKeyDown={handleJoinKeyDown}
            class="flex-1"
          />
          <Button variant="secondary" onClick={handleJoin} disabled={!joinCode().trim()}>
            Join
          </Button>
        </div>
      </Card>
    </div>
  );
}
