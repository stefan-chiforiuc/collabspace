import type { Awareness } from 'y-protocols/awareness';
import type { Participant } from './types';
import { PARTICIPANT_COLORS } from '../design/tokens';

export function setLocalAwareness(
  awareness: Awareness,
  name: string,
  color: string,
): void {
  awareness.setLocalStateField('user', {
    name,
    color,
    joinedAt: Date.now(),
    status: 'connected',
  });
}

export function getParticipantList(awareness: Awareness): Participant[] {
  const participants: Participant[] = [];
  const states = awareness.getStates();

  states.forEach((state, clientId) => {
    if (!state.user) return;
    participants.push({
      peerId: String(clientId),
      name: state.user.name || 'Anonymous',
      color: state.user.color || PARTICIPANT_COLORS[0],
      joinedAt: state.user.joinedAt || 0,
      status: state.user.status || 'connected',
    });
  });

  return participants.sort((a, b) => a.joinedAt - b.joinedAt);
}

export function assignColor(index: number): string {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}
