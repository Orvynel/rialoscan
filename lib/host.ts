import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hostNetwork, pinnedNetwork, SITE_DOMAIN, type NetworkId } from "./networks";

/**
 * Request-scoped host and network.
 *
 * Every explorer page reads its network from here rather than from a search
 * parameter, which means a page cannot be coaxed into rendering one chain's data
 * under another chain's URL. `requireNetwork` refuses instead of falling back:
 * silently defaulting to devnet on a host that did not ask for devnet is exactly
 * the failure an explorer must not have.
 */

export type RequestHost = { host: string; protocol: string; origin: string };

function isLoopback(name: string): boolean {
  return name === "localhost" || name.endsWith(".localhost") || name.startsWith("127.") || name.startsWith("[");
}

export async function requestHost(): Promise<RequestHost> {
  const head = await headers();
  const host = head.get("host") ?? head.get("x-forwarded-host") ?? SITE_DOMAIN;
  // Vercel terminates TLS upstream, so the scheme only arrives in this header.
  // Absent, the request is local: loopback is served over plain HTTP.
  const forwarded = head.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwarded ?? (isLoopback(host.split(":")[0].toLowerCase()) ? "http" : "https");
  return { host, protocol, origin: `${protocol}://${host}` };
}

/** The network this host serves, or null on the apex — which serves no chain. */
export async function requestNetwork(): Promise<NetworkId | null> {
  const { host } = await requestHost();
  return hostNetwork(host) ?? pinnedNetwork();
}

/** As above, but 404s rather than guessing. For pages that only exist per-network. */
export async function requireNetwork(): Promise<NetworkId> {
  const net = await requestNetwork();
  if (net === null) notFound();
  return net;
}
