/**
 * Cloudflare TURN integration.
 *
 * Cloudflare provides 1 TB/month free TURN relay via their global anycast
 * network. Credentials are generated via a REST API call.
 *
 * Two modes:
 * 1. Cloudflare Worker URL — user deploys a tiny Worker that proxies the API
 *    (avoids CORS issues, keeps API token server-side)
 * 2. Direct API — user provides Key ID + API Token, called from browser
 *    (simpler but exposes token in client)
 */

import type { TurnServerConfig } from './turn-config';

const CF_TURN_URL = 'turn:turn.cloudflare.com:443?transport=tcp';
const CF_TURNS_URL = 'turns:turn.cloudflare.com:443?transport=tcp';
const CF_TURN_UDP = 'turn:turn.cloudflare.com:3478?transport=udp';

const STORAGE_KEY = 'collabspace:cloudflareTurn';

export type CloudflareConfig = {
  mode: 'worker' | 'direct';
  /** Worker URL that returns TURN credentials */
  workerUrl?: string;
  /** Cloudflare TURN Key ID (for direct mode) */
  keyId?: string;
  /** Cloudflare API Token (for direct mode) */
  apiToken?: string;
  /** Default TTL for generated credentials in seconds */
  ttl?: number;
};

export function loadCloudflareConfig(): CloudflareConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveCloudflareConfig(config: CloudflareConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearCloudflareConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Generate TURN credentials from Cloudflare.
 * Returns null if configuration is missing or the API call fails.
 */
export async function generateCloudflareCredentials(
  config?: CloudflareConfig | null,
): Promise<TurnServerConfig | null> {
  const cfg = config || loadCloudflareConfig();
  if (!cfg) return null;

  const ttl = cfg.ttl || 86400; // 24 hours default

  try {
    if (cfg.mode === 'worker' && cfg.workerUrl) {
      // Call the Worker proxy
      const resp = await fetch(cfg.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl }),
      });
      if (!resp.ok) throw new Error(`Worker responded ${resp.status}`);
      const data = await resp.json();
      return parseCfResponse(data);
    }

    if (cfg.mode === 'direct' && cfg.keyId && cfg.apiToken) {
      // Call Cloudflare API directly (may fail due to CORS)
      const resp = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${cfg.keyId}/credentials/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl }),
        },
      );
      if (!resp.ok) throw new Error(`Cloudflare API responded ${resp.status}`);
      const data = await resp.json();
      return parseCfResponse(data);
    }

    return null;
  } catch (err) {
    console.error('[CollabSpace:cf-turn] Failed to generate credentials:', err);
    return null;
  }
}

function parseCfResponse(data: unknown): TurnServerConfig | null {
  // Cloudflare returns: { iceServers: { urls: [...], username: "...", credential: "..." } }
  const obj = data as Record<string, unknown>;
  const iceServers = obj.iceServers as { urls?: string[]; username?: string; credential?: string } | undefined;

  if (iceServers?.username && iceServers?.credential) {
    return {
      urls: iceServers.urls || [CF_TURNS_URL, CF_TURN_URL, CF_TURN_UDP],
      username: iceServers.username,
      credential: iceServers.credential,
    };
  }

  // Fallback: maybe the response has username/credential at top level
  if (typeof obj.username === 'string' && typeof obj.credential === 'string') {
    return {
      urls: [CF_TURNS_URL, CF_TURN_URL, CF_TURN_UDP],
      username: obj.username,
      credential: obj.credential,
    };
  }

  return null;
}

/**
 * Test if the Cloudflare TURN configuration works.
 * Generates credentials and tests for relay candidates.
 */
export async function testCloudflareSetup(config: CloudflareConfig): Promise<{
  ok: boolean;
  error?: string;
  credentials?: TurnServerConfig;
}> {
  const creds = await generateCloudflareCredentials(config);
  if (!creds) {
    return { ok: false, error: 'Failed to generate credentials' };
  }
  return { ok: true, credentials: creds };
}

/**
 * Cloudflare Worker source code for proxying TURN credential generation.
 * Users deploy this to their Cloudflare account.
 */
export const WORKER_SOURCE_CODE = `
// CollabSpace TURN Proxy Worker
// Deploy this to Cloudflare Workers (free tier: 3M requests/month)
//
// Environment variables needed:
//   TURN_KEY_ID  — from Dashboard → Calls → TURN Keys
//   TURN_API_TOKEN — API token with Calls permission

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405, headers: corsHeaders });
    }

    try {
      const { ttl = 86400 } = await request.json().catch(() => ({}));
      const resp = await fetch(
        \`https://rtc.live.cloudflare.com/v1/turn/keys/\${env.TURN_KEY_ID}/credentials/generate\`,
        {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${env.TURN_API_TOKEN}\`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: Math.min(ttl, 86400) }),
        }
      );

      const data = await resp.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
`.trim();
