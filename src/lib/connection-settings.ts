export type TurnMode = 'auto' | 'custom' | 'disabled';

export type ConnectionSettings = {
  mqtt: { enabled: boolean; servers: string[] };
  torrent: { enabled: boolean; servers: string[] };
  turn: {
    mode: TurnMode;
    customUrl?: string;
    username?: string;
    credential?: string;
  };
};

export const DEFAULT_MQTT_SERVERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
  'wss://public:public@public.cloud.shiftr.io',
  'wss://broker-cn.emqx.io:8084/mqtt',
];

export const DEFAULT_TORRENT_SERVERS = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.files.fm:7073/announce',
];

const STORAGE_KEY = 'collabspace:connectionSettings';

export function getDefaultSettings(): ConnectionSettings {
  return {
    mqtt: { enabled: true, servers: [...DEFAULT_MQTT_SERVERS] },
    torrent: { enabled: true, servers: [...DEFAULT_TORRENT_SERVERS] },
    turn: { mode: 'auto' },
  };
}

export function getConnectionSettings(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSettings();
    const parsed = JSON.parse(raw) as ConnectionSettings;
    // Validate: at least one strategy must be enabled
    if (!parsed.mqtt?.enabled && !parsed.torrent?.enabled) {
      parsed.mqtt = { enabled: true, servers: [...DEFAULT_MQTT_SERVERS] };
    }
    return parsed;
  } catch {
    return getDefaultSettings();
  }
}

export function saveConnectionSettings(settings: ConnectionSettings): void {
  // Enforce: at least one strategy must be enabled
  if (!settings.mqtt.enabled && !settings.torrent.enabled) {
    settings.mqtt.enabled = true;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable
  }
}
