import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cnHour } from "@/lib/cn-time";
import { ensureCurrentUser } from "@/lib/users";
import { getDashboardSnapshot } from "@/lib/dashboard-data";

import { ActivityFeed } from "./_components/activity-feed";
import { AgentStatCards } from "./_components/agent-stat-cards";
import { DashboardRefresher } from "./_components/dashboard-refresher";
import { NextStepCard } from "./_components/next-step-card";

function greeting(): string {
  const h = cnHour();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function resolveDisplayName(displayName: string | null, email: string): string | null {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed.split(/\s+/)[0] ?? trimmed;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  // Strip common digit suffixes like justin123 → justin
  return local.replace(/[._-]?\d+$/, "");
}

export default async function DashboardPage() {
  const user = await ensureCurrentUser();
  if (!user) return null;

  const snapshot = await getDashboardSnapshot(user.id);
  const name = resolveDisplayName(user.displayName ?? null, user.email);
  const hello = `${greeting()}${name ? `，${name}` : ""}`;

  if (snapshot.channelCount === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="font-display text-4xl italic">{hello}</h1>
        <p className="text-sm text-muted-foreground">
          Singularity 围绕你自己的频道运转，先建一个再回来。
        </p>
        <Button render={<Link href="/channels/new" />} size="lg" className="mt-2">
          <Plus data-icon="inline-start" />
          创建第一个频道
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-8 p-6 md:p-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl italic leading-tight md:text-4xl">{hello}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border bg-card px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {snapshot.channelCount} 个频道
            </span>
            {snapshot.activeRunCount > 0 ? (
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400">
                {snapshot.activeRunCount} 个任务进行中
              </span>
            ) : null}
          </div>
        </div>
        <DashboardRefresher />
      </header>

      <AgentStatCards stats={snapshot.stats} runningByAgent={snapshot.runningByAgent} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <ActivityFeed activity={snapshot.activity} />
        <NextStepCard
          channelCount={snapshot.channelCount}
          clerkTotal={snapshot.stats.clerk.total}
          museTotal={snapshot.stats.muse.total}
          poetTotal={snapshot.stats.poet.total}
          pendingMuseIdeas={snapshot.pendingMuseIdeas}
        />
      </div>
    </div>
  );
}
