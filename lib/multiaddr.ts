/**
 * Binary multiaddr decoding.
 *
 * `getValidatorAccounts` returns each validator's `address` and
 * `subdag_sync_address` as base64-encoded *binary* multiaddrs, not strings —
 * `"NRVub2RlMi5kZXZuZXQucmlhbG8uaW+RAg+g"` is
 * `/dns/node2.devnet.rialo.io/udp/4000`. Displayed raw they are unreadable, and
 * they carry information `getClusterNodes` does not: the consensus port there
 * (4070) is a different port from the one the validator registered on chain
 * (4000), with subdag sync on a third (4200).
 *
 * Only the protocols Rialo actually uses are implemented. Anything else degrades
 * to a marker rather than guessing.
 */

const PROTOCOLS: Record<number, string> = {
  4: "ip4",
  6: "tcp",
  41: "ip6",
  53: "dns",
  54: "dns4",
  55: "dns6",
  56: "dnsaddr",
  273: "udp",
  421: "p2p",
};

function readVarint(bytes: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let index = offset;
  for (;;) {
    if (index >= bytes.length) return [value, index];
    const byte = bytes[index++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 28) return [value, index];
  }
  return [value, index];
}

export type Multiaddr = { text: string; host: string | null; port: number | null };

export function decodeMultiaddr(base64: string): Multiaddr | null {
  if (!base64) return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;

  const parts: string[] = [];
  let host: string | null = null;
  let port: number | null = null;
  let i = 0;

  while (i < bytes.length) {
    let code: number;
    [code, i] = readVarint(bytes, i);
    const name = PROTOCOLS[code];
    if (name === undefined) {
      parts.push(`/?${code}`);
      break;
    }

    if (name.startsWith("dns")) {
      let length: number;
      [length, i] = readVarint(bytes, i);
      if (i + length > bytes.length) break;
      host = Buffer.from(bytes.subarray(i, i + length)).toString("utf8");
      parts.push(`/${name}/${host}`);
      i += length;
    } else if (name === "udp" || name === "tcp") {
      if (i + 2 > bytes.length) break;
      port = (bytes[i] << 8) | bytes[i + 1];
      parts.push(`/${name}/${port}`);
      i += 2;
    } else if (name === "ip4") {
      if (i + 4 > bytes.length) break;
      host = [...bytes.subarray(i, i + 4)].join(".");
      parts.push(`/ip4/${host}`);
      i += 4;
    } else {
      parts.push(`/${name}`);
      break;
    }
  }

  const text = parts.join("");
  return text ? { text, host, port } : null;
}

/** Decoded form when possible, otherwise the raw value — never an empty cell. */
export function multiaddrText(base64: string): string {
  return decodeMultiaddr(base64)?.text ?? base64;
}
