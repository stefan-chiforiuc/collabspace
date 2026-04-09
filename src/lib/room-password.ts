import * as Y from 'yjs';

/**
 * Set a room password in the Yjs doc meta.
 * Password is hashed client-side (SHA-256) before storing.
 */
export async function setRoomPassword(doc: Y.Doc, password: string): Promise<void> {
  const hash = await hashPassword(password);
  const meta = doc.getMap('meta');
  meta.set('passwordHash', hash);
}

/**
 * Check if the room has a password set.
 */
export function hasRoomPassword(doc: Y.Doc): boolean {
  const meta = doc.getMap('meta');
  return !!meta.get('passwordHash');
}

/**
 * Verify a password against the stored hash.
 */
export async function verifyRoomPassword(doc: Y.Doc, password: string): Promise<boolean> {
  const meta = doc.getMap('meta');
  const storedHash = meta.get('passwordHash') as string | undefined;
  if (!storedHash) return true; // No password set = always valid

  const hash = await hashPassword(password);
  return hash === storedHash;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
