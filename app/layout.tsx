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
  title: { default: "Glacier — Rialo block explorer", template: "%s · Glacier" },
  description:
    "An independent block explorer for the Rialo network. Blocks, transactions, accounts, validators, and reactive-execution workflows on devnet and testnet.",
  applicationName: "Glacier",
  openGraph: {
    title: "Glacier — Rialo block explorer",
    description: "Blocks, transactions, accounts, validators and REX workflows on Rialo devnet and testnet.",
    siteName: "Glacier",
    type: "website",
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
              Glacier · independent explorer · not affiliated with Subzero Labs
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
