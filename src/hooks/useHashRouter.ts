import { createSignal, onCleanup } from 'solid-js';
import type { TurnServerConfig } from '../lib/turn-config';
import { decodeTurnServers } from '../lib/turn-encoding';

export type Route =
  | { page: 'landing' }
  | { page: 'lobby'; roomCode: string; sharedTurn?: TurnServerConfig[] }
  | { page: 'room'; roomCode: string; password: string; isCreator: boolean; sharedTurn?: TurnServerConfig[] };

function parseHash(): Route {
  const hash = window.location.hash;
  const match = hash.match(/^#\/room\/([^?]+)(?:\?(.*))?$/);
  if (match) {
    const roomCode = match[1];
    const params = new URLSearchParams(match[2] || '');
    const pw = params.get('pw');
    const password = pw ? atob(pw) : undefined;
    const isCreator = params.get('creator') === '1';

    // Parse shared TURN credentials from invite URL (compact or legacy format)
    let sharedTurn: TurnServerConfig[] | undefined;
    const turnParam = params.get('turn');
    if (turnParam) {
      const decoded = decodeTurnServers(turnParam);
      if (decoded.length > 0) sharedTurn = decoded;
    }

    // Creator with password → straight to room
    if (isCreator && password) {
      return { page: 'room', roomCode, password, isCreator: true, sharedTurn };
    }

    // Joiner with password (submitted from lobby or landing) → room
    if (!isCreator && password) {
      return { page: 'room', roomCode, password, isCreator: false, sharedTurn };
    }

    // No password → lobby to collect name + password
    return { page: 'lobby', roomCode, sharedTurn };
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
