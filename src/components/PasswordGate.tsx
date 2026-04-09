import { createSignal } from 'solid-js';
import Card from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';

interface PasswordGateProps {
  roomCode: string;
  onSubmit: (password: string) => void;
  error?: string;
}

export default function PasswordGate(props: PasswordGateProps) {
  const [password, setPassword] = createSignal('');

  const handleSubmit = () => {
    if (password().trim()) {
      props.onSubmit(password().trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <Card class="w-full max-w-sm space-y-5">
        <div class="text-center space-y-2">
          <div class="text-2xl">🔒</div>
          <h2 class="text-lg font-semibold text-surface-200">Room is protected</h2>
          <p class="text-surface-400 text-sm">
            <span class="font-mono text-primary-400">{props.roomCode}</span> requires a password to join.
          </p>
        </div>

        <Input
          label="Password"
          placeholder="Enter room password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          autofocus
        />

        {props.error && (
          <p class="text-error text-sm text-center">{props.error}</p>
        )}

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
            onClick={handleSubmit}
            disabled={!password().trim()}
          >
            Join
          </Button>
        </div>
      </Card>
    </div>
  );
}
