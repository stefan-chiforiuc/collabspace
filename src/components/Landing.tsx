import { createSignal } from 'solid-js';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import { generateRoomCode } from '../lib/room-code';
import { getDisplayName, setDisplayName } from '../lib/storage';

export default function Landing() {
  const [name, setName] = createSignal(getDisplayName() ?? '');
  const [joinCode, setJoinCode] = createSignal('');
  const [joinPassword, setJoinPassword] = createSignal('');
  const [password, setPassword] = createSignal('');

  const handleCreate = () => {
    if (!canCreate()) return;
    setDisplayName(name().trim());
    const code = generateRoomCode();
    const encoded = btoa(password().trim());
    window.location.hash = `/room/${code}?creator=1&pw=${encoded}`;
  };

  const handleJoin = () => {
    const code = joinCode().trim().toLowerCase();
    if (!canJoin()) return;
    setDisplayName(name().trim());
    const encoded = btoa(joinPassword().trim());
    window.location.hash = `/room/${code}?pw=${encoded}`;
  };

  const handleJoinKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleJoin();
  };

  const canCreate = () => !!name().trim() && !!password().trim();
  const canJoin = () => !!name().trim() && !!joinCode().trim() && !!joinPassword().trim();

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

        <Input
          label="Room password"
          placeholder="Choose a password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          maxLength={64}
        />

        <Button onClick={handleCreate} size="lg" class="w-full" disabled={!canCreate()}>
          Create Room
        </Button>

        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-surface-700" />
          </div>
          <div class="relative flex justify-center text-xs">
            <span class="bg-surface-800 px-2 text-surface-500">or join existing</span>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex gap-2">
            <Input
              placeholder="calm-river-7291"
              value={joinCode()}
              onInput={(e) => setJoinCode(e.currentTarget.value)}
              onKeyDown={handleJoinKeyDown}
              class="flex-1"
            />
            <Button variant="secondary" onClick={handleJoin} disabled={!canJoin()}>
              Join
            </Button>
          </div>

          <Input
            label="Room password"
            placeholder="Enter room password"
            value={joinPassword()}
            onInput={(e) => setJoinPassword(e.currentTarget.value)}
            onKeyDown={handleJoinKeyDown}
            maxLength={64}
          />
        </div>
      </Card>
    </div>
  );
}
