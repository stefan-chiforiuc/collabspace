import type { ConnectionSettings, TurnProvider } from './connection-settings';

export type TurnServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

// Metered Open Relay — publicly documented shared secret for open-source WebRTC projects.
// See: https://www.metered.ca/tools/openrelay/
const OPEN_RELAY_SECRET = 'openrelayprojectsecret';

/** Generate HMAC-SHA1 time-limited credentials for the Metered open relay (RFC 5389). */
export async function generateOpenRelayCredentials(): Promise<{ username: string; credential: string }> {
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

  return { username, credential };
}

/** Build credentials for a single TURN provider. */
async function buildProviderConfig(provider: TurnProvider): Promise<TurnServerConfig> {
  switch (provider.credentialType) {
    case 'hmac-openrelay': {
      const creds = await generateOpenRelayCredentials();
      return { urls: provider.urls, username: creds.username, credential: creds.credential };
    }
    case 'static':
      return { urls: provider.urls, username: provider.username, credential: provider.credential };
    case 'none':
      return { urls: provider.urls };
  }
}

/** Build the TURN server config array from all enabled providers. */
export async function buildTurnServers(settings: ConnectionSettings): Promise<TurnServerConfig[]> {
  const enabledProviders = settings.turn.providers.filter(p => p.enabled && p.urls.length > 0);
  if (enabledProviders.length === 0) return [];
  return Promise.all(enabledProviders.map(buildProviderConfig));
}
