"use client";

import { useRef } from "react";

import { clampEta, formatEtaRange } from "@/lib/eta";
import { coldStartRange, type EtaJobKey } from "@/lib/eta-jobs";
import { trpc } from "@/lib/trpc";

// Honest ETA for a running job (§ PROG P1/P2). The user chose "range + step" over a single
// countdown, so once a live estimate arrives we show a *tightening band* around it (not a bare
// countdown). Before live data: historical p50–p90 range. Stays silent when the band would be
// too wide to be useful — false precision reads as broken.
export function EtaHint({
  jobKey,
  count,
  liveSec,
}: {
  jobKey: EtaJobKey;
  count?: number;
  liveSec?: number;
}) {
  const { data } = trpc.pipeline.etaHints.useQuery({ jobKey }, { staleTime: 300_000 });
  const liveRef = useRef<number | null>(null);
  if (liveSec != null && liveSec > 0) liveRef.current = clampEta(liveRef.current, liveSec);
  const live = liveRef.current;

  // Live tightening band, once the job has emitted a confident estimate.
  if (live != null && live > 0) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground">
        预计 {formatEtaRange(live * 0.8, live * 1.35)}
      </span>
    );
  }

  // Cold-start: historical percentile range, else input-based band.
  let range: { lo: number; hi: number } | null = null;
  if (data && data.n >= 5 && data.p90Sec > 0) range = { lo: data.p50Sec, hi: data.p90Sec };
  else range = coldStartRange(jobKey, count);

  if (!range || range.hi <= 0) return null;
  if (range.lo > 0 && range.hi > range.lo * 4) return null; // variance too high → rely on step

  return (
    <span className="font-mono text-[10px] text-muted-foreground">预计 {formatEtaRange(range.lo, range.hi)}</span>
  );
}
