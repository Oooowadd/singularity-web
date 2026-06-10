import "server-only";

import { and, count, desc, eq, gte, or, sql } from "drizzle-orm";

import {
  channels,
  clerkVideos,
  competitorAccounts,
  museIdeas,
  pipelineRuns,
  poetScripts,
  projectCompetitors,
  projects,
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
  // Coalesced display name; channelSlug is null for competitor-target clerk runs.
  channelName: string;
  channelSlug: string | null;
  competitorAccountId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
};

export type RunningByAgent = Record<"clerk" | "muse" | "poet", boolean>;

export type AccountSummary = {
  id: string;
  name: string;
  slug: string;
  platform: "youtube" | "xhs";
  projectCount: number;
  clerkVideos: number;
  museIdeas: number;
  poetScripts: number;
};

export type DashboardSnapshot = {
  channelCount: number;
  activeRunCount: number;
  runningByAgent: RunningByAgent;
  stats: AgentStats;
  activity: ActivityRow[];
  pendingMuseIdeas: number;
  competitorCount: number;
  accounts: AccountSummary[];
};

export async function getDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    accountRows,
    [activeRunRow],
    [clerkRow],
    [clerkDeltaRow],
    [museRow],
    [museDeltaRow],
    [poetRow],
    [poetDeltaRow],
    [pendingMuseRow],
    [competitorRow],
    clerkByAccount,
    museByAccount,
    poetByAccount,
    projectsByAccount,
    activityRows,
  ] = await Promise.all([
    db
      .select({ id: channels.id, name: channels.name, slug: channels.slug, platform: channels.platform })
      .from(channels)
      .where(eq(channels.userId, userId))
      .orderBy(desc(channels.createdAt)),
    db
      .select({ c: count() })
      .from(pipelineRuns)
      .leftJoin(channels, eq(channels.id, pipelineRuns.channelId))
      .leftJoin(competitorAccounts, eq(competitorAccounts.id, pipelineRuns.competitorAccountId))
      .where(
        and(
          or(eq(channels.userId, userId), eq(competitorAccounts.userId, userId)),
          eq(pipelineRuns.status, "running"),
        ),
      ),
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
      .select({ c: count() })
      .from(projectCompetitors)
      .innerJoin(projects, eq(projects.id, projectCompetitors.projectId))
      .where(eq(projects.userId, userId)),
    db
      .select({ channelId: clerkVideos.channelId, c: count() })
      .from(clerkVideos)
      .innerJoin(channels, eq(channels.id, clerkVideos.channelId))
      .where(eq(channels.userId, userId))
      .groupBy(clerkVideos.channelId),
    db
      .select({ channelId: museIdeas.channelId, c: count() })
      .from(museIdeas)
      .innerJoin(channels, eq(channels.id, museIdeas.channelId))
      .where(eq(channels.userId, userId))
      .groupBy(museIdeas.channelId),
    db
      .select({ channelId: poetScripts.channelId, c: count() })
      .from(poetScripts)
      .innerJoin(channels, eq(channels.id, poetScripts.channelId))
      .where(eq(channels.userId, userId))
      .groupBy(poetScripts.channelId),
    db
      .select({ ownAccountId: projects.ownAccountId, c: count() })
      .from(projects)
      .where(eq(projects.userId, userId))
      .groupBy(projects.ownAccountId),
    db
      .select({
        id: pipelineRuns.id,
        agent: pipelineRuns.agent,
        command: pipelineRuns.command,
        status: pipelineRuns.status,
        channelName: sql<string>`coalesce(${channels.name}, ${competitorAccounts.name}, ${competitorAccounts.url}, '未知目标')`,
        channelSlug: channels.slug,
        competitorAccountId: pipelineRuns.competitorAccountId,
        startedAt: pipelineRuns.startedAt,
        completedAt: pipelineRuns.completedAt,
        errorMessage: pipelineRuns.errorMessage,
      })
      .from(pipelineRuns)
      .leftJoin(channels, eq(channels.id, pipelineRuns.channelId))
      .leftJoin(competitorAccounts, eq(competitorAccounts.id, pipelineRuns.competitorAccountId))
      .where(or(eq(channels.userId, userId), eq(competitorAccounts.userId, userId)))
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(10),
  ]);

  const runningByAgent: RunningByAgent = { clerk: false, muse: false, poet: false };
  for (const row of activityRows) {
    if (row.status === "running" || row.status === "pending") {
      runningByAgent[row.agent] = true;
    }
  }

  const clerkMap = new Map(clerkByAccount.map((r) => [r.channelId, r.c]));
  const museMap = new Map(museByAccount.map((r) => [r.channelId, r.c]));
  const poetMap = new Map(poetByAccount.map((r) => [r.channelId, r.c]));
  const projectMap = new Map(projectsByAccount.map((r) => [r.ownAccountId, r.c]));
  const accounts: AccountSummary[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    platform: a.platform,
    projectCount: projectMap.get(a.id) ?? 0,
    clerkVideos: clerkMap.get(a.id) ?? 0,
    museIdeas: museMap.get(a.id) ?? 0,
    poetScripts: poetMap.get(a.id) ?? 0,
  }));

  return {
    channelCount: accountRows.length,
    activeRunCount: activeRunRow?.c ?? 0,
    runningByAgent,
    stats: {
      clerk: { total: clerkRow?.c ?? 0, deltaSevenDay: clerkDeltaRow?.c ?? 0 },
      muse: { total: museRow?.c ?? 0, deltaSevenDay: museDeltaRow?.c ?? 0 },
      poet: { total: poetRow?.c ?? 0, deltaSevenDay: poetDeltaRow?.c ?? 0 },
    },
    activity: activityRows,
    pendingMuseIdeas: pendingMuseRow?.c ?? 0,
    competitorCount: competitorRow?.c ?? 0,
    accounts,
  };
}
