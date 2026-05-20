import "server-only";

import { and, count, desc, eq, gte } from "drizzle-orm";

import {
  channels,
  clerkVideos,
  museIdeas,
  pipelineRuns,
  poetScripts,
} from "@singularity/db";

import { db } from "./db";

export type AgentStats = {
  clerk: { total: number; deltaSevenDay: number };
  muse: { total: number; deltaSevenDay: number };
  poet: { total: number; deltaSevenDay: number };
};

export type ActivityRow = {
  id: string;
  agent: "clerk" | "muse" | "poet";
  command: string;
  status: "pending" | "running" | "done" | "failed";
  channelName: string;
  channelSlug: string;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
};

export type RunningByAgent = Record<"clerk" | "muse" | "poet", boolean>;

export type DashboardSnapshot = {
  channelCount: number;
  activeRunCount: number;
  runningByAgent: RunningByAgent;
  stats: AgentStats;
  activity: ActivityRow[];
  pendingMuseIdeas: number;
};

export async function getDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    [channelCountRow],
    [activeRunRow],
    [clerkRow],
    [clerkDeltaRow],
    [museRow],
    [museDeltaRow],
    [poetRow],
    [poetDeltaRow],
    [pendingMuseRow],
    activityRows,
  ] = await Promise.all([
    db
      .select({ c: count() })
      .from(channels)
      .where(eq(channels.userId, userId)),
    db
      .select({ c: count() })
      .from(pipelineRuns)
      .innerJoin(channels, eq(channels.id, pipelineRuns.channelId))
      .where(and(eq(channels.userId, userId), eq(pipelineRuns.status, "running"))),
    db
      .select({ c: count() })
      .from(clerkVideos)
      .innerJoin(channels, eq(channels.id, clerkVideos.channelId))
      .where(eq(channels.userId, userId)),
    db
      .select({ c: count() })
      .from(clerkVideos)
      .innerJoin(channels, eq(channels.id, clerkVideos.channelId))
      .where(and(eq(channels.userId, userId), gte(clerkVideos.analyzedAt, sevenDaysAgo))),
    db
      .select({ c: count() })
      .from(museIdeas)
      .innerJoin(channels, eq(channels.id, museIdeas.channelId))
      .where(eq(channels.userId, userId)),
    db
      .select({ c: count() })
      .from(museIdeas)
      .innerJoin(channels, eq(channels.id, museIdeas.channelId))
      .where(and(eq(channels.userId, userId), gte(museIdeas.generatedAt, sevenDaysAgo))),
    db
      .select({ c: count() })
      .from(poetScripts)
      .innerJoin(channels, eq(channels.id, poetScripts.channelId))
      .where(eq(channels.userId, userId)),
    db
      .select({ c: count() })
      .from(poetScripts)
      .innerJoin(channels, eq(channels.id, poetScripts.channelId))
      .where(and(eq(channels.userId, userId), gte(poetScripts.generatedAt, sevenDaysAgo))),
    db
      .select({ c: count() })
      .from(museIdeas)
      .innerJoin(channels, eq(channels.id, museIdeas.channelId))
      .where(
        and(
          eq(channels.userId, userId),
          eq(museIdeas.approved, false),
          eq(museIdeas.scripted, false),
        ),
      ),
    db
      .select({
        id: pipelineRuns.id,
        agent: pipelineRuns.agent,
        command: pipelineRuns.command,
        status: pipelineRuns.status,
        channelName: channels.name,
        channelSlug: channels.slug,
        startedAt: pipelineRuns.startedAt,
        completedAt: pipelineRuns.completedAt,
        errorMessage: pipelineRuns.errorMessage,
      })
      .from(pipelineRuns)
      .innerJoin(channels, eq(channels.id, pipelineRuns.channelId))
      .where(eq(channels.userId, userId))
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(10),
  ]);

  const runningByAgent: RunningByAgent = { clerk: false, muse: false, poet: false };
  for (const row of activityRows) {
    if (row.status === "running" || row.status === "pending") {
      runningByAgent[row.agent] = true;
    }
  }

  return {
    channelCount: channelCountRow?.c ?? 0,
    activeRunCount: activeRunRow?.c ?? 0,
    runningByAgent,
    stats: {
      clerk: {
        total: clerkRow?.c ?? 0,
        deltaSevenDay: clerkDeltaRow?.c ?? 0,
      },
      muse: {
        total: museRow?.c ?? 0,
        deltaSevenDay: museDeltaRow?.c ?? 0,
      },
      poet: {
        total: poetRow?.c ?? 0,
        deltaSevenDay: poetDeltaRow?.c ?? 0,
      },
    },
    activity: activityRows,
    pendingMuseIdeas: pendingMuseRow?.c ?? 0,
  };
}
