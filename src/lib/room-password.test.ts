import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createYDoc } from './yjs-doc';
import { setRoomPassword, hasRoomPassword, verifyRoomPassword } from './room-password';

function makeDoc() {
  return createYDoc({
    roomCode: 'test-room-0000',
    roomName: 'Test Room',
    createdAt: Date.now(),
    settings: { maxParticipants: 6 },
  }, true);
}

describe('Room Password', () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = makeDoc();
  });

  it('has no password by default', () => {
    expect(hasRoomPassword(doc)).toBe(false);
  });

  it('returns true for verify when no password set', async () => {
    expect(await verifyRoomPassword(doc, 'anything')).toBe(true);
  });

  it('sets and verifies a password', async () => {
    await setRoomPassword(doc, 'secret123');
    expect(hasRoomPassword(doc)).toBe(true);
    expect(await verifyRoomPassword(doc, 'secret123')).toBe(true);
    expect(await verifyRoomPassword(doc, 'wrong')).toBe(false);
  });

  it('produces consistent hashes', async () => {
    await setRoomPassword(doc, 'test');
    const hash1 = doc.getMap('meta').get('passwordHash') as string;

    const doc2 = makeDoc();
    await setRoomPassword(doc2, 'test');
    const hash2 = doc2.getMap('meta').get('passwordHash') as string;

    expect(hash1).toBe(hash2);
  });
});
