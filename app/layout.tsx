import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Suspense } from "react";
import { Header } from "@/components/Header";
import "./globals.css";

// Inter for prose (Rialo loads it too); Geist Mono for every hash, height and
// balance, so digits stay in vertical alignment down a column.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  // Absolute base for OpenGraph and canonical URLs. Without this, Next.js emits
  // relative og:url values, which most link-preview crawlers refuse to resolve.
  metadataBase: new URL("https://rialoscan.org"),
  title: { default: "RialoScan — Rialo block explorer", template: "%s · RialoScan" },
  description:
    "An independent block explorer for the Rialo network. Blocks, transactions, accounts, validators, and reactive-execution workflows on devnet and testnet.",
  applicationName: "RialoScan",
  openGraph: {
    title: "RialoScan — Rialo block explorer",
    description: "Blocks, transactions, accounts, validators and REX workflows on Rialo devnet and testnet.",
    siteName: "RialoScan",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "RialoScan — Rialo block explorer",
    description: "Blocks, transactions, accounts, validators and REX workflows on Rialo devnet and testnet.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`}>
      <body>
        {/* The header reads `?net=`, so it suspends during static prerender. */}
        <Suspense fallback={<div className="header" />}>
          <Header />
        </Suspense>

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
