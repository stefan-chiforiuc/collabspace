import { describe, it, expect } from 'vitest';
import {
  deriveRoomKey,
  encryptPayload,
  decryptPayload,
  createCanary,
  verifyCanary,
} from './room-crypto';

describe('room-crypto', () => {
  it('derives the same key for the same (code, password) pair', async () => {
    const k1 = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const k2 = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const msg = new TextEncoder().encode('hello world');
    const ct = await encryptPayload(k1, msg);
    const pt = await decryptPayload(k2, ct);
    expect(pt).not.toBeNull();
    expect(new TextDecoder().decode(pt!)).toBe('hello world');
  });

  it('derives a different key for a different password', async () => {
    const k1 = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const k2 = await deriveRoomKey('brave-tiger-1234', 'wrong');
    const ct = await encryptPayload(k1, new TextEncoder().encode('secret'));
    const pt = await decryptPayload(k2, ct);
    expect(pt).toBeNull();
  });

  it('derives a different key for a different room code', async () => {
    const k1 = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const k2 = await deriveRoomKey('brave-tiger-9999', 'hunter2');
    const ct = await encryptPayload(k1, new TextEncoder().encode('secret'));
    const pt = await decryptPayload(k2, ct);
    expect(pt).toBeNull();
  });

  it('uses fresh IV on each encryption (ciphertexts differ)', async () => {
    const key = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const msg = new TextEncoder().encode('stable input');
    const ct1 = await encryptPayload(key, msg);
    const ct2 = await encryptPayload(key, msg);
    expect(ct1).not.toEqual(ct2);
  });

  it('fails to decrypt tampered ciphertext', async () => {
    const key = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const msg = new TextEncoder().encode('important');
    const ct = await encryptPayload(key, msg);
    // Flip a single bit in the ciphertext body (past the 12-byte IV)
    ct[20] ^= 0x01;
    const pt = await decryptPayload(key, ct);
    expect(pt).toBeNull();
  });

  it('rejects truncated payloads', async () => {
    const key = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const tiny = new Uint8Array(5);
    expect(await decryptPayload(key, tiny)).toBeNull();
  });

  it('canary verifies under matching key', async () => {
    const k1 = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const k2 = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const canary = await createCanary(k1);
    expect(await verifyCanary(k2, canary)).toBe(true);
  });

  it('canary fails under mismatched key', async () => {
    const k1 = await deriveRoomKey('brave-tiger-1234', 'hunter2');
    const k2 = await deriveRoomKey('brave-tiger-1234', 'different');
    const canary = await createCanary(k1);
    expect(await verifyCanary(k2, canary)).toBe(false);
  });

  it('no-password rooms derive a stable key from roomCode alone', async () => {
    const k1 = await deriveRoomKey('brave-tiger-1234', undefined);
    const k2 = await deriveRoomKey('brave-tiger-1234', '');
    const canary = await createCanary(k1);
    expect(await verifyCanary(k2, canary)).toBe(true);
  });
});
