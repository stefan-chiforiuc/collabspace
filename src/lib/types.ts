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
