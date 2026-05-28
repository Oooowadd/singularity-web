import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { clerkSops } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);
try {
  const sops = await db.select().from(clerkSops).where(eq(clerkSops.channelId, "d0e9b4c8-fbee-4b7e-8b6c-fccfd9802c67")).orderBy(desc(clerkSops.generatedAt)).limit(5);
  for (const s of sops) console.log(`${s.sopType} | lang=${s.language} | ${s.contentMd?.length ?? 0} chars | run=${s.runId} | gen=${s.generatedAt}`);
} finally { await client.end(); }
