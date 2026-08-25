import Link from "next/link";
import { shorten } from "@/lib/format";
import { CopyButton } from "./CopyButton";

type HashProps = {
  value: string;
  kind?: "address" | "tx" | "block";
  head?: number;
  tail?: number;
  /** Render the value in full instead of middle-ellipsised. */
  full?: boolean;
  copy?: boolean;
  /** Replace the visible text, e.g. a resolved program name. */
  label?: string;
};

/**
 * Paths carry no network. Each network is served from its own host, so a
 * relative link stays on the chain the visitor is already looking at, and a
 * copied absolute URL names its chain in the hostname.
 */
function href(kind: HashProps["kind"], value: string): string | null {
  switch (kind) {
    case "address":
      return `/address/${value}`;
    case "tx":
      return `/tx/${value}`;
    case "block":
      return `/block/${value}`;
    default:
      return null;
  }
}

/** Base58 identifier: linked, middle-ellipsised, with the full value on hover. */
export function Hash({ value, kind, head = 6, tail = 6, full = false, copy = false, label }: HashProps) {
  const text = label ?? (full ? value : shorten(value, head, tail));
  const target = href(kind, value);

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
