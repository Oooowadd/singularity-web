import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clerkSops, pipelineRuns } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);
try {
  const [latest] = await db.select().from(pipelineRuns)
    .where(eq(pipelineRuns.agent, "clerk")).orderBy(desc(pipelineRuns.startedAt)).limit(1);
  if (!latest) throw new Error("no run");
  const sops = await db.select().from(clerkSops).where(eq(clerkSops.runId, latest.id));
  const sopType = process.argv[2] ?? "human";
  const sop = sops.find((s) => s.sopType === sopType);
  if (!sop) { console.error(`no ${sopType} SOP`); process.exit(1); }
  console.log(sop.contentMd);
} finally { await client.end(); }
