import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { requestHost, requestNetwork } from "@/lib/host";
import { NETWORKS, SITE_DOMAIN } from "@/lib/networks";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Inter for prose (Rialo loads it too); Geist Mono for every hash, height and
// balance, so digits stay in vertical alignment down a column.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

/**
 * Metadata is per-host, not per-site. `devnet.rialoscan.org` and
 * `testnet.rialoscan.org` are separate properties as far as a crawler or a link
 * preview is concerned, and each has to describe the chain it actually serves —
 * a shared title claiming both networks would be wrong on both hosts.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [{ origin }, net] = await Promise.all([requestHost(), requestNetwork()]);
  const network = net === null ? null : NETWORKS[net];

  const title =
    network === null
      ? "RialoScan — Rialo Block Explorer"
      : `RialoScan — Rialo ${network.label} Block Explorer`;

  // Both fit inside the ~155 characters a search result shows, so neither is cut
  // off mid-clause. Each says where the numbers come from, because that is the
  // question a snippet has to answer for an explorer nobody has heard of yet.
  const description =
    network === null
      ? `Block explorer for the Rialo network, read live from the node RPC. Each network has its own: devnet.${SITE_DOMAIN} and testnet.${SITE_DOMAIN}.`
      : `Search blocks, transactions, accounts, validators and REX workflows on Rialo ${network.label}. ${network.note}`;

  return {
    // Absolute base for OpenGraph and canonical URLs. Without this, Next.js emits
    // relative og:url values, which most link-preview crawlers refuse to resolve.
    metadataBase: new URL(origin),
    title: {
      default: title,
      template: network === null ? "%s · RialoScan" : `%s · RialoScan ${network.label}`,
    },
    description,
    applicationName: "RialoScan",
    // "./" resolves against metadataBase *and* the current route, so each page
    // gets its own canonical and og:url without repeating this in eight files.
    alternates: { canonical: "./" },
    openGraph: { title, description, siteName: "RialoScan", url: "./", type: "website" },
    // The wide card, because `app/opengraph-image.tsx` fills 1200x630 — `summary`
    // would crop it to a square thumbnail.
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ host, protocol }, net] = await Promise.all([requestHost(), requestNetwork()]);

  return (
    // `suppressHydrationWarning` covers this element only: the script below sets
    // `data-theme` on it before React hydrates, so the attribute is legitimately
    // present in the DOM and absent from the server markup.
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        {/* First child of <body> so it executes before anything is painted. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />

        <Header net={net} host={host} protocol={protocol} />

        <main className="shell page">{children}</main>

        <footer className="footer">
          <div className="shell footer-inner">
            <span>
              RialoScan · built on the Rialo JSON-RPC · not affiliated with Subzero Labs
            </span>
            <span className="footer-links">
              <a href="/api/rpc">CORS-safe RPC proxy</a>
              <a href="https://rialo.io" target="_blank" rel="noreferrer noopener">
                rialo.io
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
