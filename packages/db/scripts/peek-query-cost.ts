// Read-only: Postgres-reported execution time (compute only, no network) for the
// heaviest landing-page query — proves DB compute vs wire-time split.
// Run: pnpm --filter @singularity/db exec tsx scripts/peek-query-cost.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
try {
  const rows = await sql.unsafe(`EXPLAIN (ANALYZE, FORMAT TEXT)
    SELECT ca.id, ca.name,
      (SELECT count(*)::int FROM clerk_videos cv WHERE cv.competitor_account_id = ca.id) AS videos,
      (SELECT count(*)::int FROM clerk_sops cs WHERE cs.competitor_account_id = ca.id AND cs.sop_type != 'ai_reference') AS sops
    FROM competitor_accounts ca ORDER BY ca.created_at`);
  const lines = rows.map((r: Record<string, string>) => Object.values(r)[0]);
  console.log(lines.filter((l) => l!.includes("Execution Time") || l!.includes("Planning Time")).join("\n"));
} finally {
  await sql.end();
}
