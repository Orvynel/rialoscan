import "server-only";

import { getAccountInfo, nativeProgramName, type AccountInfo } from "./chain";
import { CACHE_IMMUTABLE } from "./rpc";
import type { NetworkId } from "./networks";

/**
 * Program identity resolution.
 *
 * Deliberately not a hardcoded address table. On Rialo a native program's
 * account is owned by NativeLoader and its data *is* its name in UTF-8, so the
 * chain is the registry: `11111111111111111111111111111111` decodes to
 * `system_program`, `Qrac1eProcessor1111111111111111111111111111` decodes to
 * `rex_processor`. That means new native programs are labelled the day they
 * ship, with no change here — which matters for a testnet that is still adding
 * them.
 *
 * A program account is immutable for explorer purposes, so every lookup is
 * cached for an hour and deduplicated within a render.
 */

export type ProgramInfo = {
  address: string;
  /** The on-chain name, e.g. `rex_processor`. Null for non-native programs. */
  name: string | null;
  /** Human-cased label for display, falling back to a shortened address. */
  label: string | null;
  native: boolean;
  executable: boolean;
  account: AccountInfo | null;
};

/** `rex_processor` → `REX Processor`. Acronyms the chain writes lowercase. */
const ACRONYMS = new Set(["rex", "bpf", "spl", "vm", "tee", "rpc", "id"]);

function titleize(name: string): string {
  return name
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) =>
      ACRONYMS.has(word.toLowerCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

async function load(net: NetworkId, address: string): Promise<ProgramInfo> {
  const account = await getAccountInfo(net, address, CACHE_IMMUTABLE);
  const name = nativeProgramName(account);
  return {
    address,
    name,
    label: name ? titleize(name) : null,
    native: name !== null,
    executable: account?.executable ?? false,
    account,
  };
}

/**
 * Resolve many program addresses at once.
 *
 * The node has no JSON-RPC batching, so this fans out — but it dedupes first,
 * which matters because a single block routinely references the same program in
 * every one of its transactions.
 */
export async function resolvePrograms(
  net: NetworkId,
  addresses: Iterable<string>,
): Promise<Map<string, ProgramInfo>> {
  const unique = [...new Set([...addresses].filter(Boolean))];
  const infos = await Promise.all(unique.map((address) => load(net, address)));
  return new Map(infos.map((info) => [info.address, info]));
}

export async function resolveProgram(net: NetworkId, address: string): Promise<ProgramInfo> {
  return load(net, address);
}

/** Best label available without a network round trip. */
export function programLabel(info: ProgramInfo | undefined, address: string): string {
  return info?.label ?? address;
}
