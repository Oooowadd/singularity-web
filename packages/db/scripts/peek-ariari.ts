// Read-only: verify AriAri competitor analysis data landed (bug-1 triage).
// Run: pnpm --filter @goooose/db exec tsx scripts/peek-ariari.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const id = "4e775844-e883-4038-8f4c-f66762b4123f";
try {
  const [videos] = await sql`
    SELECT count(*)::int AS n, count(*) FILTER (WHERE channel_id IS NOT NULL)::int AS bad
    FROM clerk_videos WHERE competitor_account_id = ${id}`;
  console.log(`videos: ${videos!.n} (bad-stamped: ${videos!.bad})`);
  const sops = await sql`
    SELECT sop_type, generated_at FROM clerk_sops WHERE competitor_account_id = ${id}`;
  console.log("sops:", sops.map((s) => s.sop_type).join(", ") || "none");
  const runs = await sql`
    SELECT id, status, started_at, finished_at FROM pipeline_runs
    WHERE competitor_account_id = ${id} ORDER BY started_at DESC LIMIT 3`;
  for (const r of runs) console.log(`run ${r.id.slice(0, 8)} ${r.status} ${r.started_at} → ${r.finished_at}`);
  const bindings = await sql`
    SELECT ps.project_id, ps.role FROM project_sops ps
    JOIN clerk_sops cs ON cs.id = ps.sop_id WHERE cs.competitor_account_id = ${id}`;
  console.log("bindings:", JSON.stringify(bindings));
} finally {
  await sql.end();
}
