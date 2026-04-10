/**
 * Standalone relay connectivity tester.
 * Tests whether MQTT brokers and WebTorrent trackers are reachable
 * by opening WebSocket connections and checking they connect.
 * Also tests TURN server reachability via ICE candidate gathering.
 */

import { generateOpenRelayCredentials } from './turn-config';
import { DEFAULT_TURN_PROVIDERS, type TurnProvider } from './connection-settings';

export type RelayTestResult = {
  url: string;
  strategy: 'mqtt' | 'torrent';
  reachable: boolean;
  latencyMs: number | null;
  error?: string;
};

export type TurnTestResult = {
  reachable: boolean;
  latencyMs: number | null;
  candidateTypes: string[];  // 'host' | 'srflx' | 'relay'
  hasRelay: boolean;         // THE critical check
  error?: string;
};

/** Test a single WebSocket URL for connectivity. */
function testWebSocket(url: string, timeoutMs = 8000): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;
    const finish = (ok: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve({ ok, latencyMs: Date.now() - start, error });
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      resolve({ ok: false, latencyMs: 0, error: `Failed to create WebSocket: ${err}` });
      return;
    }

    ws.onopen = () => finish(true);
    ws.onerror = () => finish(false, 'WebSocket error');
    ws.onclose = (e) => {
      if (!settled) finish(false, `Closed: code=${e.code} reason=${e.reason || 'none'}`);
    };

    setTimeout(() => finish(false, `Timeout after ${timeoutMs}ms`), timeoutMs);
  });
}

/** Test all relay servers and return results. */
export async function testRelayConnectivity(
  mqttServers: string[],
  torrentServers: string[],
): Promise<RelayTestResult[]> {
  console.log('[CollabSpace:test] Starting relay connectivity test...');

  const tests = [
    ...mqttServers.map(async (url): Promise<RelayTestResult> => {
      const result = await testWebSocket(url);
      console.log(`[CollabSpace:test] MQTT ${url}: ${result.ok ? 'OK' : 'FAIL'} (${result.latencyMs}ms) ${result.error || ''}`);
      return {
        url,
        strategy: 'mqtt',
        reachable: result.ok,
        latencyMs: result.ok ? result.latencyMs : null,
        error: result.error,
      };
    }),
    ...torrentServers.map(async (url): Promise<RelayTestResult> => {
      const result = await testWebSocket(url);
      console.log(`[CollabSpace:test] Torrent ${url}: ${result.ok ? 'OK' : 'FAIL'} (${result.latencyMs}ms) ${result.error || ''}`);
      return {
        url,
        strategy: 'torrent',
        reachable: result.ok,
        latencyMs: result.ok ? result.latencyMs : null,
        error: result.error,
      };
    }),
  ];

  const results = await Promise.all(tests);
  const mqttOk = results.filter(r => r.strategy === 'mqtt' && r.reachable).length;
  const torrentOk = results.filter(r => r.strategy === 'torrent' && r.reachable).length;
  console.log(`[CollabSpace:test] Results: MQTT ${mqttOk}/${mqttServers.length} OK, Torrent ${torrentOk}/${torrentServers.length} OK`);

  return results;
}

/**
 * Test TURN server connectivity by creating a dummy RTCPeerConnection
 * with ONLY the TURN server, triggering ICE gathering, and checking
 * whether a 'relay' candidate is produced.
 *
 * If no provider is given, tests ALL enabled built-in providers.
 */
export async function testTurnConnectivity(
  provider?: TurnProvider,
  timeoutMs = 15000,
): Promise<TurnTestResult> {
  console.log('[CollabSpace:test] Starting TURN connectivity test...');

  if (typeof RTCPeerConnection === 'undefined') {
    return { reachable: false, latencyMs: null, candidateTypes: [], hasRelay: false, error: 'RTCPeerConnection not available' };
  }

  const start = Date.now();

  try {
    // Build ICE servers list from given provider or all enabled defaults
    const providers = provider ? [provider] : DEFAULT_TURN_PROVIDERS.filter(p => p.enabled);
    const iceServers: RTCIceServer[] = [];
    for (const p of providers) {
      if (p.credentialType === 'hmac-openrelay') {
        const creds = await generateOpenRelayCredentials();
        iceServers.push({ urls: p.urls, username: creds.username, credential: creds.credential });
      } else if (p.credentialType === 'static' && p.username) {
        iceServers.push({ urls: p.urls, username: p.username, credential: p.credential });
      } else {
        iceServers.push({ urls: p.urls });
      }
    }

    console.log(`[CollabSpace:test] Testing ${iceServers.length} TURN server(s)...`);

    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: 'relay', // force relay-only
    });

    const candidateTypes: string[] = [];
    let hasRelay = false;

    const result = await new Promise<TurnTestResult>((resolve) => {
      let settled = false;
      const finish = (r: TurnTestResult) => {
        if (settled) return;
        settled = true;
        pc.close();
        resolve(r);
      };

      const timer = setTimeout(() => {
        const msg = candidateTypes.length > 0
          ? `Timeout — got candidates [${candidateTypes.join(',')}] but no relay`
          : 'Timeout — no ICE candidates gathered';
        finish({
          reachable: false, latencyMs: Date.now() - start,
          candidateTypes, hasRelay: false, error: msg,
        });
      }, timeoutMs);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          const raw = e.candidate.candidate;
          const typeMatch = raw.match(/typ (\w+)/);
          const ctype = typeMatch?.[1] ?? 'unknown';
          candidateTypes.push(ctype);
          console.log(`[CollabSpace:test] TURN candidate: type=${ctype} raw="${raw}"`);

          if (ctype === 'relay') {
            hasRelay = true;
            clearTimeout(timer);
            finish({
              reachable: true, latencyMs: Date.now() - start,
              candidateTypes, hasRelay: true,
            });
          }
        } else {
          // Gathering complete — no relay candidate found
          if (!hasRelay) {
            clearTimeout(timer);
            finish({
              reachable: false, latencyMs: Date.now() - start,
              candidateTypes, hasRelay: false,
              error: `Gathering complete — candidates: [${candidateTypes.join(',')}], no relay`,
            });
          }
        }
      };

      pc.onicecandidateerror = (e: Event) => {
        const err = e as RTCPeerConnectionIceErrorEvent;
        console.log(`[CollabSpace:test] ICE candidate error: ${err.errorCode} ${err.errorText ?? ''} ${err.url ?? ''}`);
      };

      // Create a dummy data channel + offer to trigger ICE gathering
      pc.createDataChannel('turn-test');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => {
          clearTimeout(timer);
          finish({
            reachable: false, latencyMs: Date.now() - start,
            candidateTypes, hasRelay: false,
            error: `Offer creation failed: ${err}`,
          });
        });
    });

    console.log(`[CollabSpace:test] TURN test result: reachable=${result.reachable} hasRelay=${result.hasRelay} (${result.latencyMs}ms)`);
    return result;
  } catch (err) {
    return {
      reachable: false, latencyMs: Date.now() - start,
      candidateTypes: [], hasRelay: false,
      error: `TURN test failed: ${err}`,
    };
  }
}
