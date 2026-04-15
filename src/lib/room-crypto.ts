/**
 * CollabSpace v2 — Room-level end-to-end encryption.
 *
 * All Yjs sync and awareness payloads are wrapped in AES-GCM at the
 * TrysteroProvider boundary so that neither the MQTT broker nor the
 * BitTorrent tracker nor any passive observer can read document state.
 *
 * The symmetric key is derived from (roomCode, password) via PBKDF2. When
 * no password is set, the roomCode itself is used as the passphrase — this
 * provides no secrecy against anyone who already knows the room code, but
 * keeps the wire format consistent and protects against incidental
 * subscribers who scrape MQTT topics without knowing the code.
 *
 * A fixed-plaintext "canary" encrypted with the same key is broadcast on a
 * dedicated Trystero action so that a joining peer can detect a wrong
 * password explicitly instead of silently failing to apply updates.
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_SALT_PREFIX = 'collabspace-v2-salt:';
const IV_BYTES = 12;
const CANARY_PLAINTEXT = new TextEncoder().encode('COLLABSPACE_V2_CANARY_OK');

/**
 * Derive the room symmetric key from a room code + optional password.
 *
 * The same (roomCode, password) pair always produces the same key, so two
 * peers can independently derive it without any key exchange.
 */
export async function deriveRoomKey(
  roomCode: string,
  password: string | undefined,
): Promise<CryptoKey> {
  const passphrase = (password && password.length > 0) ? password : roomCode;
  const saltBytes = new TextEncoder().encode(KEY_SALT_PREFIX + roomCode);
  const passBytes = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passBytes.buffer.slice(passBytes.byteOffset, passBytes.byteOffset + passBytes.byteLength) as ArrayBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer.slice(saltBytes.byteOffset, saltBytes.byteOffset + saltBytes.byteLength) as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a payload with AES-GCM. Output layout: [12-byte IV][ciphertext+tag].
 */
export async function encryptPayload(
  key: CryptoKey,
  data: Uint8Array,
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  // Pass the underlying ArrayBuffer slices so WebCrypto's BufferSource
  // typing is satisfied under strict TS settings (Uint8Array's generic
  // type parameter is `ArrayBufferLike` which is wider than `ArrayBuffer`).
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  const out = new Uint8Array(IV_BYTES + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), IV_BYTES);
  return out;
}

/**
 * Decrypt an AES-GCM payload. Returns null on any failure (wrong key,
 * truncated buffer, tampered ciphertext).
 */
export async function decryptPayload(
  key: CryptoKey,
  data: Uint8Array,
): Promise<Uint8Array | null> {
  if (data.byteLength <= IV_BYTES) return null;
  const iv = data.slice(0, IV_BYTES);
  const ct = data.slice(IV_BYTES);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ct.buffer.slice(ct.byteOffset, ct.byteOffset + ct.byteLength) as ArrayBuffer,
    );
    return new Uint8Array(pt);
  } catch {
    return null;
  }
}

/**
 * Produce an encrypted canary. Any peer with the same key can verify it
 * via {@link verifyCanary}. Each call uses a fresh IV so canaries don't
 * repeat on the wire.
 */
export function createCanary(key: CryptoKey): Promise<Uint8Array> {
  return encryptPayload(key, CANARY_PLAINTEXT);
}

/**
 * Verify an encrypted canary. True iff the payload decrypts to the
 * expected constant under the given key.
 */
export async function verifyCanary(
  key: CryptoKey,
  data: Uint8Array,
): Promise<boolean> {
  const pt = await decryptPayload(key, data);
  if (!pt || pt.byteLength !== CANARY_PLAINTEXT.byteLength) return false;
  for (let i = 0; i < pt.length; i++) {
    if (pt[i] !== CANARY_PLAINTEXT[i]) return false;
  }
  return true;
}
