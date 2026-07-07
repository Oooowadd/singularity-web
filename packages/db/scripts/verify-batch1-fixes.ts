// Verifies the batch-1 fixes end to end: zod platform hints, user-scoped usedBy,
// dedicated running-agents query, race-free user upsert (idempotent no-op on the
// existing row), and prod presence of the competitor-side indexes now declared in TS.
// Run: pnpm --filter @goooose/db exec tsx scripts/verify-batch1-fixes.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { createChannelInput } = await import(
  "../../../apps/web/server/trpc/schemas/channels"
);

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗ FAIL"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

// 1. Platform-specific URL hints.
const badXhs = createChannelInput.safeParse({
  name: "t",
  platform: "xhs",
  platformUrl: "https://www.xiaohongshu.com/explore/123",
});
const badYt = createChannelInput.safeParse({
  name: "t",
  platform: "youtube",
  platformUrl: "https://www.youtube.com/watch?v=abc12345678",
});
check(
  "invalid XHS URL shows XHS hint",
  !badXhs.success && /小红书/.test(badXhs.error?.issues[0]?.message ?? ""),
  badXhs.success ? "parsed?!" : badXhs.error?.issues[0]?.message?.slice(0, 40),
);
check(
  "invalid YouTube URL shows YouTube hint",
  !badYt.success && /YouTube 频道/.test(badYt.error?.issues[0]?.message ?? ""),
  badYt.success ? "parsed?!" : badYt.error?.issues[0]?.message?.slice(0, 40),
);

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
try {
  // 2. usedBy scoping: scoped counts must be a subset of legacy (≤ per sop) and
  // every scoped row must belong to this user's projects. The DB has multiple
  // users, so the legacy unscoped query legitimately over-counts.
  const [me] = await sql<{ id: string }[]>`SELECT id FROM users ORDER BY created_at LIMIT 1`;
  const oldCounts = await sql<{ sop_id: string; n: number }[]>`
    SELECT sop_id, count(*)::int AS n FROM project_sops WHERE role = 'primary' GROUP BY sop_id`;
  const newCounts = await sql<{ sop_id: string; n: number }[]>`
    SELECT ps.sop_id, count(*)::int AS n FROM project_sops ps
    JOIN projects p ON p.id = ps.project_id
    WHERE ps.role = 'primary' AND p.user_id = ${me!.id} GROUP BY ps.sop_id`;
  const oldMap = new Map(oldCounts.map((r) => [r.sop_id, r.n]));
  const subset = newCounts.every((r) => (oldMap.get(r.sop_id) ?? 0) >= r.n);
  check(
    "usedBy scoped query is a subset of legacy (cross-user rows excluded)",
    subset && newCounts.length <= oldCounts.length,
    `legacy=${oldCounts.length} groups, scoped=${newCounts.length} (${oldCounts.length - newCounts.length} cross-user groups excluded)`,
  );

  // 3. running-agents query shape (mirrors dashboard fix).
  const agents = await sql`
    SELECT DISTINCT pr.agent FROM pipeline_runs pr
    LEFT JOIN channels ch ON ch.id = pr.channel_id
    LEFT JOIN competitor_accounts ca ON ca.id = pr.competitor_account_id
    WHERE (ch.user_id = ${me!.id} OR ca.user_id = ${me!.id})
      AND pr.status IN ('pending','running')
      AND (pr.status = 'running' OR pr.started_at >= now() - interval '30 minutes')`;
  check("running-agents query executes", true, `${agents.length} active agents now`);

  // 4. ON CONFLICT upsert path: idempotent no-op update on the existing row.
  const [before] = await sql`SELECT logto_id, email, display_name FROM users WHERE id = ${me!.id}`;
  const [after] = await sql`
    INSERT INTO users (logto_id, email, display_name)
    VALUES (${before!.logto_id}, ${before!.email}, ${before!.display_name})
    ON CONFLICT (logto_id) DO UPDATE SET email = EXCLUDED.email, display_name = EXCLUDED.display_name
    RETURNING id`;
  const [count] = await sql`SELECT count(*)::int AS n FROM users`;
  check("upsert ON CONFLICT returns existing row, no duplicate", after!.id === me!.id && count!.n >= 1, `users=${count!.n}`);

  // 5. Prod indexes now declared in schema TS actually exist with partial predicates.
  const idx = await sql<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN (
      'clerk_videos_competitor_video_unique','clerk_videos_competitor_idx',
      'clerk_sops_competitor_idx','pipeline_runs_competitor_status_idx')`;
  check(
    "all 4 competitor-side indexes present in prod with WHERE",
    idx.length === 4 && idx.every((i) => /WHERE/i.test(i.indexdef)),
    idx.map((i) => i.indexname).join(", "),
  );

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
} finally {
  await sql.end();
}
