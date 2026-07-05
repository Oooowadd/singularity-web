import { and, eq, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { channels } from "../schema/channels";
import { competitorAccounts } from "../schema/competitor";
import { usageCounters } from "../schema/quota";
import { users, type BonusBalances } from "../schema/users";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PostgresJsDatabase<any>;

export type QuotaUnit = "contents" | "generations";

export const PLAN_QUOTAS: Record<string, { accounts: number; contents: number; generations: number }> = {
  free: { accounts: 5, contents: 50, generations: 20 },
};

export function planQuota(plan: string) {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free!;
}

// 1 条 = ≤10min video or one image post; each extra 10min counts one more.
export function contentUnits(durationSec?: number | null): number {
  if (!durationSec || durationSec <= 0) return 1;
  return Math.max(1, Math.ceil(durationSec / 600));
}

// Quota months roll over on the Asia/Shanghai calendar.
export function currentPeriod(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

const COUNTER_COLUMN = {
  contents: usageCounters.contentsUsed,
  generations: usageCounters.generationsUsed,
} as const;

export type QuotaSnapshot = {
  allowed: boolean;
  base: number;
  monthUsed: number;
  bonusRemaining: number;
  remaining: number;
};

export async function checkQuota(
  db: AnyDb,
  args: { userId: string; unit: QuotaUnit; need?: number },
): Promise<QuotaSnapshot> {
  const need = args.need ?? 1;
  const [user] = await db
    .select({ plan: users.plan, bonus: users.bonusBalances })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  const base = planQuota(user?.plan ?? "free")[args.unit];
  const bonusRemaining = Math.max((user?.bonus as BonusBalances | null)?.[args.unit] ?? 0, 0);
  const [counter] = await db
    .select({ used: COUNTER_COLUMN[args.unit] })
    .from(usageCounters)
    .where(and(eq(usageCounters.userId, args.userId), eq(usageCounters.period, currentPeriod())))
    .limit(1);
  const monthUsed = counter?.used ?? 0;
  const remaining = base + bonusRemaining - monthUsed;
  return { allowed: remaining >= need, base, monthUsed, bonusRemaining, remaining };
}

// Increment the monthly counter; overflow past the plan base consumes the
// one-time bonus pool (floor 0). Two statements — per-user run concurrency
// caps make the race window negligible at beta scale.
export async function consumeQuota(
  db: AnyDb,
  args: { userId: string; unit: QuotaUnit; amount: number },
): Promise<void> {
  if (args.amount <= 0) return;
  const [user] = await db
    .select({ plan: users.plan, bonus: users.bonusBalances })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  if (!user) return;
  const base = planQuota(user.plan ?? "free")[args.unit];
  const column = COUNTER_COLUMN[args.unit];
  const values =
    args.unit === "contents"
      ? { userId: args.userId, period: currentPeriod(), contentsUsed: args.amount }
      : { userId: args.userId, period: currentPeriod(), generationsUsed: args.amount };
  const [row] = await db
    .insert(usageCounters)
    .values(values)
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.period],
      set: { [args.unit === "contents" ? "contentsUsed" : "generationsUsed"]: sql`${column} + ${args.amount}`, updatedAt: new Date() },
    })
    .returning({ used: column });
  const usedAfter = row?.used ?? args.amount;
  const overflow = Math.min(Math.max(usedAfter - base, 0), args.amount);
  if (overflow > 0) {
    const key = sql.raw(`'{${args.unit}}'`);
    await db
      .update(users)
      .set({
        bonusBalances: sql`jsonb_set(coalesce(${users.bonusBalances}, '{}'::jsonb), ${key}, to_jsonb(greatest(coalesce((${users.bonusBalances}->>${args.unit})::int, 0) - ${overflow}, 0)))`,
      })
      .where(eq(users.id, args.userId));
  }
}

export async function countAccounts(db: AnyDb, userId: string): Promise<number> {
  const [own] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(channels)
    .where(eq(channels.userId, userId));
  const [comp] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(competitorAccounts)
    .where(and(eq(competitorAccounts.userId, userId), isNull(competitorAccounts.deletedAt)));
  return (own?.n ?? 0) + (comp?.n ?? 0);
}

export async function checkAccountQuota(
  db: AnyDb,
  args: { userId: string; need?: number },
): Promise<QuotaSnapshot> {
  const need = args.need ?? 1;
  const [user] = await db
    .select({ plan: users.plan, bonus: users.bonusBalances })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  const base = planQuota(user?.plan ?? "free").accounts;
  const bonusRemaining = Math.max((user?.bonus as BonusBalances | null)?.accounts ?? 0, 0);
  const monthUsed = await countAccounts(db, args.userId);
  const remaining = base + bonusRemaining - monthUsed;
  return { allowed: remaining >= need, base, monthUsed, bonusRemaining, remaining };
}
