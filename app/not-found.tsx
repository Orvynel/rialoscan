import Link from "next/link";
import { GlacierMark } from "@/components/Icons";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div style={{ padding: "72px 0", textAlign: "center" }}>
      <div style={{ color: "var(--accent-dim)", display: "flex", justifyContent: "center" }}>
        <GlacierMark size={34} />
      </div>
      <h1 className="page-title" style={{ marginTop: 18 }}>
        Nothing at this address
      </h1>
      <p className="page-sub" style={{ margin: "10px auto 0" }}>
        Glacier looks up blocks by height, transactions by signature, and accounts by base58 address. If you
        expected something here, the value may be malformed — or, for older transactions, simply beyond the
        20-signature window the node will return.
      </p>
      <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <Link className="pager-link" href="/">
          Network overview
        </Link>
        <Link className="pager-link" href="/blocks">
          Blocks
        </Link>
        <Link className="pager-link" href="/txs">
          Transactions
        </Link>
        <Link className="pager-link" href="/rex">
          REX
        </Link>
      </div>
    </div>
  );
}
