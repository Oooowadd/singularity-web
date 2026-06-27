/**
 * LIVE Bible-adherence test for Muse idea generation.
 * READ-ONLY: SELECTs an active poet_bible + its channel + a real source video, then runs
 * generateIdeas TWICE (without vs with biblePositioning). No DB writes.
 * Run: pnpm --filter @singularity/db exec tsx scripts/muse-bible-smoke.ts
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { poetBible } from "../src/schema/poet";
import { channels } from "../src/schema/channels";
import { clerkVideos } from "../src/schema/clerk";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { generateIdeas } = await import("@singularity/domain/services/muse");

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

function printIdeas(label: string, ideas: Array<{ story_angle: string; why_similar: string }>) {
  console.log(`\n════════ ${label} (${ideas.length} ideas) ════════`);
  ideas.forEach((idea, i) => {
    console.log(`\n  [${i + 1}] story_angle: ${idea.story_angle}`);
    console.log(`      why_similar: ${idea.why_similar}`);
  });
}

try {
  // 1. An active bible + its channel.
  const bibles = await db
    .select({
      bibleId: poetBible.id,
      bibleName: poetBible.name,
      content: poetBible.content,
      channelId: poetBible.channelId,
      channelName: channels.name,
      channelDescription: channels.description,
      platform: channels.platform,
    })
    .from(poetBible)
    .innerJoin(channels, eq(channels.id, poetBible.channelId))
    .where(eq(poetBible.isActive, true))
    .orderBy(desc(poetBible.generatedAt))
    .limit(1);

  if (bibles.length === 0) {
    console.error("No active poet_bible found.");
    process.exit(1);
  }
  const b = bibles[0];
  console.log(`CHOSEN: channel "${b.channelName}" (${b.platform}) — bible "${b.bibleName}"`);
  console.log(`  bible content length: ${b.content.length} chars`);
  console.log(`  bible content (first 600 chars):\n${b.content.slice(0, 600)}\n`);

  const channelDescription =
    b.channelDescription && b.channelDescription.trim().length > 0
      ? b.channelDescription
      : `频道「${b.channelName}」。（数据库无 description，使用频道名作为占位描述。）`;

  // 2. A real source viral video — prefer the highest-view competitor row with a transcript.
  const srcRows = await db
    .select({
      title: clerkVideos.title,
      views: clerkVideos.views,
      sourceChannelName: clerkVideos.sourceChannelName,
      transcript: clerkVideos.transcript,
    })
    .from(clerkVideos)
    .where(and(isNotNull(clerkVideos.competitorAccountId), sql`length(coalesce(${clerkVideos.transcript},'')) > 200`))
    .orderBy(desc(clerkVideos.views))
    .limit(1);

  let title: string;
  let channelName: string;
  let views: number;
  let viralTrigger: string;
  let srcMode: string;

  if (srcRows.length > 0) {
    const s = srcRows[0];
    title = s.title;
    channelName = s.sourceChannelName ?? "(unknown source channel)";
    views = s.views ?? 1_000_000;
    // Derive a short viral angle from the transcript opening (kept generic so the test
    // exercises generateIdeas, not a viral-trigger LLM call).
    const opener = (s.transcript ?? "").replace(/[`\s]+/g, " ").slice(0, 220);
    viralTrigger = `这条视频靠强好奇心钩子开场——「${opener}」——观众想知道答案因此点进来，再用层层递进的具体细节留人，最后给出反直觉结论引发转发。核心机制：好奇缺口 + 反直觉揭示。`;
    srcMode = `REAL clerk_videos row (competitor, ${views.toLocaleString("en-US")} views)`;
  } else {
    title = "我研究了 50 个百万播放视频，发现一个反直觉规律";
    channelName = "AlgoLab";
    views = 1_200_000;
    viralTrigger =
      "这条视频靠「我研究了 N 个样本」建立权威与好奇缺口让人点击；用一个反直觉发现（前 3 秒钩子不是越炸越好）持续留人；结论可被观众用一句话转述给别人，因此高分享。核心机制：权威化数据 + 反直觉结论。";
    srcMode = "FIXED representative example (no competitor transcript row available)";
  }
  console.log(`SOURCE VIDEO [${srcMode}]:`);
  console.log(`  title: ${title}`);
  console.log(`  channel: ${channelName} | views: ${views.toLocaleString("en-US")}`);
  console.log(`  viralTrigger: ${viralTrigger}\n`);

  const common = {
    channelDescription,
    title,
    channelName,
    views,
    viralTrigger,
    numIdeas: 5,
    language: "zh" as const,
  };

  // 3. Run A (no bible) then Run B (with bible).
  console.log("Running A (WITHOUT biblePositioning)…");
  const a = await generateIdeas({ ...common });
  console.log("Running B (WITH biblePositioning)…");
  const bRun = await generateIdeas({ ...common, biblePositioning: b.content });

  if (a.ideas.length === 0) console.log(`  A produced 0 ideas. parseErrorSample: ${a.parseErrorSample}`);
  if (bRun.ideas.length === 0) console.log(`  B produced 0 ideas. parseErrorSample: ${bRun.parseErrorSample}`);

  printIdeas("RUN A — NO BIBLE", a.ideas);
  printIdeas("RUN B — WITH BIBLE", bRun.ideas);
} finally {
  await client.end();
}
