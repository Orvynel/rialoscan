import type { MetadataRoute } from "next";
import { requestHost, requestNetwork } from "@/lib/host";

// One robots.txt per hostname: the apex and the two network subdomains serve
// different things, so they cannot share a static file.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [{ origin }, net] = await Promise.all([requestHost(), requestNetwork()]);

  // Detail pages are an unbounded URL space over a devnet node with no indexer
  // behind it: a crawler that follows block links would walk the entire chain,
  // and every page is a fresh set of RPC calls. The index pages are the ones
  // worth indexing anyway — nobody searches for a devnet signature.
  const disallow = ["/api/", "/block/", "/tx/", "/address/"];

  // The apex serves only its holding page; everything else 308s to a subdomain.
  const allow = net === null ? "/" : ["/", "/blocks", "/txs", "/validators", "/rex"];

  return {
    rules: [{ userAgent: "*", allow, disallow }],
    // Its own sitemap only. Each hostname is a separate site to a crawler.
    sitemap: `${origin}/sitemap.xml`,
  };
}
