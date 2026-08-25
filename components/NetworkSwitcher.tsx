"use client";

import { usePathname } from "next/navigation";
import { NETWORKS, NETWORK_IDS, originFor, type NetworkId } from "@/lib/networks";

/**
 * Switching network means changing host, so these are plain anchors to another
 * origin rather than `next/link` — there is nothing for the client router to
 * prefetch across a hostname boundary.
 *
 * The path is carried over deliberately. Asking for the same transaction on the
 * other chain and getting a 404 is the honest answer; quietly bouncing to the
 * home page would hide that the two networks have separate state.
 *
 * `host` and `protocol` come from the server rather than `window.location` so
 * the markup is identical on both sides of hydration.
 */
export function NetworkSwitcher({
  net,
  host,
  protocol,
}: {
  net: NetworkId;
  host: string;
  protocol: string;
}) {
  const pathname = usePathname();

  return (
    <div className="netswitch" role="group" aria-label="Network">
      {NETWORK_IDS.map((id) => {
        const active = id === net;
        if (active) {
          return (
            <span
              key={id}
              className="netswitch-option"
              data-active="true"
              aria-current="true"
              title={NETWORKS[id].note}
            >
              {NETWORKS[id].label}
            </span>
          );
        }
        return (
          <a
            key={id}
            href={`${originFor(id, host, protocol)}${pathname}`}
            className="netswitch-option"
            data-active="false"
            title={NETWORKS[id].note}
          >
            {NETWORKS[id].label}
          </a>
        );
      })}
    </div>
  );
}
