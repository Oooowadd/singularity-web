import Link from "next/link";
import { Loader2 } from "lucide-react";

import type { ActivityRow } from "@/lib/dashboard-data";
import { AGENT_LABEL, COMMAND_LABEL } from "@/lib/run-labels";

import { agentDeepLink } from "./activity-feed";

// One-line "what's running right now" strip (rows pre-filtered in dashboard-data).
export function ActiveNowStrip({ active }: { active: ActivityRow[] }) {
  if (active.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        正在进行
      </span>
      {active.map((r) => (
        <Link
          key={r.id}
          href={agentDeepLink(r)}
          className="flex items-center gap-2.5 text-sm hover:underline"
        >
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          <span className="font-medium">{AGENT_LABEL[r.agent] ?? r.agent}</span>
          <span className="truncate">{r.channelName}</span>
          <span className="text-xs text-muted-foreground">
            {COMMAND_LABEL[r.command] ?? r.command}
          </span>
        </Link>
      ))}
    </div>
  );
}
