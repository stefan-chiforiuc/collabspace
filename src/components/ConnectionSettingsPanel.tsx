import { createSignal, Show, For } from 'solid-js';
import type { ConnectionSettings, TurnProvider } from '../lib/connection-settings';
import { getDefaultSettings, genTurnId } from '../lib/connection-settings';
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
