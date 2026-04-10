/**
 * Share TURN credentials between peers via the Yjs document.
 *
 * When the room creator (or any peer with working TURN) generates
 * credentials, they write them to the Yjs doc. Other peers connected
 * via MQTT relay receive the credentials and can reconnect with TURN
 * for a direct P2P connection.
 */
import * as Y from 'yjs';
import type { TurnServerConfig } from './turn-config';

const TURN_KEY = 'sharedTurnServers';
const TURN_EXPIRY_KEY = 'sharedTurnExpiry';

export type SharedTurnCredentials = {
  servers: TurnServerConfig[];
  expiry: number; // unix timestamp (seconds)
};

/** Write TURN credentials to the Yjs doc for other peers to use. */
export function publishTurnCredentials(
  doc: Y.Doc,
  servers: TurnServerConfig[],
  ttlSeconds = 12 * 3600, // 12 hours default
) {
  if (servers.length === 0) return;
  const meta = doc.getMap('meta');
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;

  // Serialize — TurnServerConfig may have string | string[] for urls
  const serialized = servers.map(s => ({
    urls: Array.isArray(s.urls) ? s.urls : [s.urls],
    username: s.username,
    credential: s.credential,
  }));

  meta.set(TURN_KEY, serialized);
  meta.set(TURN_EXPIRY_KEY, expiry);
  console.log(`[CollabSpace:turn-share] Published ${servers.length} TURN server(s) to Yjs doc (expires in ${ttlSeconds}s)`);
}

/** Read shared TURN credentials from the Yjs doc. Returns null if none or expired. */
export function getSharedTurnCredentials(doc: Y.Doc): SharedTurnCredentials | null {
  const meta = doc.getMap('meta');
  const servers = meta.get(TURN_KEY) as Array<{ urls: string[]; username?: string; credential?: string }> | undefined;
  const expiry = meta.get(TURN_EXPIRY_KEY) as number | undefined;

  if (!servers || !Array.isArray(servers) || servers.length === 0) return null;
  if (expiry && Date.now() / 1000 > expiry) {
    console.log('[CollabSpace:turn-share] Shared TURN credentials expired');
    return null;
  }

  return { servers, expiry: expiry || 0 };
}

/**
 * Watch the Yjs doc for shared TURN credentials arriving from another peer.
 * Calls the callback when new, valid credentials appear.
 */
export function watchSharedTurnCredentials(
  doc: Y.Doc,
  onCredentials: (creds: SharedTurnCredentials) => void,
): () => void {
  const meta = doc.getMap('meta');
  let lastExpiry = 0;

  const check = () => {
    const creds = getSharedTurnCredentials(doc);
    if (creds && creds.expiry !== lastExpiry) {
      lastExpiry = creds.expiry;
      console.log(`[CollabSpace:turn-share] Received shared TURN credentials (${creds.servers.length} server(s))`);
      onCredentials(creds);
    }
  };

  meta.observe(check);
  // Check immediately in case credentials are already in the doc
  check();

  return () => meta.unobserve(check);
}
