import { createSignal, onCleanup } from 'solid-js';
import type { Awareness } from 'y-protocols/awareness';
import { getParticipantList } from '../lib/participants';
import type { Participant } from '../lib/types';

export function useParticipants(awareness: Awareness) {
  const [participants, setParticipants] = createSignal<Participant[]>([]);

  const update = () => {
    setParticipants(getParticipantList(awareness));
  };

  awareness.on('change', update);
  update();

  onCleanup(() => awareness.off('change', update));

  return participants;
}
