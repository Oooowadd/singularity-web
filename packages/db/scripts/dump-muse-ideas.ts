import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { museIdeas } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const ideas = await db.select().from(museIdeas).where(eq(museIdeas.runId, process.argv[2]!)).limit(3);
  for (const i of ideas) {
    console.log(`\n#${i.ideaNumber}`);
    console.log(`  storyAngle: ${i.storyAngle?.slice(0, 120)}`);
    console.log(`  factsAndData: ${i.factsAndData?.slice(0, 100)}`);
    console.log(`  whySimilar: ${i.whySimilar?.slice(0, 100)}`);
    console.log(`  coverConcept: ${i.coverConcept?.slice(0, 100) ?? "—"}`);
    console.log(`  suggestedHookType: ${i.suggestedHookType?.slice(0, 80) ?? "—"}`);
    console.log(`  riskFactors: ${i.riskFactors?.slice(0, 100) ?? "—"}`);
  }
} finally { await c.end(); }
