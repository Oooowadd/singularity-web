import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pipelineRuns } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const [row] = await db.insert(pipelineRuns).values({
    channelId: process.argv[2]!, agent: "muse", command: "muse-monitor-competitors", status: "pending",
    configJson: { smoke: true },
  }).returning({ id: pipelineRuns.id });
  console.log(row!.id);
} finally { await c.end(); }
