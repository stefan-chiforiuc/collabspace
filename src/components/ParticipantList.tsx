import { For } from 'solid-js';
import type { Participant } from '../lib/types';
import { MAX_PARTICIPANTS } from '../lib/constants';

interface ParticipantListProps {
  participants: Participant[];
}

export default function ParticipantList(props: ParticipantListProps) {
  return (
    <div class="p-4 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-semibold text-surface-400 uppercase tracking-wider">
          Participants
        </h2>
        <span class="text-xs text-surface-500">
          {props.participants.length}/{MAX_PARTICIPANTS}
        </span>
      </div>

      <ul class="space-y-2" role="list">
        <For each={props.participants}>
          {(participant) => (
            <li class="flex items-center gap-2.5">
              <span
                class="w-2.5 h-2.5 rounded-full shrink-0"
                classList={{
                  'animate-pulse': participant.status === 'disconnected',
                }}
                style={{ "background-color": participant.color }}
              />
              <span class="text-sm text-surface-200 truncate">
                {participant.name}
              </span>
            </li>
          )}
        </For>
      </ul>

      {props.participants.length === 0 && (
        <p class="text-xs text-surface-500 italic">Waiting for peers...</p>
      )}
    </div>
  );
}
