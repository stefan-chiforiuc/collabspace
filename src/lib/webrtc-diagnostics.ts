/**
 * WebRTC diagnostics — monkey-patches RTCPeerConnection to observe ICE
 * negotiation events that happen inside Trystero.
 *
 * MUST be imported before any Trystero code runs.
 */

export type IceEvent = {
  time: number;
  type: 'ice';
  message: string;
};

const iceLog: IceEvent[] = [];
const MAX_LOG = 200;

function log(msg: string) {
  iceLog.push({ time: Date.now(), type: 'ice', message: msg });
  if (iceLog.length > MAX_LOG) iceLog.shift();
  console.log(`[CollabSpace:ice] ${msg}`);
}

/** Read-only snapshot of the ICE diagnostic log. */
export function getIceLog(): IceEvent[] {
  return [...iceLog];
}

/** Summary stats gathered across all RTCPeerConnections. */
export type IceSummary = {
  peerConnectionsCreated: number;
  hasTurnServers: boolean;
  candidateTypesLocal: Set<string>;
  iceStates: string[];           // most-recent state per connection
  gatheringStates: string[];
  connectionStates: string[];
};

let pcCount = 0;
let _hasTurnServers = false;
const candidateTypesLocal = new Set<string>();
const latestIceState: Record<number, string> = {};
const latestGatherState: Record<number, string> = {};
const latestConnState: Record<number, string> = {};

export function getIceSummary(): IceSummary {
  return {
    peerConnectionsCreated: pcCount,
    hasTurnServers: _hasTurnServers,
    candidateTypesLocal: new Set(candidateTypesLocal),
    iceStates: Object.values(latestIceState),
    gatheringStates: Object.values(latestGatherState),
    connectionStates: Object.values(latestConnState),
  };
}

/**
 * Install the monkey-patch.  Call once, as early as possible (before Trystero
 * imports).  Safe to call in non-browser environments (no-op).
 */
export function installWebRTCDiagnostics() {
  if (typeof globalThis.RTCPeerConnection === 'undefined') return;

  const Original = globalThis.RTCPeerConnection;

  globalThis.RTCPeerConnection = class DiagRTCPeerConnection extends Original {
    private _diagId: number;

    constructor(config?: RTCConfiguration) {
      super(config);
      this._diagId = ++pcCount;
      const id = this._diagId;

      // Log ICE server config
      const iceServers = config?.iceServers ?? [];
      const stunCount = iceServers.filter(s => {
        const url = typeof s.urls === 'string' ? s.urls : s.urls?.[0] ?? '';
        return url.startsWith('stun:');
      }).length;
      const turnCount = iceServers.filter(s => {
        const url = typeof s.urls === 'string' ? s.urls : s.urls?.[0] ?? '';
        return url.startsWith('turn');
      }).length;
      if (turnCount > 0) _hasTurnServers = true;

      log(`PC#${id} created — ${stunCount} STUN, ${turnCount} TURN servers`);
      if (turnCount > 0) {
        const turnUrls = iceServers
          .filter(s => {
            const url = typeof s.urls === 'string' ? s.urls : s.urls?.[0] ?? '';
            return url.startsWith('turn');
          })
          .map(s => typeof s.urls === 'string' ? s.urls : (s.urls as string[])?.[0]);
        log(`PC#${id} TURN: ${turnUrls.join(', ')}`);
      }

      // ICE connection state
      this.addEventListener('iceconnectionstatechange', () => {
        const state = this.iceConnectionState;
        latestIceState[id] = state;
        log(`PC#${id} ICE state: ${state}`);
      });

      // ICE gathering state
      this.addEventListener('icegatheringstatechange', () => {
        const state = this.iceGatheringState;
        latestGatherState[id] = state;
        log(`PC#${id} ICE gathering: ${state}`);
      });

      // Connection state
      this.addEventListener('connectionstatechange', () => {
        const state = this.connectionState;
        latestConnState[id] = state;
        log(`PC#${id} connection: ${state}`);
      });

      // ICE candidates
      this.addEventListener('icecandidate', (e: RTCPeerConnectionIceEvent) => {
        if (e.candidate) {
          // Parse candidate type from the SDP string
          const candidateStr = e.candidate.candidate;
          const typeMatch = candidateStr.match(/typ (\w+)/);
          const ctype = typeMatch?.[1] ?? 'unknown';  // host | srflx | relay
          candidateTypesLocal.add(ctype);
          log(`PC#${id} local candidate: ${ctype} ${candidateStr.slice(0, 80)}`);
        } else {
          log(`PC#${id} ICE candidate gathering complete (null candidate)`);
        }
      });
    }
  };

  // Preserve static properties / prototype identity checks
  Object.defineProperty(globalThis.RTCPeerConnection, 'name', { value: 'RTCPeerConnection' });
  log('WebRTC diagnostics installed');
}
