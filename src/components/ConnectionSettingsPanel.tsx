import { createSignal, Show, For } from 'solid-js';
import type { ConnectionSettings, TurnProvider } from '../lib/connection-settings';
import { getDefaultSettings, genTurnId } from '../lib/connection-settings';
import {
  loadCloudflareConfig, saveCloudflareConfig, clearCloudflareConfig,
  testCloudflareSetup, WORKER_SOURCE_CODE,
  type CloudflareConfig,
} from '../lib/cloudflare-turn';
import Button from './ui/Button';

interface ConnectionSettingsPanelProps {
  settings: ConnectionSettings;
  onApply: (settings: ConnectionSettings) => void;
  onClose: () => void;
  showReconnect?: boolean;
}

export default function ConnectionSettingsPanel(props: ConnectionSettingsPanelProps) {
  // Local editable copy
  const [mqttEnabled, setMqttEnabled] = createSignal(props.settings.mqtt.enabled);
  const [mqttServers, setMqttServers] = createSignal([...props.settings.mqtt.servers]);
  const [torrentEnabled, setTorrentEnabled] = createSignal(props.settings.torrent.enabled);
  const [torrentServers, setTorrentServers] = createSignal([...props.settings.torrent.servers]);
  const [turnProviders, setTurnProviders] = createSignal<TurnProvider[]>(
    props.settings.turn.providers.map(p => ({ ...p }))
  );
  const [autoReconnect, setAutoReconnect] = createSignal(props.settings.autoReconnect);
  const [newServer, setNewServer] = createSignal('');
  const [addingTo, setAddingTo] = createSignal<'mqtt' | 'torrent' | 'turn' | null>(null);
  const [newTurnUrl, setNewTurnUrl] = createSignal('');
  const [newTurnUser, setNewTurnUser] = createSignal('');
  const [newTurnCred, setNewTurnCred] = createSignal('');

  // Cloudflare TURN wizard
  const [showCfSetup, setShowCfSetup] = createSignal(false);
  const existingCf = loadCloudflareConfig();
  const [cfMode, setCfMode] = createSignal<'worker' | 'direct'>(existingCf?.mode || 'worker');
  const [cfWorkerUrl, setCfWorkerUrl] = createSignal(existingCf?.workerUrl || '');
  const [cfKeyId, setCfKeyId] = createSignal(existingCf?.keyId || '');
  const [cfApiToken, setCfApiToken] = createSignal(existingCf?.apiToken || '');
  const [cfTestResult, setCfTestResult] = createSignal<string | null>(null);
  const [cfTesting, setCfTesting] = createSignal(false);
  const cfConfigured = () => !!(existingCf?.workerUrl || existingCf?.keyId);

  const handleCfTest = async () => {
    setCfTesting(true);
    setCfTestResult(null);
    const config: CloudflareConfig = {
      mode: cfMode(),
      workerUrl: cfMode() === 'worker' ? cfWorkerUrl().trim() : undefined,
      keyId: cfMode() === 'direct' ? cfKeyId().trim() : undefined,
      apiToken: cfMode() === 'direct' ? cfApiToken().trim() : undefined,
    };
    const result = await testCloudflareSetup(config);
    if (result.ok && result.credentials) {
      saveCloudflareConfig(config);
      // Add as a TURN provider
      setTurnProviders(ps => {
        const filtered = ps.filter(p => p.id !== 'cloudflare');
        return [...filtered, {
          id: 'cloudflare',
          label: 'Cloudflare TURN',
          urls: Array.isArray(result.credentials!.urls) ? result.credentials!.urls as string[] : [result.credentials!.urls as string],
          credentialType: 'static' as const,
          username: result.credentials!.username,
          credential: result.credentials!.credential,
          enabled: true,
        }];
      });
      setCfTestResult('OK — Cloudflare TURN added as provider');
    } else {
      setCfTestResult(`Failed: ${result.error}`);
    }
    setCfTesting(false);
  };

  const handleCfRemove = () => {
    clearCloudflareConfig();
    setTurnProviders(ps => ps.filter(p => p.id !== 'cloudflare'));
    setCfWorkerUrl('');
    setCfKeyId('');
    setCfApiToken('');
    setCfTestResult(null);
  };

  const isValid = () => mqttEnabled() || torrentEnabled();

  const handleApply = () => {
    if (!isValid()) return;
    const s: ConnectionSettings = {
      mqtt: { enabled: mqttEnabled(), servers: mqttServers() },
      torrent: { enabled: torrentEnabled(), servers: torrentServers() },
      turn: { providers: turnProviders() },
      autoReconnect: autoReconnect(),
    };
    props.onApply(s);
  };

  const handleReset = () => {
    const d = getDefaultSettings();
    setMqttEnabled(d.mqtt.enabled);
    setMqttServers([...d.mqtt.servers]);
    setTorrentEnabled(d.torrent.enabled);
    setTorrentServers([...d.torrent.servers]);
    setTurnProviders(d.turn.providers.map(p => ({ ...p })));
    setAutoReconnect(d.autoReconnect);
  };

  const removeServer = (strategy: 'mqtt' | 'torrent', index: number) => {
    if (strategy === 'mqtt') {
      setMqttServers(s => s.filter((_, i) => i !== index));
    } else {
      setTorrentServers(s => s.filter((_, i) => i !== index));
    }
  };

  const addServer = (strategy: 'mqtt' | 'torrent') => {
    const url = newServer().trim();
    if (!url) return;
    if (strategy === 'mqtt') {
      setMqttServers(s => [...s, url]);
    } else {
      setTorrentServers(s => [...s, url]);
    }
    setNewServer('');
    setAddingTo(null);
  };

  const toggleTurnProvider = (id: string) => {
    setTurnProviders(ps => ps.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const removeTurnProvider = (id: string) => {
    setTurnProviders(ps => ps.filter(p => p.id !== id));
  };

  const addTurnProvider = () => {
    const url = newTurnUrl().trim();
    if (!url) return;
    const provider: TurnProvider = {
      id: genTurnId(),
      label: 'Custom',
      urls: [url],
      credentialType: newTurnUser().trim() ? 'static' : 'none',
      username: newTurnUser().trim() || undefined,
      credential: newTurnCred().trim() || undefined,
      enabled: true,
    };
    setTurnProviders(ps => [...ps, provider]);
    setNewTurnUrl('');
    setNewTurnUser('');
    setNewTurnCred('');
    setAddingTo(null);
  };

  const hostname = (url: string) => {
    try { return new URL(url).hostname; } catch { return url; }
  };

  return (
    <div class="absolute inset-0 z-30 flex items-start justify-center pt-12 sm:pt-16 px-2 animate-fade-in">
      <div class="w-full max-w-sm bg-surface-800/95 backdrop-blur-sm border border-surface-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between px-3 py-2.5 border-b border-surface-700">
          <span class="text-sm font-semibold text-surface-200">Connection Settings</span>
          <button
            onClick={props.onClose}
            class="w-7 h-7 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 cursor-pointer transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="max-h-[60vh] overflow-y-auto">
          {/* MQTT */}
          <div class="px-3 py-2.5 border-b border-surface-700/50">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-surface-300">MQTT Signaling</span>
              <button
                onClick={() => setMqttEnabled(!mqttEnabled())}
                class={`w-9 h-5 rounded-full transition-colors cursor-pointer ${mqttEnabled() ? 'bg-primary-600' : 'bg-surface-600'}`}
              >
                <span class={`block w-3.5 h-3.5 rounded-full bg-white transition-transform mx-0.5 ${mqttEnabled() ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            <Show when={mqttEnabled()}>
              <div class="space-y-1">
                <For each={mqttServers()}>
                  {(url, i) => (
                    <div class="flex items-center justify-between gap-1 py-0.5">
                      <span class="text-[11px] text-surface-400 truncate" title={url}>{hostname(url)}</span>
                      <button
                        onClick={() => removeServer('mqtt', i())}
                        class="text-[10px] text-surface-500 hover:text-error cursor-pointer px-1"
                      >x</button>
                    </div>
                  )}
                </For>
                <Show when={addingTo() === 'mqtt'}>
                  <div class="flex gap-1 mt-1">
                    <input
                      class="flex-1 bg-surface-900 border border-surface-600 rounded px-2 py-1 text-[11px] text-surface-200 placeholder:text-surface-500"
                      placeholder="wss://broker.example.com:8884/mqtt"
                      value={newServer()}
                      onInput={(e) => setNewServer(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addServer('mqtt')}
                    />
                    <button onClick={() => addServer('mqtt')} class="text-[10px] text-primary-400 hover:text-primary-300 cursor-pointer px-1">Add</button>
                    <button onClick={() => { setAddingTo(null); setNewServer(''); }} class="text-[10px] text-surface-500 cursor-pointer px-1">Cancel</button>
                  </div>
                </Show>
                <Show when={addingTo() !== 'mqtt'}>
                  <button
                    onClick={() => setAddingTo('mqtt')}
                    class="text-[10px] text-primary-400 hover:text-primary-300 cursor-pointer mt-0.5"
                  >+ Add server</button>
                </Show>
              </div>
            </Show>
          </div>

          {/* BitTorrent */}
          <div class="px-3 py-2.5 border-b border-surface-700/50">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-surface-300">BitTorrent Signaling</span>
              <button
                onClick={() => setTorrentEnabled(!torrentEnabled())}
                class={`w-9 h-5 rounded-full transition-colors cursor-pointer ${torrentEnabled() ? 'bg-primary-600' : 'bg-surface-600'}`}
              >
                <span class={`block w-3.5 h-3.5 rounded-full bg-white transition-transform mx-0.5 ${torrentEnabled() ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            <Show when={torrentEnabled()}>
              <div class="space-y-1">
                <For each={torrentServers()}>
                  {(url, i) => (
                    <div class="flex items-center justify-between gap-1 py-0.5">
                      <span class="text-[11px] text-surface-400 truncate" title={url}>{hostname(url)}</span>
                      <button
                        onClick={() => removeServer('torrent', i())}
                        class="text-[10px] text-surface-500 hover:text-error cursor-pointer px-1"
                      >x</button>
                    </div>
                  )}
                </For>
                <Show when={addingTo() === 'torrent'}>
                  <div class="flex gap-1 mt-1">
                    <input
                      class="flex-1 bg-surface-900 border border-surface-600 rounded px-2 py-1 text-[11px] text-surface-200 placeholder:text-surface-500"
                      placeholder="wss://tracker.example.com"
                      value={newServer()}
                      onInput={(e) => setNewServer(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addServer('torrent')}
                    />
                    <button onClick={() => addServer('torrent')} class="text-[10px] text-primary-400 hover:text-primary-300 cursor-pointer px-1">Add</button>
                    <button onClick={() => { setAddingTo(null); setNewServer(''); }} class="text-[10px] text-surface-500 cursor-pointer px-1">Cancel</button>
                  </div>
                </Show>
                <Show when={addingTo() !== 'torrent'}>
                  <button
                    onClick={() => setAddingTo('torrent')}
                    class="text-[10px] text-primary-400 hover:text-primary-300 cursor-pointer mt-0.5"
                  >+ Add server</button>
                </Show>
              </div>
            </Show>
          </div>

          {/* TURN Providers */}
          <div class="px-3 py-2.5 border-b border-surface-700/50">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-surface-300">TURN Relay Servers</span>
              <span class="text-[10px] text-surface-500">
                {turnProviders().filter(p => p.enabled).length}/{turnProviders().length} enabled
              </span>
            </div>
            <div class="space-y-1">
              <For each={turnProviders()}>
                {(provider) => (
                  <div class="flex items-center justify-between gap-1 py-0.5">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <button
                        onClick={() => toggleTurnProvider(provider.id)}
                        class={`w-3.5 h-3.5 rounded border shrink-0 cursor-pointer transition-colors ${
                          provider.enabled
                            ? 'bg-purple-600 border-purple-500'
                            : 'bg-surface-700 border-surface-600'
                        }`}
                      >
                        <Show when={provider.enabled}>
                          <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none">
                            <path d="M4 8l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </Show>
                      </button>
                      <div class="min-w-0">
                        <span class={`text-[11px] truncate block ${provider.enabled ? 'text-surface-300' : 'text-surface-500'}`}>
                          {provider.label}
                        </span>
                        <span class="text-[9px] text-surface-600 truncate block">
                          {hostname(provider.urls[0])}
                          {provider.credentialType === 'hmac-openrelay' ? ' (HMAC)' : provider.credentialType === 'static' ? ' (static)' : ''}
                        </span>
                      </div>
                    </div>
                    <Show when={!provider.builtin}>
                      <button
                        onClick={() => removeTurnProvider(provider.id)}
                        class="text-[10px] text-surface-500 hover:text-error cursor-pointer px-1 shrink-0"
                      >x</button>
                    </Show>
                  </div>
                )}
              </For>

              <Show when={addingTo() === 'turn'}>
                <div class="space-y-1 mt-1.5 pl-0.5">
                  <input
                    class="w-full bg-surface-900 border border-surface-600 rounded px-2 py-1 text-[11px] text-surface-200 placeholder:text-surface-500"
                    placeholder="turn:your-server.com:443?transport=tcp"
                    value={newTurnUrl()}
                    onInput={(e) => setNewTurnUrl(e.currentTarget.value)}
                  />
                  <input
                    class="w-full bg-surface-900 border border-surface-600 rounded px-2 py-1 text-[11px] text-surface-200 placeholder:text-surface-500"
                    placeholder="Username (optional)"
                    value={newTurnUser()}
                    onInput={(e) => setNewTurnUser(e.currentTarget.value)}
                  />
                  <input
                    class="w-full bg-surface-900 border border-surface-600 rounded px-2 py-1 text-[11px] text-surface-200 placeholder:text-surface-500"
                    placeholder="Credential (optional)"
                    type="password"
                    value={newTurnCred()}
                    onInput={(e) => setNewTurnCred(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTurnProvider()}
                  />
                  <div class="flex gap-1">
                    <button onClick={addTurnProvider} class="text-[10px] text-primary-400 hover:text-primary-300 cursor-pointer px-1">Add</button>
                    <button onClick={() => { setAddingTo(null); setNewTurnUrl(''); setNewTurnUser(''); setNewTurnCred(''); }} class="text-[10px] text-surface-500 cursor-pointer px-1">Cancel</button>
                  </div>
                </div>
              </Show>
              <Show when={addingTo() !== 'turn'}>
                <button
                  onClick={() => setAddingTo('turn')}
                  class="text-[10px] text-primary-400 hover:text-primary-300 cursor-pointer mt-0.5"
                >+ Add custom TURN server</button>
              </Show>
            </div>
          </div>

          {/* Cloudflare TURN Setup */}
          <div class="px-3 py-2.5 border-b border-surface-700/50">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium text-surface-300">Cloudflare TURN</span>
              <Show when={cfConfigured()} fallback={
                <button
                  onClick={() => setShowCfSetup(!showCfSetup())}
                  class="text-[10px] font-medium text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  {showCfSetup() ? 'Hide' : 'Setup'}
                </button>
              }>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-success">Configured</span>
                  <button onClick={handleCfRemove} class="text-[10px] text-surface-500 hover:text-error cursor-pointer">Remove</button>
                </div>
              </Show>
            </div>
            <p class="text-[10px] text-surface-500 mb-2">1 TB/month free. Best reliability (global anycast).</p>

            <Show when={showCfSetup()}>
              <div class="space-y-2 bg-surface-900/50 rounded-lg p-2">
                <div class="text-[10px] text-surface-400 space-y-1">
                  <p>1. Create a free <a href="https://dash.cloudflare.com/sign-up" target="_blank" rel="noopener" class="text-primary-400 underline">Cloudflare account</a></p>
                  <p>2. Go to Dashboard &rarr; Calls &rarr; TURN Keys &rarr; Create Key</p>
                  <p>3. Choose a setup method below:</p>
                </div>

                <div class="flex gap-2">
                  <button
                    onClick={() => setCfMode('worker')}
                    class={`text-[10px] px-2 py-1 rounded cursor-pointer ${cfMode() === 'worker' ? 'bg-purple-500/20 text-purple-400' : 'bg-surface-700 text-surface-400'}`}
                  >Worker URL</button>
                  <button
                    onClick={() => setCfMode('direct')}
                    class={`text-[10px] px-2 py-1 rounded cursor-pointer ${cfMode() === 'direct' ? 'bg-purple-500/20 text-purple-400' : 'bg-surface-700 text-surface-400'}`}
                  >Direct API</button>
                </div>

                <Show when={cfMode() === 'worker'}>
                  <div class="space-y-1">
                    <p class="text-[9px] text-surface-500">Deploy the Worker code, then paste your Worker URL:</p>
                    <input
                      class="w-full bg-surface-900 border border-surface-600 rounded px-2 py-1 text-[11px] text-surface-200 placeholder:text-surface-500"
                      placeholder="https://your-turn-proxy.workers.dev"
                      value={cfWorkerUrl()}
                      onInput={(e) => setCfWorkerUrl(e.currentTarget.value)}
                    />
                    <details class="text-[9px] text-surface-500">
                      <summary class="cursor-pointer text-primary-400">View Worker code</summary>
                      <pre class="mt-1 bg-surface-900 rounded p-2 overflow-x-auto text-[8px] leading-tight max-h-32 overflow-y-auto">{WORKER_SOURCE_CODE}</pre>
                    </details>
                  </div>
                </Show>

                <Show when={cfMode() === 'direct'}>
                  <div class="space-y-1">
                    <p class="text-[9px] text-surface-500">Paste your TURN Key ID and API Token (may fail due to CORS):</p>
                    <input
                      class="w-full bg-surface-900 border border-surface-600 rounded px-2 py-1 text-[11px] text-surface-200 placeholder:text-surface-500"
                      placeholder="TURN Key ID"
                      value={cfKeyId()}
                      onInput={(e) => setCfKeyId(e.currentTarget.value)}
                    />
                    <input
                      class="w-full bg-surface-900 border border-surface-600 rounded px-2 py-1 text-[11px] text-surface-200 placeholder:text-surface-500"
                      placeholder="API Token"
                      type="password"
                      value={cfApiToken()}
                      onInput={(e) => setCfApiToken(e.currentTarget.value)}
                    />
                  </div>
                </Show>

                <button
                  onClick={handleCfTest}
                  disabled={cfTesting()}
                  class="w-full text-[10px] font-medium text-purple-400 hover:text-purple-300 disabled:text-surface-600 bg-purple-500/10 hover:bg-purple-500/15 rounded py-1.5 cursor-pointer disabled:cursor-wait transition-colors"
                >
                  {cfTesting() ? 'Testing...' : 'Test & Save'}
                </button>

                <Show when={cfTestResult()}>
                  <div class={`text-[10px] ${cfTestResult()!.startsWith('OK') ? 'text-success' : 'text-error'}`}>
                    {cfTestResult()}
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Auto-Reconnect */}
          <div class="px-3 py-2.5 border-b border-surface-700/50">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-xs font-medium text-surface-300">Auto-Reconnect</span>
                <p class="text-[10px] text-surface-500 mt-0.5">Automatically retry failed relay connections</p>
              </div>
              <button
                onClick={() => setAutoReconnect(!autoReconnect())}
                class={`w-9 h-5 rounded-full transition-colors cursor-pointer ${autoReconnect() ? 'bg-primary-600' : 'bg-surface-600'}`}
              >
                <span class={`block w-3.5 h-3.5 rounded-full bg-white transition-transform mx-0.5 ${autoReconnect() ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Validation warning */}
        <Show when={!isValid()}>
          <div class="px-3 py-1.5 text-[10px] text-error">
            At least one signaling strategy must be enabled.
          </div>
        </Show>

        {/* Actions */}
        <div class="flex items-center justify-between px-3 py-2.5 border-t border-surface-700">
          <button
            onClick={handleReset}
            class="text-[11px] text-surface-400 hover:text-surface-200 cursor-pointer"
          >
            Reset Defaults
          </button>
          <Button size="sm" onClick={handleApply} disabled={!isValid()}>
            {props.showReconnect ? 'Apply & Reconnect' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
