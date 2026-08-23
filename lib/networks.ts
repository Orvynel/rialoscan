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
export const DEFAULT_NETWORK: NetworkId = "devnet";

export function isNetworkId(value: unknown): value is NetworkId {
  return typeof value === "string" && value in NETWORKS;
}

/** Resolve a `?net=` search param to a known network, falling back to devnet. */
export function resolveNetwork(value: unknown): NetworkId {
  return isNetworkId(value) ? value : DEFAULT_NETWORK;
}

export function networkOf(value: unknown): Network {
  return NETWORKS[resolveNetwork(value)];
}

/** Append `?net=` only when it differs from the default, keeping URLs clean. */
export function withNetwork(path: string, net: NetworkId): string {
  if (net === DEFAULT_NETWORK) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}net=${net}`;
}
