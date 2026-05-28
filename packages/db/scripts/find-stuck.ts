import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { channels, pipelineRuns } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const [ch] = await db.select().from(channels).where(eq(channels.slug, "fireship"));
  if (!ch) { console.error("no fireship"); process.exit(1); }
  console.log(`channel: ${ch.name} (${ch.id})`);
  const stuck = await db.select().from(pipelineRuns)
    .where(and(eq(pipelineRuns.channelId, ch.id), inArray(pipelineRuns.status, ["pending", "running"])))
    .orderBy(desc(pipelineRuns.startedAt)).limit(10);
  console.log(`\nactive runs: ${stuck.length}`);
  for (const r of stuck) {
    console.log(`  ${r.id} | agent=${r.agent} | status=${r.status} | started=${r.startedAt} | cmd=${r.command}`);
    console.log(`    cfg: ${JSON.stringify(r.configJson)?.slice(0, 200)}`);
  }
} finally { await c.end(); }
