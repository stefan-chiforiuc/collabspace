import { createSignal, createEffect, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Awareness } from 'y-protocols/awareness';
import type { TrysteroRoom } from '../lib/trystero';
import {
  requestMedia,
  stopStream,
  setTrackEnabled,
  setMediaAwareness,
  getPeerMediaStates,
} from '../lib/media';

export function useMedia(
  trysteroRoom: Accessor<TrysteroRoom | null>,
  awareness: Awareness,
  localPeerId: string,
) {
  const [localStream, setLocalStream] = createSignal<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = createSignal<Map<string, MediaStream>>(new Map());
  const [audioEnabled, setAudioEnabled] = createSignal(false);
  const [videoEnabled, setVideoEnabled] = createSignal(false);
  const [mediaError, setMediaError] = createSignal<string | null>(null);
  const [peerMediaState, setPeerMediaState] = createSignal<Map<string, { audioEnabled: boolean; videoEnabled: boolean }>>(new Map());

  // Track awareness changes for peer media state
  const updatePeerMedia = () => {
    setPeerMediaState(getPeerMediaStates(awareness));
  };
  awareness.on('change', updatePeerMedia);
  updatePeerMedia();

  // React to trysteroRoom changes (reconnect)
  createEffect(() => {
    const room = trysteroRoom();
    if (!room) {
      setRemoteStreams(new Map());
      return;
    }

    // Register stream handler
    room.onPeerStream((stream: MediaStream, peerId: string) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.set(peerId, stream);
        return next;
      });
    });

    // Re-add local stream to new room after reconnect
    const stream = localStream();
    if (stream) {
      room.addStream(stream);
    }
  });

  async function toggleAudio() {
    const stream = localStream();
    const room = trysteroRoom();

    if (!stream) {
      // Start audio
      try {
        setMediaError(null);
        const s = await requestMedia({ audio: true, video: false });
        setLocalStream(s);
        setAudioEnabled(true);
        setMediaAwareness(awareness, { audioEnabled: true, videoEnabled: videoEnabled() });
        if (room) room.addStream(s);
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : 'Microphone access denied');
      }
    } else {
      // Toggle mute
      const newEnabled = !audioEnabled();
      setTrackEnabled(stream, 'audio', newEnabled);
      setAudioEnabled(newEnabled);
      setMediaAwareness(awareness, { audioEnabled: newEnabled, videoEnabled: videoEnabled() });
    }
  }

  async function toggleVideo() {
    const stream = localStream();
    const room = trysteroRoom();

    if (!stream) {
      // Start video (+ audio)
      try {
        setMediaError(null);
        const s = await requestMedia({ audio: true, video: true });
        setLocalStream(s);
        setAudioEnabled(true);
        setVideoEnabled(true);
        setMediaAwareness(awareness, { audioEnabled: true, videoEnabled: true });
        if (room) room.addStream(s);
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : 'Camera access denied');
      }
    } else if (stream.getVideoTracks().length > 0) {
      // Toggle existing video track
      const newEnabled = !videoEnabled();
      setTrackEnabled(stream, 'video', newEnabled);
      setVideoEnabled(newEnabled);
      setMediaAwareness(awareness, { audioEnabled: audioEnabled(), videoEnabled: newEnabled });
    } else {
      // Add video track to existing audio-only stream
      try {
        setMediaError(null);
        const videoStream = await requestMedia({ audio: false, video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack) {
          stream.addTrack(videoTrack);
          setVideoEnabled(true);
          setMediaAwareness(awareness, { audioEnabled: audioEnabled(), videoEnabled: true });
          // Re-add stream with new track
          if (room) {
            room.removeStream(stream);
            room.addStream(stream);
          }
        }
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : 'Camera access denied');
      }
    }
  }

  function stopAllMedia() {
    const stream = localStream();
    const room = trysteroRoom();
    if (stream) {
      if (room) room.removeStream(stream);
      stopStream(stream);
      setLocalStream(null);
    }
    setAudioEnabled(false);
    setVideoEnabled(false);
    setMediaError(null);
    setMediaAwareness(awareness, { audioEnabled: false, videoEnabled: false });
  }

  // Clean up on peer leave — remove their stream
  createEffect(() => {
    const room = trysteroRoom();
    if (!room) return;
    room.onPeerLeave((peerId: string) => {
      setRemoteStreams(prev => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    });
  });

  onCleanup(() => {
    stopAllMedia();
    awareness.off('change', updatePeerMedia);
  });

  const anyVideoActive = () => {
    if (videoEnabled()) return true;
    for (const [, state] of peerMediaState()) {
      if (state.videoEnabled) return true;
    }
    return false;
  };

  const anyMediaActive = () => {
    if (audioEnabled() || videoEnabled()) return true;
    for (const [, state] of peerMediaState()) {
      if (state.audioEnabled || state.videoEnabled) return true;
    }
    return false;
  };

  return {
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    mediaError,
    peerMediaState,
    toggleAudio,
    toggleVideo,
    stopAllMedia,
    anyVideoActive,
    anyMediaActive,
  };
}
