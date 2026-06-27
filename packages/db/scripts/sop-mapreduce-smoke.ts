/**
 * LIVE quality + context-bound proof for the SOP map-reduce path.
 * READ-ONLY: SELECTs clerk_videos for an own account, runs MAP (summarizeVideoForSop,
 * Flash) over up to 8 videos, then REDUCE (buildAiSopReferencePrompt → Pro). No DB writes.
 * Run: pnpm --filter @singularity/db exec tsx scripts/sop-mapreduce-smoke.ts
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { generateText } from "ai";

import { clerkVideos } from "../src/schema/clerk";
import { channels } from "../src/schema/channels";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { summarizeVideoForSop } = await import("@singularity/domain/services/clerk-map");
const { buildAiSopReferencePrompt } = await import("@singularity/prompts/clerk");
const { llm } = await import("@singularity/integrations/clients/llm");

const MAX_MAP = 8;

// Mirror of apps/worker/trigger/analyze-channel.ts renderVideoAnalysisFields — the
// `analysis` arg the MAP prompt expects.
function renderVideoAnalysisFields(v: typeof clerkVideos.$inferSelect): string {
  const fields: Array<[string, string | null]> = [
    ["opening_hook_type", v.openingHookType],
    ["opening_hook", v.openingHook],
    ["hooks_throughout", v.hooksThroughout],
    ["all_hook_types", v.allHookTypes],
    ["text_hook", v.textHook],
    ["framework", v.framework],
    ["opening_structure", v.openingStructure],
    ["script_structure", v.scriptStructure],
    ["storytelling_framework", v.storytellingFramework],
    ["rehooks_used", v.rehooksUsed],
    ["retention_pattern", v.retentionPattern],
    ["cta_placement", v.ctaPlacement],
    ["key_takeaways", v.keyTakeaways],
    ["cover_diagnosis", v.coverDiagnosis],
  ];
  const lines = fields.filter(([, val]) => val).map(([k, val]) => `- ${k}: ${val}`);
  if (v.coverTitleSuggestions && v.coverTitleSuggestions.length > 0) {
    lines.push(`- cover_title_suggestions: ${v.coverTitleSuggestions.join(" | ")}`);
  }
  return lines.join("\n");
}

// Mirror of analyze-channel.ts buildVideosSummaryText, REDUCE side.
function buildVideosSummaryText(
  videos: Array<typeof clerkVideos.$inferSelect>,
  summaries: Map<string, string>,
): string {
  const blocks = videos.map((v, i) => {
    const lines: string[] = [];
    lines.push(`### Video ${i + 1}: "${v.title || "(untitled)"}"`);
    lines.push(`- Views: ${v.views?.toLocaleString("en-US") ?? "unknown"}`);
    lines.push(`- Duration: ${v.durationSec ?? "unknown"}s`);
    lines.push(`- Transcript source: ${v.transcriptSource ?? "none"}`);
    const summary = summaries.get(v.id);
    lines.push(summary ? `\n${summary}` : "- (no pattern summary available for this video)");
    return lines.join("\n");
  });
  const note =
    `GROUNDING — write the SOP only from the per-video pattern summaries below. Each summary already distills one video's grounded techniques; never quote lines, cite [m:ss], invent a beat-by-beat structure, or assert per-video frequency counts beyond what the summaries state. If a video has no pattern summary, infer only from its title and label it inference. If most videos lack spoken detail, say so plainly and keep the SOP at the title/cover-pattern level instead of fabricating depth.\n\n`;
  return note + blocks.join("\n\n");
}

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

try {
  // 1. Own channel with the most clerk_videos. Own rows carry channel_id (XOR with competitor).
  const counts = await db
    .select({
      channelId: clerkVideos.channelId,
      n: sql<number>`count(*)::int`,
    })
    .from(clerkVideos)
    .where(sql`${clerkVideos.channelId} is not null`)
    .groupBy(clerkVideos.channelId)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  if (counts.length === 0) {
    console.error("No own-account clerk_videos found (channel_id is null everywhere).");
    process.exit(1);
  }

  console.log("Top own channels by clerk_videos count:");
  for (const c of counts) console.log(`  ${c.channelId} → ${c.n} videos`);

  const chosen = counts[0];
  const chan = await db
    .select({ name: channels.name, platform: channels.platform })
    .from(channels)
    .where(eq(channels.id, chosen.channelId!))
    .limit(1);
  const channelName = chan[0]?.name ?? "(unknown channel)";
  console.log(`\nCHOSEN: "${channelName}" (${chan[0]?.platform ?? "?"}) — ${chosen.n} videos`);

  // 2. Load all videos for that owner, views DESC.
  const videos = await db
    .select()
    .from(clerkVideos)
    .where(eq(clerkVideos.channelId, chosen.channelId!))
    .orderBy(desc(clerkVideos.views));

  console.log(`Loaded ${videos.length} videos.`);

  // 3. Context-bound proof. OLD = sum min(len(transcript), 8000); NEW = sum map-summary lens.
  const oldContextChars = videos.reduce(
    (acc, v) => acc + Math.min(v.transcript?.length ?? 0, 8000),
    0,
  );
  const withTranscript = videos.filter((v) => (v.transcript?.length ?? 0) > 0).length;
  console.log(
    `\nOLD per-video transcript-excerpt context = ${oldContextChars.toLocaleString("en-US")} chars (across ${videos.length} videos, ${withTranscript} with transcript)`,
  );

  // 4. MAP up to MAX_MAP videos (sequential to stay gentle on rate limits).
  const mapTargets = videos.slice(0, MAX_MAP);
  console.log(`\nMAP: summarizing ${mapTargets.length} of ${videos.length} videos…`);
  const summaries = new Map<string, string>();
  for (const v of mapTargets) {
    try {
      const summary = await summarizeVideoForSop({
        title: v.title,
        views: v.views,
        durationSec: v.durationSec,
        contentType: (v.contentType as "video" | "xhs_image" | "xhs_video") ?? "video",
        transcript: v.transcript,
        analysis: renderVideoAnalysisFields(v),
        language: "zh",
      });
      summaries.set(v.id, summary);
      console.log(`  ✓ ${v.title.slice(0, 48)} → ${summary.length} chars`);
    } catch (err) {
      console.log(`  ✗ ${v.title.slice(0, 48)} → MAP FAILED: ${(err as Error).message}`);
    }
  }

  const newContextChars = [...summaries.values()].reduce((a, s) => a + s.length, 0);
  console.log(
    `\nNEW map-summary context (over ${summaries.size} mapped videos) = ${newContextChars.toLocaleString("en-US")} chars`,
  );
  // Scale OLD down to the same mapped subset for an apples-to-apples ratio.
  const oldForMapped = mapTargets.reduce(
    (acc, v) => acc + Math.min(v.transcript?.length ?? 0, 8000),
    0,
  );
  console.log(
    `OLD (same ${mapTargets.length} mapped videos) = ${oldForMapped.toLocaleString("en-US")} chars`,
  );
  if (newContextChars > 0) {
    console.log(`CONTEXT RATIO (old/new, mapped subset) = ${(oldForMapped / newContextChars).toFixed(1)}×`);
  }

  // Print 2 full example summaries.
  const examples = mapTargets.filter((v) => summaries.has(v.id)).slice(0, 2);
  for (const v of examples) {
    console.log(`\n──────── MAP SUMMARY: "${v.title}" ────────`);
    console.log(summaries.get(v.id));
  }

  // 5. REDUCE → AI-reference SOP.
  const totalViews = videos.reduce((a, v) => a + (v.views ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const videosData = buildVideosSummaryText(mapTargets, summaries);

  console.log(`\nREDUCE: building AI-reference SOP (videosData = ${videosData.length} chars)…`);
  const prompt = buildAiSopReferencePrompt({
    channelName,
    videoCount: videos.length,
    totalViews,
    date: today,
    videosData,
    transcriptCount: withTranscript,
  });

  const sop = await generateText({
    model: llm("pro"),
    prompt,
    maxOutputTokens: 16384,
    temperature: 0.4,
  });

  console.log(`\n════════ AI-REFERENCE SOP (${sop.text.length} chars, finish=${sop.finishReason}) ════════\n`);
  console.log(sop.text);
  console.log("\n════════ END SOP ════════");
} finally {
  await client.end();
}
