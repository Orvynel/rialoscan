import Link from "next/link";
import { shorten } from "@/lib/format";
import { withNetwork } from "@/lib/networks";
import type { NetworkId } from "@/lib/networks";
import { CopyButton } from "./CopyButton";

type HashProps = {
  value: string;
  net: NetworkId;
  kind?: "address" | "tx" | "block";
  head?: number;
  tail?: number;
  /** Render the value in full instead of middle-ellipsised. */
  full?: boolean;
  copy?: boolean;
  /** Replace the visible text, e.g. a resolved program name. */
  label?: string;
};

function href(kind: HashProps["kind"], value: string, net: NetworkId): string | null {
  switch (kind) {
    case "address":
      return withNetwork(`/address/${value}`, net);
    case "tx":
      return withNetwork(`/tx/${value}`, net);
    case "block":
      return withNetwork(`/block/${value}`, net);
    default:
      return null;
  }
}

/** Base58 identifier: linked, middle-ellipsised, with the full value on hover. */
export function Hash({ value, net, kind, head = 6, tail = 6, full = false, copy = false, label }: HashProps) {
  const text = label ?? (full ? value : shorten(value, head, tail));
  const target = href(kind, value, net);

  const body = target ? (
    <Link href={target} className="hash" title={value}>
      {text}
    </Link>
  ) : (
    <span className="hash" title={value}>
      {text}
    </span>
  );

  if (!copy) return body;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {body}
      <CopyButton value={value} label="Copy to clipboard" />
    </span>
  );
}
