"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NetworkId } from "@/lib/networks";
import { Mark } from "./Icons";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/blocks", label: "Blocks" },
  { href: "/txs", label: "Transactions" },
  { href: "/validators", label: "Validators" },
  { href: "/rex", label: "REX" },
];

/**
 * `net` is null on the bare domain, which serves no chain — there is nothing to
 * search and nowhere to navigate, so the header is reduced to the wordmark and
 * the theme toggle.
 *
 * Navigation hrefs carry no network because the hostname already does, which is
 * also why this component no longer reads the query string and the layout no
 * longer has to suspend it during prerender.
 */
export function Header({
  net,
  host,
  protocol,
}: {
  net: NetworkId | null;
  host: string;
  protocol: string;
}) {
  const pathname = usePathname();

  return (
    <header className="header">
      <div className="shell header-inner">
        <Link href="/" className="wordmark" aria-label="RialoScan home">
          <span style={{ color: "var(--accent)" }}>
            <Mark />
          </span>
          <span className="wordmark-text">RialoScan</span>
        </Link>

        {net === null ? null : (
          <nav className="nav" aria-label="Sections">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className="nav-link" data-active={active}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        <span className="header-spacer" />

        {net === null ? null : (
          <>
            <SearchBar />
            <NetworkSwitcher net={net} host={host} protocol={protocol} />
          </>
        )}

        {/* Outside the guard: the bare domain has no chain to search or switch,
            but it is still a page someone reads, so it still gets the theme. */}
        <ThemeToggle host={host} />
      </div>
    </header>
  );
}
