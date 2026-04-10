/**
 * Standalone relay connectivity tester.
 * Tests whether MQTT brokers and WebTorrent trackers are reachable
 * by opening WebSocket connections and checking they connect.
 */

export type RelayTestResult = {
  url: string;
  strategy: 'mqtt' | 'torrent';
  reachable: boolean;
  latencyMs: number | null;
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
