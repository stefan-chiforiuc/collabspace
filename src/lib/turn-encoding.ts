import { DEFAULT_TURN_PROVIDERS } from './connection-settings';
import type { TurnServerConfig } from './turn-config';

/**
 * Compact TURN encoding for invite URLs.
 *
 * Built-in providers are encoded as short IDs (the joiner's client has the
 * same DEFAULT_TURN_PROVIDERS list and resolves credentials locally).
 * Custom servers are serialized in full. This reduces URL length by ~85%
 * for the common case of all-builtin providers.
 *
 * Format: { b?: string[], c?: TurnServerConfig[] }
 *   b = built-in provider IDs
 *   c = custom (non-builtin) full server configs
 *
 * Old format (plain array of TurnServerConfig[]) is detected and decoded
 * for backward compatibility.
 */

interface CompactPayload {
  b?: string[];
  c?: Array<{ urls: string[]; username?: string; credential?: string }>;
}

function normalizeUrls(urls: string | string[]): string[] {
  return (Array.isArray(urls) ? urls : [urls]).slice().sort();
}

function urlsMatch(a: string[], b: string[]): boolean {
  const sa = normalizeUrls(a);
  const sb = normalizeUrls(b);
  if (sa.length !== sb.length) return false;
  return sa.every((url, i) => url === sb[i]);
}

/**
 * Encode resolved TurnServerConfig[] into a compact base64 string for URLs.
 * Matches configs back to built-in providers by URL comparison.
 */
export function encodeTurnServers(turnServers: TurnServerConfig[]): string {
  const payload: CompactPayload = {};
  const builtinIds: string[] = [];
  const custom: Array<{ urls: string[]; username?: string; credential?: string }> = [];

  for (const server of turnServers) {
    const serverUrls = normalizeUrls(Array.isArray(server.urls) ? server.urls : [server.urls]);
    const matchingProvider = DEFAULT_TURN_PROVIDERS.find(p =>
      urlsMatch(p.urls, serverUrls),
    );
    if (matchingProvider) {
      builtinIds.push(matchingProvider.id);
    } else {
      custom.push({
        urls: Array.isArray(server.urls) ? server.urls : [server.urls],
        username: server.username,
        credential: server.credential,
      });
    }
  }

  if (builtinIds.length > 0) payload.b = builtinIds;
  if (custom.length > 0) payload.c = custom;

  return btoa(JSON.stringify(payload));
}

/**
 * Decode a TURN parameter from a URL. Handles both the new compact format
 * (object with b/c keys) and the old format (plain array of TurnServerConfig[]).
 */
export function decodeTurnServers(encoded: string): TurnServerConfig[] {
  try {
    const decoded = JSON.parse(atob(encoded));

    // New compact format: object with b (builtin IDs) and/or c (custom servers)
    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
      const payload = decoded as CompactPayload;
      const servers: TurnServerConfig[] = [];

      if (payload.b) {
        for (const id of payload.b) {
          const provider = DEFAULT_TURN_PROVIDERS.find(p => p.id === id);
          if (provider) {
            servers.push({
              urls: provider.urls,
              username: provider.username,
              credential: provider.credential,
            });
          }
        }
      }

      if (payload.c) {
        servers.push(...payload.c);
      }

      return servers;
    }

    // Old format: plain array of TurnServerConfig objects
    if (Array.isArray(decoded)) {
      return decoded;
    }

    return [];
  } catch {
    return [];
  }
}
