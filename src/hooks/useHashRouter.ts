import { createSignal, onCleanup } from 'solid-js';

export type Route =
  | { page: 'landing' }
  | { page: 'room'; roomCode: string; password?: string };

function parseHash(): Route {
  const hash = window.location.hash;
  const match = hash.match(/^#\/room\/([^?]+)(?:\?(.*))?$/);
  if (match) {
    const roomCode = match[1];
    const params = new URLSearchParams(match[2] || '');
    const pw = params.get('pw');
    const password = pw ? atob(pw) : undefined;
    return { page: 'room', roomCode, password };
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
