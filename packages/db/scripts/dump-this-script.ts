import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { poetScripts } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const id = process.argv[2]!;
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);
try {
  const [s] = await db.select().from(poetScripts).where(eq(poetScripts.id, id)).limit(1);
  if (!s) { console.error("not found"); process.exit(1); }
  console.log(`# ${s.id} | ${s.language} | words=${s.wordCount} | min=${s.durationMinutes} | chars=${s.scriptText.length}`);
  console.log();
  console.log(s.scriptText);
} finally { await client.end(); }
