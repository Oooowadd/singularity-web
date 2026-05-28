import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pipelineRuns } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  // Mark pending/running rows older than 30 minutes as canceled — they're orphans.
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const stuck = await db.update(pipelineRuns).set({
    status: "failed",
    errorMessage: "Auto-canceled: stale pending/running > 30 min (orphan)",
    completedAt: new Date(),
  }).where(and(
    inArray(pipelineRuns.status, ["pending", "running"]),
    lt(pipelineRuns.startedAt, cutoff),
  )).returning({ id: pipelineRuns.id, agent: pipelineRuns.agent, command: pipelineRuns.command, channelId: pipelineRuns.channelId });
  console.log(`canceled ${stuck.length} stale runs:`);
  for (const r of stuck) console.log(`  ${r.id} | ${r.agent}/${r.command}`);
} finally { await c.end(); }
