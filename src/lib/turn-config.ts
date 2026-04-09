import type { ConnectionSettings } from './connection-settings';

export type TurnServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

// Metered Open Relay — publicly documented shared secret for open-source WebRTC projects.
// See: https://www.metered.ca/tools/openrelay/
const OPEN_RELAY_SECRET = 'openrelayprojectsecret';
const OPEN_RELAY_URLS = [
  'turns:global.relay.metered.ca:443?transport=tcp',
  'turn:global.relay.metered.ca:80?transport=tcp',
  'turn:global.relay.metered.ca:443?transport=tcp',
];

/** Generate HMAC-SHA1 time-limited credentials for the Metered open relay (RFC 5389). */
export async function generateOpenRelayCredentials(): Promise<TurnServerConfig> {
  const expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // 24 hours
  const username = String(expiry);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(OPEN_RELAY_SECRET),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username));
  const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return {
    urls: OPEN_RELAY_URLS,
    username,
    credential,
  };
}

/** Build the TURN server config array based on user settings. */
export async function buildTurnServers(settings: ConnectionSettings): Promise<TurnServerConfig[]> {
  switch (settings.turn.mode) {
    case 'auto':
      return [await generateOpenRelayCredentials()];

    case 'custom': {
      if (!settings.turn.customUrl) return [];
      return [{
        urls: settings.turn.customUrl,
        username: settings.turn.username,
        credential: settings.turn.credential,
      }];
    }

    case 'disabled':
      return [];
  }
}
