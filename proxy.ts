import { NextResponse, type NextRequest } from "next/server";
import { hostNetwork, isNetworkId, originFor, pinnedNetwork } from "@/lib/networks";

/**
 * Keeps each network on its own hostname.
 *
 * The explorer is served from `devnet.rialoscan.org` and
 * `testnet.rialoscan.org`. The bare domain is reserved for mainnet and serves
 * one page — a holding notice with links into the two live networks — so this
 * proxy's only job is to move explorer paths that arrive on the apex over to a
 * network host, rather than answer them there.
 *
 * Doing it as a redirect and not a rewrite is deliberate: the address bar has to
 * end up showing which chain the visitor is looking at. `?net=` from an older
 * URL is honoured once, as the redirect target, and then dropped.
 *
 * When mainnet ships this becomes the one place that changes: the apex stops
 * redirecting and starts serving mainnet, and this file loses its reason to
 * exist.
 */

/** What a bare `/tx/...` on the apex meant before networks moved to subdomains. */
const LEGACY_DEFAULT = "devnet";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? request.nextUrl.host;

  // The host already names a network, or the whole deployment is pinned to one
  // (Vercel previews, where `devnet.<preview-url>` would not resolve).
  if (hostNetwork(host) !== null || pinnedNetwork() !== null) return NextResponse.next();

  // The apex itself: the holding page, and nothing else.
  if (request.nextUrl.pathname === "/") return NextResponse.next();

  const requested = request.nextUrl.searchParams.get("net");
  const net = isNetworkId(requested) ? requested : LEGACY_DEFAULT;

  const target = new URL(request.nextUrl);
  target.host = new URL(originFor(net, host, request.nextUrl.protocol)).host;
  target.searchParams.delete("net");

  return NextResponse.redirect(target, 308);
}

export const config = {
  // Everything except the RPC proxy (which is network-agnostic and takes `?net=`),
  // build output, and the files crawlers fetch from the apex by name.
  matcher: ["/((?!api/|_next/|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)"],
};
