import type { Awareness } from 'y-protocols/awareness';

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { ideal: 15 },
};

export async function requestMedia(options: {
  audio: boolean;
  video: boolean;
}): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: options.audio,
    video: options.video ? VIDEO_CONSTRAINTS : false,
  });
}

export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop());
}

export function setTrackEnabled(
  stream: MediaStream,
  kind: 'audio' | 'video',
  enabled: boolean,
): void {
  stream.getTracks()
    .filter(t => t.kind === kind)
    .forEach(t => { t.enabled = enabled; });
}

export function getStreamState(stream: MediaStream | null): {
  hasAudio: boolean;
  hasVideo: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
} {
  if (!stream) {
    return { hasAudio: false, hasVideo: false, audioEnabled: false, videoEnabled: false };
  }
  const audioTracks = stream.getAudioTracks();
  const videoTracks = stream.getVideoTracks();
  return {
    hasAudio: audioTracks.length > 0,
    hasVideo: videoTracks.length > 0,
    audioEnabled: audioTracks.some(t => t.enabled),
    videoEnabled: videoTracks.some(t => t.enabled),
  };
}

export function setMediaAwareness(
  awareness: Awareness,
  state: { audioEnabled: boolean; videoEnabled: boolean },
): void {
  awareness.setLocalStateField('media', state);
}

export function getPeerMediaStates(
  awareness: Awareness,
): Map<string, { audioEnabled: boolean; videoEnabled: boolean }> {
  const result = new Map<string, { audioEnabled: boolean; videoEnabled: boolean }>();
  awareness.getStates().forEach((state, clientId) => {
    if (state.media) {
      result.set(String(clientId), state.media);
    }
  });
  return result;
}
