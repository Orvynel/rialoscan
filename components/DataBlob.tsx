"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { groupDigits } from "@/lib/format";

/**
 * An opaque payload with an honest size.
 *
 * Instruction data on Rialo is base58 and routinely large — the biggest observed
 * on devnet is 89,350 characters, which is a PolkaVM program blob being
 * deployed. Rendering that inline freezes the page, and silently cutting it off
 * makes a truncated value look complete. So: show a bounded window, state the
 * true length, and let the reader expand or copy the whole thing.
 */
export function DataBlob({
  value,
  encoding = "base58",
  previewChars = 512,
}: {
  value: string;
  encoding?: string;
  previewChars?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const truncated = value.length > previewChars;
  const shown = expanded || !truncated ? value : value.slice(0, previewChars);

  return (
    <div>
      <pre className="blob">{shown || "(empty)"}</pre>
      <div className="blob-meta">
        <span>
          {encoding} · {groupDigits(value.length)} chars
        </span>
        {truncated ? (
          <button type="button" className="blob-toggle" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "collapse" : `show all ${groupDigits(value.length)}`}
          </button>
        ) : null}
        {value ? <CopyButton value={value} label="Copy payload" /> : null}
      </div>
    </div>
  );
}
