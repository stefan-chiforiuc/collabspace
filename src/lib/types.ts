export interface Participant {
  peerId: string;
  name: string;
  color: string;
  joinedAt: number;
  status: 'connected' | 'disconnected';
}

export interface ChatMessage {
  id: string;
  author: string;
  authorName: string;
  text: string;
  timestamp: number;
  type: 'user' | 'system';
  reactions: Record<string, string[]>;
}

export interface RoomMeta {
  roomCode: string;
  roomName: string;
  createdAt: number;
  settings: {
    maxParticipants: number;
  };
}

// --- Polls (FR-03) ---

export type PollType = 'single' | 'multi';

export interface Poll {
  id: string;
  question: string;
  options: string[];
  type: PollType;
  votes: Record<string, number | number[]>; // peerId -> optionIndex (single) or indices (multi)
  createdBy: string;
  createdByName: string;
  createdAt: number;
  closed: boolean;
  closedBy?: string;
}

// --- Planning Poker (FR-04) ---

export type CardSet = 'fibonacci' | 'tshirt' | 'powers' | 'custom';

export const CARD_SETS: Record<CardSet, string[]> = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '\u2615'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '\u2615'],
  powers: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '\u2615'],
  custom: [],
};

export interface PokerRound {
  topic: string;
  cardSet: CardSet;
  votes: Record<string, string>; // peerId -> card value
  revealed: boolean;
  round: number;
  startedBy: string;
  startedByName: string;
  startedAt: number;
}

// --- Timer (FR-06) ---

export type TimerMode = 'running' | 'paused' | 'stopped';

export interface TimerState {
  duration: number; // total milliseconds
  startedAt: number; // timestamp when started/resumed
  pausedRemaining: number; // ms remaining when paused
  mode: TimerMode;
  startedBy: string;
  startedByName: string;
}

// --- Reactions (FR-07) ---

export interface Reaction {
  id: string;
  emoji: string;
  peerId: string;
  peerName: string;
  timestamp: number;
}
