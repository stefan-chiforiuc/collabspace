import { For, Show, createEffect, onMount } from 'solid-js';
import type { Participant } from '../lib/types';

interface VideoGridProps {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: Participant[];
  localPeerId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  peerMediaState: Map<string, { audioEnabled: boolean; videoEnabled: boolean }>;
}

function VideoTile(props: {
  stream: MediaStream;
  name: string;
  color: string;
  muted?: boolean;
  mirrored?: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
}) {
  let videoEl: HTMLVideoElement | undefined;

  const attachStream = () => {
    if (videoEl && props.stream) {
      videoEl.srcObject = props.stream;
    }
  };

  onMount(attachStream);
  createEffect(attachStream);

  return (
    <div class="relative bg-surface-900 rounded-lg overflow-hidden aspect-video">
      <Show when={props.videoEnabled} fallback={
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold text-white" style={{ "background-color": props.color }}>
            {props.name.charAt(0).toUpperCase()}
          </div>
        </div>
      }>
        <video
          ref={videoEl}
          autoplay
          playsinline
          muted={props.muted}
          class={`w-full h-full object-cover ${props.mirrored ? 'scale-x-[-1]' : ''}`}
        />
      </Show>
      {/* Name overlay */}
      <div class="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/60 to-transparent">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full shrink-0" style={{ "background-color": props.color }} />
            <span class="text-[10px] text-white font-medium truncate">{props.name}</span>
          </div>
          <Show when={!props.audioEnabled}>
            <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" class="text-error shrink-0">
              <path fill-rule="evenodd" d="M13 8V4a3 3 0 00-6 0v4a3 3 0 006 0zm-1 5.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 005 5.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-3.07z" clip-rule="evenodd"/>
              <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14z"/>
            </svg>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default function VideoGrid(props: VideoGridProps) {
  const totalStreams = () => {
    let count = props.localStream ? 1 : 0;
    count += props.remoteStreams.size;
    return count;
  };

  const gridCols = () => {
    const n = totalStreams();
    if (n <= 1) return 'grid-cols-1';
    if (n <= 2) return 'grid-cols-2';
    if (n <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  const localParticipant = () =>
    props.participants.find(p => p.peerId === props.localPeerId);

  const getPeerParticipant = (peerId: string) =>
    props.participants.find(p => p.peerId === peerId);

  return (
    <div class="border-b border-surface-700 bg-surface-900/50 animate-fade-in">
      <div class={`grid ${gridCols()} gap-1 p-1 max-h-[40vh]`}>
        {/* Local video */}
        <Show when={props.localStream}>
          <VideoTile
            stream={props.localStream!}
            name={localParticipant()?.name || 'You'}
            color={localParticipant()?.color || '#818cf8'}
            muted={true}
            mirrored={true}
            audioEnabled={props.audioEnabled}
            videoEnabled={props.videoEnabled}
          />
        </Show>
        {/* Remote videos */}
        <For each={[...props.remoteStreams.entries()]}>
          {([peerId, stream]) => {
            const p = () => getPeerParticipant(peerId);
            const mediaState = () => props.peerMediaState.get(peerId);
            return (
              <VideoTile
                stream={stream}
                name={p()?.name || 'Peer'}
                color={p()?.color || '#818cf8'}
                audioEnabled={mediaState()?.audioEnabled ?? true}
                videoEnabled={mediaState()?.videoEnabled ?? true}
              />
            );
          }}
        </For>
      </div>
    </div>
  );
}
