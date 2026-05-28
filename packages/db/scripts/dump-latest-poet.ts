import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { poetScripts } from "../src/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

try {
  const which = process.argv[2] ?? "0";
  const idx = Number(which);
  const scripts = await db
    .select()
    .from(poetScripts)
    .orderBy(desc(poetScripts.generatedAt))
    .limit(5);
  if (!scripts[idx]) {
    console.error(`no script at index ${idx}`);
    process.exit(1);
  }
  const s = scripts[idx]!;
  console.log(`# Script ${s.id}`);
  console.log(`# Lang: ${s.language} | Words: ${s.wordCount} | Duration: ${s.durationMinutes}min`);
  console.log(`# Chars: ${s.scriptText?.length ?? 0}`);
  console.log("");
  console.log(s.scriptText);
} finally {
  await client.end();
}
