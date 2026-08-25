import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { requestHost, requestNetwork } from "@/lib/host";
import { NETWORKS, SITE_DOMAIN } from "@/lib/networks";
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
      ? "RialoScan — Rialo network explorer"
      : `RialoScan ${network.label} — Rialo block explorer`;

  const description =
    network === null
      ? `Independent explorer for the Rialo network. Each network has its own explorer: devnet.${SITE_DOMAIN} and testnet.${SITE_DOMAIN}.`
      : `Blocks, transactions, accounts, validators and reactive-execution workflows on Rialo ${network.label}. ${network.note}`;

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
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ host, protocol }, net] = await Promise.all([requestHost(), requestNetwork()]);

  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        <Header net={net} host={host} protocol={protocol} />

        <main className="shell page">{children}</main>

        <footer className="footer">
          <div className="shell footer-inner">
            <span>
              RialoScan · independent explorer · not affiliated with Subzero Labs
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
