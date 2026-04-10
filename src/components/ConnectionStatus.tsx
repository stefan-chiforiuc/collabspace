import { Show, For, createSignal } from 'solid-js';
import type { ConnectionStatus } from '../lib/trystero';
import { testRelayConnectivity, type RelayTestResult } from '../lib/relay-test';

interface ConnectionStatusProps {
  status: ConnectionStatus;
  isConnected: boolean;
  autoReconnect: boolean;
  onRetry?: () => void;
  onClose: () => void;
}

export default function ConnectionStatusPanel(props: ConnectionStatusProps) {
  const mqttOk = () => props.status.mqtt.connected > 0;
  const torrentOk = () => props.status.torrent.connected > 0;
  const anyConnected = () => mqttOk() || torrentOk();
  const hasClosedRelays = () => props.status.relays.some(r => r.state === 'closed');
  const [showDiag, setShowDiag] = createSignal(false);
  const [testResults, setTestResults] = createSignal<RelayTestResult[] | null>(null);
  const [testing, setTesting] = createSignal(false);

  const runRelayTest = async () => {
    setTesting(true);
    setTestResults(null);
    const mqttUrls = props.status.relays.filter(r => r.strategy === 'mqtt').map(r => r.url);
    const torrentUrls = props.status.relays.filter(r => r.strategy === 'torrent').map(r => r.url);
    const results = await testRelayConnectivity(mqttUrls, torrentUrls);
    setTestResults(results);
    setTesting(false);
  };

  return (
    <div class="absolute top-12 right-2 z-30 w-72 sm:w-80 bg-surface-800/95 backdrop-blur-sm border border-surface-700 rounded-xl shadow-2xl animate-fade-in overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2.5 border-b border-surface-700">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-surface-200">Connection</span>
          <span class={`w-2 h-2 rounded-full ${anyConnected() ? 'bg-success' : 'bg-error animate-pulse'}`} />
        </div>
        <button
          onClick={props.onClose}
          class="w-7 h-7 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 cursor-pointer transition-colors"
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      {/* Strategy Summary */}
      <div class="px-3 py-2 space-y-1.5 border-b border-surface-700/50">
        <Show when={props.status.mqtt.enabled}>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class={`w-1.5 h-1.5 rounded-full ${mqttOk() ? 'bg-success' : 'bg-error'}`} />
              <span class="text-xs text-surface-300 font-medium">MQTT</span>
            </div>
            <span class="text-xs text-surface-500">
              {props.status.mqtt.connected}/{props.status.mqtt.total} brokers
            </span>
          </div>
        </Show>
        <Show when={props.status.torrent.enabled}>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class={`w-1.5 h-1.5 rounded-full ${torrentOk() ? 'bg-success' : 'bg-error'}`} />
              <span class="text-xs text-surface-300 font-medium">BitTorrent</span>
            </div>
            <span class="text-xs text-surface-500">
              {props.status.torrent.connected}/{props.status.torrent.total} trackers
            </span>
          </div>
        </Show>
        <Show when={props.status.turn}>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span class="text-xs text-surface-300 font-medium">TURN Relay</span>
            </div>
            <span class="text-[10px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400 font-medium">
              {props.status.turn!.mode === 'open-relay' ? 'Open Relay' : `Custom`}
            </span>
          </div>
        </Show>
        <div class="flex items-center justify-between pt-0.5">
          <span class="text-xs text-surface-400">Peers</span>
          <span class="text-xs font-mono text-primary-400">{props.status.peerCount}</span>
        </div>
      </div>

      {/* Identity & Room Info */}
      <div class="px-3 py-2 space-y-1 border-b border-surface-700/50">
        <div class="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Identity</div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-surface-400">Peer ID</span>
          <span class="text-[10px] font-mono text-primary-400 select-all">{props.status.selfId?.slice(0, 12)}...</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-surface-400">Room</span>
          <span class="text-[10px] font-mono text-surface-300 select-all">{props.status.roomCode}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-surface-400">App ID</span>
          <span class="text-[10px] font-mono text-surface-500">{props.status.appId}</span>
        </div>
        <Show when={!props.status.selfIdMatch}>
          <div class="text-[10px] text-error font-medium mt-1">
            WARNING: MQTT/Torrent selfId mismatch! Strategies may not share peers.
          </div>
        </Show>
      </div>

      {/* Relay Details */}
      <div class="px-3 py-2 max-h-48 overflow-y-auto">
        <div class="text-[10px] text-surface-500 uppercase tracking-wider mb-1.5">Relays</div>
        <div class="space-y-1">
          <For each={props.status.relays}>
            {(relay) => {
              const host = () => {
                try {
                  const u = new URL(relay.url);
                  return u.hostname;
                } catch {
                  return relay.url;
                }
              };
              const stateColor = () => {
                switch (relay.state) {
                  case 'open': return 'bg-success';
                  case 'connecting': return 'bg-warning animate-pulse';
                  case 'closed': return 'bg-error';
                }
              };
              const stateLabel = () => {
                switch (relay.state) {
                  case 'open': return 'Connected';
                  case 'connecting': return 'Connecting...';
                  case 'closed': return 'Disconnected';
                }
              };

              return (
                <div class="flex items-center justify-between gap-2 py-0.5">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class={`w-1.5 h-1.5 rounded-full shrink-0 ${stateColor()}`} />
                    <span class="text-[11px] text-surface-400 truncate" title={relay.url}>
                      {host()}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class={`text-[9px] px-1 py-0.5 rounded font-medium ${
                      relay.strategy === 'mqtt'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-orange-500/15 text-orange-400'
                    }`}>
                      {relay.strategy === 'mqtt' ? 'MQTT' : 'BT'}
                    </span>
                    <span class={`text-[10px] ${
                      relay.state === 'open' ? 'text-success' : relay.state === 'connecting' ? 'text-warning' : 'text-error'
                    }`}>
                      {stateLabel()}
                    </span>
                  </div>
                </div>
              );
            }}
          </For>
          <Show when={props.status.relays.length === 0}>
            <div class="text-[11px] text-surface-500 italic py-1">Initializing connections...</div>
          </Show>
        </div>
      </div>

      {/* Manual retry button — shown when auto-reconnect is off and relays have failed */}
      <Show when={!props.autoReconnect && hasClosedRelays()}>
        <div class="px-3 py-2 border-t border-surface-700/50">
          <button
            onClick={() => props.onRetry?.()}
            class="w-full text-[11px] font-medium text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15 rounded-lg py-2 cursor-pointer transition-colors"
          >
            Retry Connections
          </button>
        </div>
      </Show>

      {/* Diagnostic Log */}
      <div class="px-3 py-2 border-t border-surface-700/50">
        <div class="flex items-center justify-between mb-1">
          <button
            onClick={() => setShowDiag(!showDiag())}
            class="text-[10px] text-surface-500 hover:text-surface-300 cursor-pointer text-left"
          >
            {showDiag() ? 'Hide Diagnostics' : 'Show Diagnostics'} ({props.status.diagnostics?.length || 0} events)
          </button>
          <button
            onClick={runRelayTest}
            disabled={testing()}
            class="text-[10px] font-medium text-yellow-400 hover:text-yellow-300 disabled:text-surface-600 cursor-pointer disabled:cursor-wait"
          >
            {testing() ? 'Testing...' : 'Test Relays'}
          </button>
        </div>

        {/* Relay Test Results */}
        <Show when={testResults()}>
          <div class="mb-2 bg-surface-900/50 rounded-lg p-2 space-y-0.5">
            <div class="text-[10px] text-surface-500 uppercase tracking-wider mb-1">Relay Test Results</div>
            <For each={testResults()!}>
              {(r) => (
                <div class="flex items-center justify-between text-[9px] font-mono">
                  <div class="flex items-center gap-1 min-w-0">
                    <span class={`w-1.5 h-1.5 rounded-full shrink-0 ${r.reachable ? 'bg-success' : 'bg-error'}`} />
                    <span class="text-surface-400 truncate">{(() => { try { return new URL(r.url).hostname; } catch { return r.url; } })()}</span>
                  </div>
                  <span class={r.reachable ? 'text-success' : 'text-error'}>
                    {r.reachable ? `${r.latencyMs}ms` : r.error?.slice(0, 20) || 'fail'}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={showDiag()}>
          <div class="mt-2 max-h-48 overflow-y-auto bg-surface-900/50 rounded-lg p-2 space-y-0.5">
            <For each={[...(props.status.diagnostics || [])].reverse().slice(0, 50)}>
              {(event) => {
                const time = () => {
                  const d = new Date(event.time);
                  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
                };
                const color = () => {
                  switch (event.type) {
                    case 'peer': return 'text-green-400';
                    case 'relay': return 'text-blue-400';
                    case 'error': return 'text-red-400';
                    default: return 'text-surface-500';
                  }
                };
                return (
                  <div class="text-[9px] font-mono leading-tight">
                    <span class="text-surface-600">{time()}</span>{' '}
                    <span class={color()}>[{event.type}]</span>{' '}
                    <span class="text-surface-400">{event.message}</span>
                  </div>
                );
              }}
            </For>
            <Show when={!props.status.diagnostics?.length}>
              <div class="text-[10px] text-surface-600 italic">No events yet</div>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
