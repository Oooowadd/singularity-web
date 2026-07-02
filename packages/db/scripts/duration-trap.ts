// 300s re-test of the undershoot trap: a topic whose own text embeds per-second pacing.
import { dirname, resolve } from "node:path"; import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";
import dotenv from "dotenv"; import postgres from "postgres"; import { drizzle } from "drizzle-orm/postgres-js";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const { poetBible, poetCustomTopics, clerkSops } = await import("@singularity/db");
const { eq, and, desc } = await import("drizzle-orm");
const { writeScript } = await import("@singularity/domain/services/poet/script-writer");
const { computeTargetWordCount, countWords } = await import("@singularity/domain/schemas/poet");
const client = postgres(process.env.DATABASE_URL!, { prepare: false }); const db = drizzle(client);

const CH = "1676e2a3-becd-4755-8d1d-4c9fb44890bf"; // AI红发魔女 (colleague's channel)
const TOPIC = "3ae280dc"; // their Singularity topic with 0-20秒 beats
const [bible] = await db.select().from(poetBible).where(and(eq(poetBible.channelId, CH), eq(poetBible.isActive, true))).limit(1);
const [sop] = await db.select().from(clerkSops).where(and(eq(clerkSops.channelId, CH), eq(clerkSops.sopType, "ai_reference"))).orderBy(desc(clerkSops.generatedAt)).limit(1);
const topics = await db.select().from(poetCustomTopics).where(eq(poetCustomTopics.channelId, CH)).orderBy(desc(poetCustomTopics.updatedAt));
const topic: any = topics.find((x: any) => x.id.startsWith(TOPIC)) ?? topics[0];
console.log(`inputs: bible=${(bible as any)?.content?.length} sop=${sop?.contentMd?.length} topic="${topic?.topic?.slice(0, 50)}" (has 0-20秒 pacing: ${/0-20秒|（0-20/.test(JSON.stringify(topic))})`);

const idea = { storyAngle: topic.storyAngle ?? "", factsAndData: topic.factsAndData ?? "", whySimilar: topic.whySimilar ?? "", viralTrigger: topic.viralTrigger ?? "", sourceTitle: topic.topic, sourceChannel: "Custom topic" };
const references = ((topic.references as any[]) ?? []).map((r) => ({ type: r.kind, title: r.title ?? "Reference", url: r.url, content: r.text ?? "" })).filter((r) => r.content.trim());
mkdirSync("/tmp/duration-matrix", { recursive: true });

const runs = ["trap-300s-A", "trap-300s-B"];
const rs = await Promise.all(runs.map(async (label) => {
  const target = computeTargetWordCount(300, "zh");
  try {
    const r = await writeScript({ idea, sopText: sop!.contentMd, bibleText: (bible as any).content, language: "zh", references, targetWordCount: target, verbatimFacts: topic.verbatimFacts, factChecks: topic.factChecks, channelName: "AI红发魔女" });
    const spoken = countWords(r.scriptText, "zh"); const ratio = spoken / target;
    writeFileSync(`/tmp/duration-matrix/${label}.md`, `target=${target} spoken=${spoken} ratio=${ratio.toFixed(2)}\n\n${r.scriptText}`);
    return { label, target, spoken, ratio: +ratio.toFixed(2), path: r.path, inWindow: ratio >= 0.8 && ratio <= 1.25 };
  } catch (e) { return { label, error: (e as Error).message.slice(0, 120) } as any; }
}));
for (const r of rs) console.log(JSON.stringify(r));
await client.end();
