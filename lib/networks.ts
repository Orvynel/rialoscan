/**
 * Network identity, and the hostname each network is served from.
 *
 * RialoScan serves one network per host — `devnet.rialoscan.org` and
 * `testnet.rialoscan.org` — rather than switching on a `?net=` parameter. Two
 * reasons. A link copied out of the explorer then carries its network in the
 * part of the URL people actually read, so a testnet transaction cannot be
 * passed off as a devnet one by trimming a query string. And the bare domain
 * stays free for mainnet, which does not exist yet.
 *
 * Nothing here hardcodes a domain to do that resolution: the network is the
 * first label of whatever host the request arrived on, and switching networks
 * swaps that label in place. `devnet.localhost:3000` therefore behaves exactly
 * like production, with no host aliasing or per-environment configuration.
 */

export type NetworkId = "devnet" | "testnet";

export type Network = {
  id: NetworkId;
  label: string;
  /** Public JSON-RPC endpoint. Override per-deployment with an env var. */
  rpc: string;
  /** Shown in the UI so nobody mistakes a test network for something durable. */
  note: string;
};

/**
 * Canonical apex. Only used to build absolute URLs for metadata and for hosts
 * where swapping the first label would not resolve in DNS — never for deciding
 * which network a request is for.
 */
export const SITE_DOMAIN = "rialoscan.org";

/**
 * Verified reachable 2026-08-23. Both hosts also answer on :4100 over plain
 * HTTP; we always use 443 so the proxy never downgrades.
 */
export const NETWORKS: Record<NetworkId, Network> = {
  devnet: {
    id: "devnet",
    label: "Devnet",
    rpc: process.env.RIALO_DEVNET_RPC ?? "https://devnet.rialo.io",
    note: "Development network. State is wiped without notice.",
  },
  testnet: {
    id: "testnet",
    label: "Testnet",
    rpc: process.env.RIALO_TESTNET_RPC ?? "https://testnet.rialo.io",
    note: "Public test network. Tokens have no value.",
  },
};

export const NETWORK_IDS = Object.keys(NETWORKS) as NetworkId[];

export function isNetworkId(value: unknown): value is NetworkId {
  return typeof value === "string" && value in NETWORKS;
}

/**
 * Split a Host header into name and port. `lastIndexOf(":")` alone would cut an
 * IPv6 literal in half, so bracketed hosts are treated as portless unless the
 * bracket has already closed.
 */
function splitHost(host: string): { name: string; port: string } {
  const close = host.lastIndexOf("]");
  const colon = host.lastIndexOf(":");
  if (colon === -1 || colon < close) return { name: host, port: "" };
  return { name: host.slice(0, colon), port: host.slice(colon) };
}

/**
 * The network a request is for, or null when the host names no network — the
 * apex, `www`, a Vercel preview URL, bare `localhost`. Null means "not an
 * explorer host", which is what keeps the apex free for mainnet.
 */
export function hostNetwork(host: string | null | undefined): NetworkId | null {
  if (!host) return null;
  const label = splitHost(host).name.toLowerCase().split(".")[0];
  return isNetworkId(label) ? label : null;
}

/**
 * Pin an entire deployment to one network, for hosts that cannot carry a
 * network label at all — chiefly Vercel preview URLs, where `devnet.<preview>`
 * is not a name that resolves. Unset in production, where the host decides.
 */
export function pinnedNetwork(): NetworkId | null {
  const value = process.env.RIALOSCAN_NETWORK;
  return isNetworkId(value) ? value : null;
}

/** The same host with its first label replaced by (or prefixed with) `net`. */
export function hostFor(host: string, net: NetworkId): string {
  const { name, port } = splitHost(host);
  const labels = name.split(".");
  const first = labels[0].toLowerCase();
  if (isNetworkId(first) || first === "www") labels[0] = net;
  else labels.unshift(net);
  return labels.join(".") + port;
}

/**
 * Hosts where `hostFor` produces a name that actually resolves: the real domain
 * and loopback. Anything else (a preview URL, an IP literal) has to be sent to
 * the canonical domain instead of a subdomain of itself.
 */
function isAddressableHost(host: string): boolean {
  const name = splitHost(host).name.toLowerCase();
  if (name === SITE_DOMAIN || name.endsWith(`.${SITE_DOMAIN}`)) return true;
  return name === "localhost" || name.endsWith(".localhost");
}

/**
 * Absolute origin serving `net`, expressed relative to the host the current
 * request arrived on so that local development and production both work from
 * the same code path.
 */
export function originFor(net: NetworkId, host?: string | null, protocol = "https"): string {
  const scheme = protocol.replace(/:$/, "");
  if (host && isAddressableHost(host)) return `${scheme}://${hostFor(host, net)}`;
  return `https://${net}.${SITE_DOMAIN}`;
}
