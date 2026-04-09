import { createSignal, onCleanup } from 'solid-js';

export type Route =
  | { page: 'landing' }
  | { page: 'room'; roomCode: string };

function parseHash(): Route {
  const hash = window.location.hash;
  const match = hash.match(/^#\/room\/(.+)$/);
  if (match) return { page: 'room', roomCode: match[1] };
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
