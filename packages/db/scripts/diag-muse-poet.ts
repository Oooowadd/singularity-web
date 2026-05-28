import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  museIdeas,
  museMonitorVideos,
  pipelineRuns,
  poetBible,
  poetCustomTopics,
  poetScripts,
} from "../src/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

try {
  console.log("=== Recent Muse runs ===");
  const muRuns = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.agent, "muse"))
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(3);
  for (const r of muRuns) {
    console.log(`\n${r.id} | ${r.status} | ${r.progress}/${r.total}`);
    const vids = await db
      .select()
      .from(museMonitorVideos)
      .where(eq(museMonitorVideos.channelId, r.channelId))
      .orderBy(desc(museMonitorVideos.processedAt))
      .limit(2);
    console.log(`  monitor videos in channel: ${vids.length}`);
    for (const v of vids) console.log(`    - ${v.title?.slice(0, 70)} | topic=${v.topicClassification ?? "—"} | rejected=${v.rejectionReason ?? "no"}`);
    const ideas = await db
      .select()
      .from(museIdeas)
      .where(eq(museIdeas.runId, r.id))
      .limit(3);
    console.log(`  ideas: ${ideas.length}`);
    for (const i of ideas) {
      console.log(`    #${i.ideaNumber}: storyAngle="${i.storyAngle?.slice(0, 80)}..."`);
      console.log(`         viralTrigger="${i.viralTrigger?.slice(0, 80)}..."`);
      console.log(`         whySimilar="${i.whySimilar?.slice(0, 80)}..."`);
    }
  }

  console.log("\n=== Recent Poet runs ===");
  const poRuns = await db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.agent, "poet"))
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(3);
  for (const r of poRuns) {
    console.log(`\n${r.id} | ${r.status} | ${r.command} | ${r.progress}/${r.total}`);
  }

  console.log("\n=== Latest Poet Scripts ===");
  const scripts = await db
    .select()
    .from(poetScripts)
    .orderBy(desc(poetScripts.generatedAt))
    .limit(3);
  for (const s of scripts) {
    console.log(`\n${s.id} | ${s.scriptText?.length ?? 0} chars | words=${s.wordCount ?? "?"} | duration=${s.durationMinutes ?? "?"}min | lang=${s.language}`);
    console.log(`  head: ${s.scriptText?.slice(0, 200)}...`);
  }

  console.log("\n=== Latest Poet Bibles ===");
  const bibles = await db
    .select()
    .from(poetBible)
    .orderBy(desc(poetBible.generatedAt))
    .limit(2);
  for (const b of bibles) {
    console.log(`\n${b.id} | ${b.name} | ${b.content?.length ?? 0} chars`);
    console.log(`  head: ${b.content?.slice(0, 300)}...`);
  }

  console.log("\n=== Latest Poet Custom Topics ===");
  const topics = await db
    .select()
    .from(poetCustomTopics)
    .orderBy(desc(poetCustomTopics.createdAt))
    .limit(3);
  for (const t of topics) {
    console.log(`\n${t.id} | "${t.topic?.slice(0, 80)}"`);
    console.log(`  storyAngle: ${t.storyAngle?.slice(0, 150)}`);
    console.log(`  viralTrigger: ${t.viralTrigger?.slice(0, 150)}`);
  }
} finally {
  await client.end();
}
