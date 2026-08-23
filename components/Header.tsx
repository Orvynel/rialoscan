"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DEFAULT_NETWORK, resolveNetwork } from "@/lib/networks";
import { GlacierMark } from "./Icons";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { SearchBar } from "./SearchBar";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/blocks", label: "Blocks" },
  { href: "/txs", label: "Transactions" },
  { href: "/validators", label: "Validators" },
  { href: "/rex", label: "REX" },
];

export function Header() {
  const pathname = usePathname();
  const params = useSearchParams();
  const net = resolveNetwork(params.get("net"));
  const suffix = net === DEFAULT_NETWORK ? "" : `?net=${net}`;

  return (
    <header className="header">
      <div className="shell header-inner">
        <Link href={`/${suffix}`} className="wordmark" aria-label="Glacier home">
          <span style={{ color: "var(--accent)" }}>
            <GlacierMark />
          </span>
          <span className="wordmark-text">Glacier</span>
        </Link>

        <nav className="nav" aria-label="Sections">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={`${item.href}${suffix}`} className="nav-link" data-active={active}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <span className="header-spacer" />
        <SearchBar />
        <NetworkSwitcher />
      </div>
    </header>
  );
}
