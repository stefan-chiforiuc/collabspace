import { For, Show } from 'solid-js';
import type { NotificationEvent } from '../lib/notifications';
import { NOTIFICATION_ICONS, NOTIFICATION_ACTIONS } from '../lib/notifications';

interface NotificationToastProps {
  notifications: NotificationEvent[];
  onAction: (notification: NotificationEvent) => void;
  onDismiss: (id: string) => void;
}

export default function NotificationToast(props: NotificationToastProps) {
  return (
    <Show when={props.notifications.length > 0}>
      <div class="fixed top-14 right-3 z-50 flex flex-col gap-2 w-72 sm:w-80 pointer-events-none">
        <For each={props.notifications}>
          {(notif) => (
            <div class="pointer-events-auto bg-surface-800/95 backdrop-blur-sm border border-surface-700 border-l-2 border-l-primary-500 rounded-lg shadow-2xl animate-slide-in-right overflow-hidden">
              <div class="flex items-start gap-2 px-3 py-2.5">
                <span class="text-base shrink-0 mt-0.5">{NOTIFICATION_ICONS[notif.type]}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[12px] text-surface-200 font-medium leading-tight">{notif.message}</p>
                  <button
                    onClick={() => props.onAction(notif)}
                    class="text-[11px] text-primary-400 hover:text-primary-300 font-medium mt-1 cursor-pointer"
                  >
                    {NOTIFICATION_ACTIONS[notif.type]}
                  </button>
                </div>
                <button
                  onClick={() => props.onDismiss(notif.id)}
                  class="w-5 h-5 flex items-center justify-center rounded text-surface-500 hover:text-surface-300 hover:bg-surface-700 cursor-pointer transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              {/* Auto-dismiss progress bar */}
              <div class="h-0.5 bg-surface-700">
                <div class="h-full bg-primary-500/50 animate-shrink-width" />
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
