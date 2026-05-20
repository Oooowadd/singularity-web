"use client";

import { CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Props = {
  competitorsText: string;
};

type RowStatus =
  | { state: "idle" }
  | { state: "verifying" }
  | { state: "ok"; name: string; platform: "youtube" | "xhs"; subtitle: string }
  | { state: "err"; message: string };

function inferPlatform(url: string): "youtube" | "xhs" {
  return url.includes("xiaohongshu") ? "xhs" : "youtube";
}

function formatCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Serial verify — TikHub routes share a rate limit so we can't fan out.
export function CompetitorListPreview({ competitorsText }: Props) {
  const [rows, setRows] = useState<Array<{ url: string; status: RowStatus }>>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyMutation = trpc.channels.verifyUrl.useMutation();

  const lines = competitorsText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const handleVerifyAll = async () => {
    if (lines.length === 0 || isVerifying) return;
    setIsVerifying(true);
    const initial = lines.map((url) => ({ url, status: { state: "verifying" } as RowStatus }));
    setRows(initial);

    const next = [...initial];
    for (let i = 0; i < lines.length; i++) {
      const url = lines[i]!;
      const platform = inferPlatform(url);
      try {
        const result = await verifyMutation.mutateAsync({ platform, url });
        const subtitle =
          result.platform === "xhs"
            ? `粉丝 ${formatCount(result.fansCount)} · 获赞 ${formatCount(result.interactionsCount)}${result.ipLocation ? ` · IP ${result.ipLocation}` : ""}`
            : `订阅 ${formatCount(result.subscriberCount)} · 视频 ${formatCount(result.videoCount)}`;
        next[i] = {
          url,
          status: {
            state: "ok",
            name: result.name,
            platform: result.platform,
            subtitle,
          },
        };
      } catch (err) {
        next[i] = {
          url,
          status: { state: "err", message: (err as Error).message.slice(0, 200) },
        };
      }
      setRows([...next]);
    }
    setIsVerifying(false);
  };

  const verifiedCount = rows.filter((r) => r.status.state === "ok").length;
  const errorCount = rows.filter((r) => r.status.state === "err").length;
  const inProgress = rows.filter((r) => r.status.state === "verifying").length;
  const total = rows.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleVerifyAll}
          disabled={lines.length === 0 || isVerifying}
        >
          {isVerifying ? (
            <Loader2 data-icon="inline-start" className="size-3 animate-spin" />
          ) : (
            <Search data-icon="inline-start" className="size-3" />
          )}
          {isVerifying ? `验证中 ${total - inProgress}/${total}` : "验证全部 / 预览"}
        </Button>
        {!isVerifying && total > 0 ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            ✓ {verifiedCount}
            {errorCount > 0 ? ` · ✗ ${errorCount}` : ""}
          </span>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-md border bg-card/50 p-2">
          {rows.map((row, i) => (
            <RowCard key={`${row.url}-${i}`} index={i + 1} url={row.url} status={row.status} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RowCard({ index, url, status }: { index: number; url: string; status: RowStatus }) {
  return (
    <div className="flex items-start gap-2 rounded border bg-background p-2 text-xs">
      <span className="mt-0.5 inline-block w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
        {index}
      </span>

      {status.state === "verifying" ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> 验证中…
        </span>
      ) : status.state === "ok" ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate font-medium">{status.name}</span>
            <span className="rounded bg-red-500/10 px-1 py-0.5 text-[9px] font-medium text-red-700 dark:text-red-400">
              {status.platform === "xhs" ? "小红书" : "YouTube"}
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{status.subtitle}</span>
        </div>
      ) : status.state === "err" ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <XCircle className="size-3 shrink-0 text-destructive" />
            <span className="truncate font-mono text-[10px] text-muted-foreground">{url.slice(0, 50)}</span>
          </div>
          <span className="text-destructive">{status.message}</span>
        </div>
      ) : (
        <span className="font-mono text-[10px] text-muted-foreground">{url.slice(0, 50)}</span>
      )}
    </div>
  );
}
