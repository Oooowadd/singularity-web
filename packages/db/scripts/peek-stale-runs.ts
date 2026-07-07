// Read-only: list pending/running pipeline_runs with age (stale-run triage).
// Run: pnpm --filter @goooose/db exec tsx scripts/peek-stale-runs.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
try {
  const rows = await sql`
    SELECT pr.id, pr.agent, pr.command, pr.status, pr.started_at,
      coalesce(ch.name, ca.name) AS target,
      round(extract(epoch FROM (now() - pr.started_at)) / 3600, 1) AS age_hours
    FROM pipeline_runs pr
    LEFT JOIN channels ch ON ch.id = pr.channel_id
    LEFT JOIN competitor_accounts ca ON ca.id = pr.competitor_account_id
    WHERE pr.status IN ('pending', 'running')
    ORDER BY pr.started_at`;
  for (const r of rows)
    console.log(`${r.id}  [${r.agent}/${r.status}] ${r.command} target=${r.target} age=${r.age_hours}h`);
  if (rows.length === 0) console.log("(no pending/running rows)");
} finally {
  await sql.end();
}
