import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { pipelineRuns, poetCustomTopics } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const cid = process.argv[2]!;
  const [t] = await db.insert(poetCustomTopics).values({
    channelId: cid,
    topic: "蓝靛的颜色为什么不是蓝？工艺与化学",
    references: [{ kind: "xhs", url: "https://www.xiaohongshu.com/explore/69e3773e000000001f0054b2" }],
    language: "zh",
    durationMinutes: 5,
    targetWordCount: 1000,
  }).returning({ id: poetCustomTopics.id });
  const [r] = await db.insert(pipelineRuns).values({
    channelId: cid, agent: "poet", command: "poet-analyze-custom-topic", status: "pending",
    configJson: { smoke: true, topicId: t!.id },
  }).returning({ id: pipelineRuns.id });
  console.log(JSON.stringify({ topicId: t!.id, runId: r!.id }));
} finally { await c.end(); }
