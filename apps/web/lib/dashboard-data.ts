import "server-only";

import { and, count, desc, eq, isNull, or, sql } from "drizzle-orm";

import {
  channels,
  clerkSops,
  clerkVideos,
  competitorAccounts,
  museIdeas,
  pipelineRuns,
  poetBible,
  poetScripts,
  projectCompetitors,
  projects,
} from "@singularity/db";

import { db } from "./db";

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

export type AccountSummary = {
  id: string;
  name: string;
  slug: string;
  platform: "youtube" | "xhs";
  projectCount: number;
  clerkVideos: number;
  museIdeas: number;
  poetScripts: number;
  // Per-account next action — mirrors the project-hub setup checklist, then the
  // recurring loop (pending ideas → patrol) once setup is complete.
  nextStep: { label: string; href: string };
};

export type DashboardSnapshot = {
  channelCount: number;
  totals: { clerk: number; muse: number; poet: number };
  activity: ActivityRow[];
  pendingMuseIdeas: number;
  competitorCount: number;
  accounts: AccountSummary[];
};

function deriveNextStep(a: {
  slug: string;
  bound: number;
  sops: number;
  hasActiveBible: boolean;
  pendingIdeas: number;
}): { label: string; href: string } {
  const s = encodeURIComponent(a.slug);
  const hub = `/accounts/${s}/projects/${s}`;
  if (a.bound === 0) return { label: "绑定对标账号", href: hub };
  if (a.sops === 0) return { label: "用 Clerk 拆解生成 SOP", href: `/clerk/${s}` };
  if (!a.hasActiveBible) return { label: "生成并选用频道圣经", href: `/accounts/${s}/bible` };
  if (a.pendingIdeas > 0)
    return { label: `${a.pendingIdeas} 个选题待处理`, href: `${hub}/muse` };
  return { label: "让 Muse 巡视出新选题", href: `${hub}/muse` };
}

export async function getDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const [
    accountRows,
    clerkByAccount,
    museByAccount,
    poetByAccount,
    projectsByAccount,
    sopsByAccount,
    activeBibleAccounts,
    pendingByAccount,
    boundByAccount,
    activityRows,
  ] = await Promise.all([
    db
      .select({ id: channels.id, name: channels.name, slug: channels.slug, platform: channels.platform })
      .from(channels)
      .where(eq(channels.userId, userId))
      .orderBy(desc(channels.createdAt)),
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
      .select({ channelId: clerkSops.channelId, c: count() })
      .from(clerkSops)
      .innerJoin(channels, eq(channels.id, clerkSops.channelId))
      .where(eq(channels.userId, userId))
      .groupBy(clerkSops.channelId),
    db
      .selectDistinct({ channelId: poetBible.channelId })
      .from(poetBible)
      .innerJoin(channels, eq(channels.id, poetBible.channelId))
      .where(and(eq(channels.userId, userId), eq(poetBible.isActive, true))),
    db
      .select({ channelId: museIdeas.channelId, c: count() })
      .from(museIdeas)
      .innerJoin(channels, eq(channels.id, museIdeas.channelId))
      .where(
        and(
          eq(channels.userId, userId),
          eq(museIdeas.approved, false),
          eq(museIdeas.scripted, false),
        ),
      )
      .groupBy(museIdeas.channelId),
    // Per-account live competitor bindings (project.id == own_account.id spine).
    db
      .select({ ownAccountId: projects.ownAccountId, c: count() })
      .from(projectCompetitors)
      .innerJoin(projects, eq(projects.id, projectCompetitors.projectId))
      .innerJoin(
        competitorAccounts,
        eq(competitorAccounts.id, projectCompetitors.competitorAccountId),
      )
      .where(and(eq(projects.userId, userId), isNull(competitorAccounts.deletedAt)))
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

  const clerkMap = new Map(clerkByAccount.map((r) => [r.channelId, r.c]));
  const museMap = new Map(museByAccount.map((r) => [r.channelId, r.c]));
  const poetMap = new Map(poetByAccount.map((r) => [r.channelId, r.c]));
  const projectMap = new Map(projectsByAccount.map((r) => [r.ownAccountId, r.c]));
  const sopMap = new Map(sopsByAccount.map((r) => [r.channelId, r.c]));
  const bibleSet = new Set(activeBibleAccounts.map((r) => r.channelId));
  const pendingMap = new Map(pendingByAccount.map((r) => [r.channelId, r.c]));
  const boundMap = new Map(boundByAccount.map((r) => [r.ownAccountId, r.c]));

  const accounts: AccountSummary[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    platform: a.platform,
    projectCount: projectMap.get(a.id) ?? 0,
    clerkVideos: clerkMap.get(a.id) ?? 0,
    museIdeas: museMap.get(a.id) ?? 0,
    poetScripts: poetMap.get(a.id) ?? 0,
    nextStep: deriveNextStep({
      slug: a.slug,
      bound: boundMap.get(a.id) ?? 0,
      sops: sopMap.get(a.id) ?? 0,
      hasActiveBible: bibleSet.has(a.id),
      pendingIdeas: pendingMap.get(a.id) ?? 0,
    }),
  }));

  const sum = (rows: Array<{ c: number }>) => rows.reduce((s, r) => s + r.c, 0);

  return {
    channelCount: accountRows.length,
    totals: { clerk: sum(clerkByAccount), muse: sum(museByAccount), poet: sum(poetByAccount) },
    activity: activityRows,
    pendingMuseIdeas: sum(pendingByAccount),
    competitorCount: sum(boundByAccount),
    accounts,
  };
}
