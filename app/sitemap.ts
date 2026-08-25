import type { MetadataRoute } from "next";
import { requestHost, requestNetwork } from "@/lib/host";
import { fetchedAt } from "@/lib/rpc";

// Per-hostname, for the same reason as robots.ts.
export const dynamic = "force-dynamic";

/** Index pages only. Detail routes are unbounded and robots.txt disallows them. */
const PATHS = [
  { path: "/", priority: 1, changeFrequency: "always" as const },
  { path: "/blocks", priority: 0.9, changeFrequency: "always" as const },
  { path: "/txs", priority: 0.9, changeFrequency: "always" as const },
  { path: "/validators", priority: 0.7, changeFrequency: "hourly" as const },
  { path: "/rex", priority: 0.7, changeFrequency: "hourly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ origin }, net] = await Promise.all([requestHost(), requestNetwork()]);
  const lastModified = new Date(fetchedAt());

  // A sitemap may only list URLs on its own host, so the apex advertises just
  // its holding page. Crawlers reach the subdomains through the links on it.
  const paths = net === null ? PATHS.slice(0, 1) : PATHS;

  return paths.map(({ path, priority, changeFrequency }) => ({
    url: `${origin}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
