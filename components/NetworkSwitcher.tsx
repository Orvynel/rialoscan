"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DEFAULT_NETWORK, NETWORK_IDS, NETWORKS, resolveNetwork } from "@/lib/networks";

/**
 * Network lives in the URL rather than a cookie so that every link a user
 * copies out of RialoScan resolves to the same chain for whoever opens it.
 */
export function NetworkSwitcher() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = resolveNetwork(params.get("net"));

  return (
    <div className="netswitch" role="group" aria-label="Network">
      {NETWORK_IDS.map((id) => {
        const next = new URLSearchParams(params);
        if (id === DEFAULT_NETWORK) next.delete("net");
        else next.set("net", id);
        const query = next.toString();

        return (
          <Link
            key={id}
            href={query ? `${pathname}?${query}` : pathname}
            className="netswitch-option"
            data-active={id === active}
            aria-current={id === active ? "true" : undefined}
            title={NETWORKS[id].note}
          >
            {NETWORKS[id].label}
          </Link>
        );
      })}
    </div>
  );
}
