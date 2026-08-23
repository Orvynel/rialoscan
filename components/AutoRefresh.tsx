"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the server component tree on an interval.
 *
 * Using `router.refresh()` rather than a parallel client-side data layer keeps
 * one code path for reads: the same server functions, decoders and formatting
 * produce both the first paint and every update, so a live value can never
 * drift from its server-rendered form.
 *
 * Polling stops while the tab is hidden — a background tab hammering a public
 * devnet node for hours is not acceptable behaviour from an explorer.
 */
export function AutoRefresh({ intervalMs = 6000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      setPaused(hidden);
      if (!hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      // Skip a tick rather than stack refreshes if the last one is still running.
      if (inFlight.current) return;
      inFlight.current = true;
      router.refresh();
      setTimeout(() => {
        inFlight.current = false;
      }, Math.min(intervalMs, 2000));
    }, intervalMs);
    return () => clearInterval(id);
  }, [paused, intervalMs, router]);

  return null;
}
