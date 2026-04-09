import { ADJECTIVES, NOUNS } from './constants';

function secureRandom(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export function generateRoomCode(): string {
  const adj = ADJECTIVES[secureRandom(ADJECTIVES.length)];
  const noun = NOUNS[secureRandom(NOUNS.length)];
  const num = String(secureRandom(10000)).padStart(4, '0');
  return `${adj}-${noun}-${num}`;
}

const ROOM_CODE_RE = /^[a-z]+-[a-z]+-\d{4}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_RE.test(code);
}
