import { Landing } from "@/components/Landing";
import { Overview } from "@/components/Overview";
import { requestHost, requestNetwork } from "@/lib/host";

// Head-of-chain data: never serve a cached copy.
export const dynamic = "force-dynamic";

/**
 * One route, two pages, decided by hostname.
 *
 * `devnet.rialoscan.org/` and `testnet.rialoscan.org/` are the head of their
 * chain. The bare domain is reserved for a mainnet that does not exist yet, so
 * there it serves a holding page instead. When mainnet ships, the null branch is
 * the thing that changes.
 */
export default async function HomePage() {
  const net = await requestNetwork();
  if (net !== null) return <Overview net={net} />;

  const { host, protocol } = await requestHost();
  return <Landing host={host} protocol={protocol} />;
}
