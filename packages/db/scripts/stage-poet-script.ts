import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { museIdeas, pipelineRuns } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const cid = process.argv[2]!;
  const [idea] = await db.select().from(museIdeas).where(eq(museIdeas.channelId, cid)).limit(1);
  if (!idea) { console.error("no idea"); process.exit(1); }
  const [run] = await db.insert(pipelineRuns).values({
    channelId: cid, agent: "poet", command: "poet-generate-script", status: "pending",
    configJson: { smoke: true, ideaId: idea.id },
  }).returning({ id: pipelineRuns.id });
  console.log(JSON.stringify({ ideaId: idea.id, runId: run!.id }));
} finally { await c.end(); }
