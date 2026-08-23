/**
 * Base58 (Bitcoin alphabet) — the encoding for every Rialo address, signature
 * and instruction payload.
 *
 * Needed here for one specific reason: Rialo returns the *same* validator keys
 * in two different encodings. `getValidatorAccounts` gives `protocol_key` and
 * `network_key` in base58, while `getClusterNodes` gives the identical 32 bytes
 * as `protocolPubkey` and `networkPubkey` in base64. A client that joins those
 * two endpoints on key equality will never match a single row. Decoding to bytes
 * is the only way to show that they are in fact the same validator.
 */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const INDEX: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i += 1) INDEX[ALPHABET[i]] = i;

/** Returns null on any non-base58 input rather than throwing. */
export function base58Decode(value: string): Uint8Array | null {
  if (!value) return null;

  // Big-endian base conversion over byte digits — no BigInt, so a 90 KB
  // instruction payload does not turn into a quadratic bigint multiply.
  const bytes: number[] = [];
  for (const char of value) {
    let carry = INDEX[char];
    if (carry === undefined) return null;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Each leading '1' is a leading zero byte.
  let leadingZeros = 0;
  for (const char of value) {
    if (char !== "1") break;
    leadingZeros += 1;
  }

  const out = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) out[leadingZeros + i] = bytes[bytes.length - 1 - i];
  return out;
}

/** Byte length of a base58 value, or null if it is not base58. */
export function base58ByteLength(value: string): number | null {
  return base58Decode(value)?.length ?? null;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * True when a base58 value and a base64 value are the same bytes.
 * Used to verify the cross-endpoint validator key identity described above.
 */
export function sameKey(base58: string, base64: string): boolean {
  const left = base58Decode(base58);
  if (!left) return false;
  try {
    return equalBytes(left, Uint8Array.from(Buffer.from(base64, "base64")));
  } catch {
    return false;
  }
}

/**
 * True when a hex value and a base64 value are the same bytes.
 *
 * The third encoding of the same key: REX duties list their assigned validators
 * as hex-encoded 96-byte authority keys, while `getClusterNodes` returns those
 * authority keys in base64. Resolving one to the other is what lets a duty be
 * labelled with a validator hostname instead of 192 characters of hex.
 */
export function hexEqualsBase64(hex: string, base64: string): boolean {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length === 0 || hex.length % 2 !== 0) return false;
  try {
    const left = Uint8Array.from(Buffer.from(hex, "hex"));
    return equalBytes(left, Uint8Array.from(Buffer.from(base64, "base64")));
  } catch {
    return false;
  }
}
