export type TurnMode = 'auto' | 'custom' | 'disabled';

export type TurnProvider = {
  id: string;
  label: string;
  urls: string[];
  credentialType: 'hmac-openrelay' | 'static' | 'none';
  username?: string;
  credential?: string;
  enabled: boolean;
  builtin?: boolean;   // built-in providers can be disabled but not deleted
};

export type ConnectionSettings = {
  mqtt: { enabled: boolean; servers: string[] };
  torrent: { enabled: boolean; servers: string[] };
  turn: {
    // New multi-provider model
    providers: TurnProvider[];
  };
  autoReconnect: boolean;
};

let nextCustomId = 1;
export function genTurnId(): string {
  return `custom-${Date.now()}-${nextCustomId++}`;
}

/** Built-in TURN providers — all use the Metered Open Relay shared-secret HMAC. */
export const DEFAULT_TURN_PROVIDERS: TurnProvider[] = [
  {
    id: 'openrelay-global',
    label: 'Open Relay (Global)',
    urls: [
      'turns:global.relay.metered.ca:443?transport=tcp',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443?transport=tcp',
    ],
    credentialType: 'hmac-openrelay',
    enabled: true,
    builtin: true,
  },
  {
    id: 'openrelay-us',
    label: 'Open Relay (US)',
    urls: [
      'turns:us-0.relay.metered.ca:443?transport=tcp',
      'turn:us-0.relay.metered.ca:80?transport=tcp',
      'turn:us-0.relay.metered.ca:443?transport=tcp',
    ],
    credentialType: 'hmac-openrelay',
    enabled: true,
    builtin: true,
  },
  {
    id: 'openrelay-eu',
    label: 'Open Relay (EU)',
    urls: [
      'turns:eu-0.relay.metered.ca:443?transport=tcp',
      'turn:eu-0.relay.metered.ca:80?transport=tcp',
      'turn:eu-0.relay.metered.ca:443?transport=tcp',
    ],
    credentialType: 'hmac-openrelay',
    enabled: true,
    builtin: true,
  },
  {
    id: 'openrelay-ap',
    label: 'Open Relay (Asia-Pacific)',
    urls: [
      'turns:ap-southeast-1.relay.metered.ca:443?transport=tcp',
      'turn:ap-southeast-1.relay.metered.ca:80?transport=tcp',
      'turn:ap-southeast-1.relay.metered.ca:443?transport=tcp',
    ],
    credentialType: 'hmac-openrelay',
    enabled: true,
    builtin: true,
  },
];

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
    turn: { providers: DEFAULT_TURN_PROVIDERS.map(p => ({ ...p })) },
    autoReconnect: true,
  };
}

/**
 * Migrate old settings format (turn.mode) to new multi-provider format.
 */
function migrateSettings(raw: Record<string, unknown>): ConnectionSettings {
  const settings = raw as ConnectionSettings & { turn?: Record<string, unknown> };

  // Migrate old turn.mode format to new providers format
  if (settings.turn && !Array.isArray((settings.turn as Record<string, unknown>).providers)) {
    const oldTurn = settings.turn as { mode?: string; customUrl?: string; username?: string; credential?: string };
    const providers = DEFAULT_TURN_PROVIDERS.map(p => ({ ...p }));

    if (oldTurn.mode === 'disabled') {
      providers.forEach(p => p.enabled = false);
    }

    if (oldTurn.mode === 'custom' && oldTurn.customUrl) {
      providers.forEach(p => p.enabled = false);
      providers.push({
        id: genTurnId(),
        label: 'Custom',
        urls: [oldTurn.customUrl],
        credentialType: 'static',
        username: oldTurn.username,
        credential: oldTurn.credential,
        enabled: true,
      });
    }

    settings.turn = { providers };
  }

  return settings as ConnectionSettings;
}

export function getConnectionSettings(): ConnectionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSettings();
    const parsed = migrateSettings(JSON.parse(raw));
    // Validate: at least one strategy must be enabled
    if (!parsed.mqtt?.enabled && !parsed.torrent?.enabled) {
      parsed.mqtt = { enabled: true, servers: [...DEFAULT_MQTT_SERVERS] };
    }
    // Backward compatibility: default autoReconnect to true if missing
    if (parsed.autoReconnect === undefined) {
      parsed.autoReconnect = true;
    }
    // Ensure turn.providers exists
    if (!parsed.turn?.providers) {
      parsed.turn = { providers: DEFAULT_TURN_PROVIDERS.map(p => ({ ...p })) };
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
