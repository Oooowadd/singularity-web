// Dump current muse state for a channel — what's been monitored, classified,
// and ideated. Useful for verifying live runs without opening the DB studio.

import { config } from "dotenv";
config({ path: new URL("../../../.env.local", import.meta.url) });

import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { channels, museIdeas, museMonitorVideos, pipelineRuns } from "@goooose/db";

async function dumpForSlug(slug: string) {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);
  try {
    const [ch] = await db.select().from(channels).where(eq(channels.slug, slug)).limit(1);
    if (!ch) {
      console.log(`channel slug=${slug} not found`);
      return;
    }
    console.log(`\n══ channel: ${ch.name} (slug=${ch.slug}, platform=${ch.platform}) ══`);
    console.log(`competitors: ${(ch.competitors as unknown[] | null)?.length ?? 0}`);

    const runs = await db
      .select()
      .from(pipelineRuns)
      .where(and(eq(pipelineRuns.channelId, ch.id), eq(pipelineRuns.agent, "muse")))
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(3);
    console.log(`\nlast ${runs.length} muse runs:`);
    for (const r of runs) {
      console.log(
        `  [${r.startedAt?.toISOString().slice(0, 19)}] status=${r.status} progress=${r.progress}/${r.total} ${r.errorMessage ? `err="${r.errorMessage.slice(0, 60)}"` : ""}`,
      );
    }

    const monitored = await db
      .select()
      .from(museMonitorVideos)
      .where(eq(museMonitorVideos.channelId, ch.id))
      .orderBy(desc(museMonitorVideos.processedAt));
    console.log(`\nmonitored videos: ${monitored.length}`);
    const typeDist = new Map<string, number>();
    const relevantCount = monitored.filter((m) => m.relevant).length;
    console.log(`  relevant: ${relevantCount}  irrelevant: ${monitored.length - relevantCount}`);
    for (const m of monitored.slice(0, 8)) {
      console.log(
        `    [${m.relevant ? "✓" : "✗"}] ${m.sourceChannelName ?? "?"} — ${(m.title ?? "").slice(0, 45)}  topic="${(m.topicClassification ?? "").slice(0, 25)}"  tr=${m.transcript ? m.transcript.length + "c" : "—"}`,
      );
      typeDist.set(m.sourceChannelName ?? "?", (typeDist.get(m.sourceChannelName ?? "?") ?? 0) + 1);
    }
    console.log(`  by competitor: ${[...typeDist].map(([k, v]) => `${k}=${v}`).join(", ")}`);

    const ideas = await db
      .select()
      .from(museIdeas)
      .where(eq(museIdeas.channelId, ch.id))
      .orderBy(desc(museIdeas.generatedAt));
    console.log(`\nideas: ${ideas.length}`);
    const approved = ideas.filter((i) => i.approved).length;
    const scripted = ideas.filter((i) => i.scripted).length;
    console.log(`  approved: ${approved}  scripted: ${scripted}  pending: ${ideas.length - approved - scripted}`);
    for (const i of ideas.slice(0, 6)) {
      console.log(
        `    ${i.approved ? "✓" : i.scripted ? "→" : "·"} #${i.ideaNumber} ${(i.storyAngle ?? "").slice(0, 80)}`,
      );
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const slugs = process.argv.slice(2);
  for (const slug of slugs.length ? slugs : ["ch-yic805", "hackbearterry"]) {
    await dumpForSlug(slug);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
