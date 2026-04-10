import { createSignal, onCleanup } from 'solid-js';
import type { TurnServerConfig } from '../lib/turn-config';

export type Route =
  | { page: 'landing' }
  | { page: 'room'; roomCode: string; password?: string; isCreator: boolean; sharedTurn?: TurnServerConfig[] };

function parseHash(): Route {
  const hash = window.location.hash;
  const match = hash.match(/^#\/room\/([^?]+)(?:\?(.*))?$/);
  if (match) {
    const roomCode = match[1];
    const params = new URLSearchParams(match[2] || '');
    const pw = params.get('pw');
    const password = pw ? atob(pw) : undefined;
    const isCreator = params.get('creator') === '1';

    // Parse shared TURN credentials from invite URL
    let sharedTurn: TurnServerConfig[] | undefined;
    const turnParam = params.get('turn');
    if (turnParam) {
      try {
        sharedTurn = JSON.parse(atob(turnParam));
      } catch {
        console.warn('[CollabSpace] Failed to parse TURN credentials from URL');
      }
    }

    return { page: 'room', roomCode, password, isCreator, sharedTurn };
  }
  return { page: 'landing' };
}

export function useHashRouter() {
  const [route, setRoute] = createSignal<Route>(parseHash());

  const handler = () => setRoute(parseHash());
  window.addEventListener('hashchange', handler);
  onCleanup(() => window.removeEventListener('hashchange', handler));

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  return { route, navigate };
}
