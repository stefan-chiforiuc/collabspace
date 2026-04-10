interface MediaControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
}

export default function MediaControls(props: MediaControlsProps) {
  return (
    <div class="flex items-center gap-0.5">
      {/* Microphone toggle */}
      <button
        onClick={props.onToggleAudio}
        class={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
          props.audioEnabled
            ? 'bg-success/15 text-success hover:bg-success/25'
            : 'text-surface-400 hover:bg-surface-700/50 hover:text-surface-200'
        }`}
        aria-label={props.audioEnabled ? 'Mute microphone' : 'Enable microphone'}
        aria-pressed={props.audioEnabled}
      >
        {props.audioEnabled ? (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M13 8V4a3 3 0 00-6 0v4a3 3 0 006 0zm-1 5.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 005 5.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-3.07z" clip-rule="evenodd"/>
            <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14z"/>
          </svg>
        )}
      </button>

      {/* Camera toggle */}
      <button
        onClick={props.onToggleVideo}
        class={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
          props.videoEnabled
            ? 'bg-success/15 text-success hover:bg-success/25'
            : 'text-surface-400 hover:bg-surface-700/50 hover:text-surface-200'
        }`}
        aria-label={props.videoEnabled ? 'Stop camera' : 'Start camera'}
        aria-pressed={props.videoEnabled}
      >
        {props.videoEnabled ? (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"/>
            <path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14z"/>
          </svg>
        )}
      </button>
    </div>
  );
}
