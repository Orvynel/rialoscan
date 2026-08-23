"use client";

import { useEffect, useState } from "react";
import { formatUtcWithMillis, timeAgo } from "@/lib/format";

/**
 * Live relative timestamp.
 *
 * `initial` is required and must be the value the server rendered. Computing the
 * delta during hydration instead would produce a different string from the one
 * in the HTML (the clock moved), which React reports as a hydration mismatch.
 * So we show the server's text until mount, then take over and tick.
 */
export function TimeAgo({ epochMs, initial }: { epochMs: number | null; initial: string }) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    if (epochMs === null) return;
    const tick = () => setText(timeAgo(epochMs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [epochMs]);

  return (
    <time dateTime={epochMs === null ? undefined : new Date(epochMs).toISOString()} title={formatUtcWithMillis(epochMs)}>
      {text}
    </time>
  );
}
