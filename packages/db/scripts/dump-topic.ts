import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { poetCustomTopics } from "../src/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const id = process.argv[2];
if (!id) {
  console.error("Usage: tsx dump-topic.ts <topicId>");
  process.exit(1);
}
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);
try {
  const [t] = await db.select().from(poetCustomTopics).where(eq(poetCustomTopics.id, id)).limit(1);
  if (!t) {
    console.error("not found");
    process.exit(1);
  }
  console.log(`# Topic ${t.id} | status=${t.status}`);
  console.log(`# Title: ${t.topic}`);
  console.log(`# bibleId: ${t.bibleId} | sopId: ${t.sopId}`);
  console.log(`\n## storyAngle\n${t.storyAngle ?? "—"}`);
  console.log(`\n## factsAndData\n${t.factsAndData ?? "—"}`);
  console.log(`\n## verbatimFacts\n${t.verbatimFacts ?? "—"}`);
  console.log(`\n## whySimilar\n${t.whySimilar ?? "—"}`);
  console.log(`\n## viralTrigger\n${t.viralTrigger ?? "—"}`);
} finally {
  await client.end();
}
