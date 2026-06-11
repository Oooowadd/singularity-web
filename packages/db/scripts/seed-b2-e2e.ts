// Seeds the five pipeline_runs rows for the post-refactor machine E2E suite and
// prints the ids + the muse target's bound competitor. Read-only except the inserts.
// Run: pnpm --filter @singularity/db exec tsx scripts/seed-b2-e2e.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const JUSTIN = "dea4aabb-4edd-4c0f-aa55-d08d0f956dad";
const HACKBEAR = "4306a62d-0d1e-4352-ab58-3917bf7dc63c";
const BIAOSHU = "48d98f95-7bdd-4259-8e10-1750123abdd5";

try {
  const [comp] = await sql<{ competitor_account_id: string; url: string }[]>`
    SELECT pc.competitor_account_id, ca.url FROM project_competitors pc
    JOIN competitor_accounts ca ON ca.id = pc.competitor_account_id
    WHERE pc.project_id = ${HACKBEAR} AND ca.deleted_at IS NULL AND ca.platform = 'youtube'
    LIMIT 1`;
  console.log(`muse competitor: ${comp?.competitor_account_id ?? "NONE"} ${comp?.url ?? ""}`);

  const seed = async (owner: Record<string, string>, agent: string, command: string) => {
    const col = "channelId" in owner ? sql`channel_id` : sql`competitor_account_id`;
    const val = Object.values(owner)[0]!;
    const [r] = await sql<{ id: string }[]>`
      INSERT INTO pipeline_runs (${col}, agent, command, status)
      VALUES (${val}, ${agent}, ${command}, 'pending') RETURNING id`;
    return r!.id;
  };

  console.log("clerk-own:", await seed({ channelId: JUSTIN }, "clerk", "clerk-analyze-channel"));
  console.log("series:", await seed({ channelId: JUSTIN }, "clerk", "clerk-detect-channel-series"));
  console.log("muse:", await seed({ channelId: HACKBEAR }, "muse", "muse-monitor-competitors"));
  console.log("bible:", await seed({ channelId: JUSTIN }, "poet", "poet-generate-bible"));
  console.log("script:", await seed({ channelId: BIAOSHU }, "poet", "poet-generate-script"));
} finally {
  await sql.end();
}
