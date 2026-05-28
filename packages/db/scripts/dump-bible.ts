import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { poetBible } from "../src/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const id = process.argv[2];
if (!id) {
  console.error("Usage: tsx dump-bible.ts <bibleId>");
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

try {
  const [b] = await db.select().from(poetBible).where(eq(poetBible.id, id)).limit(1);
  if (!b) {
    console.error("not found");
    process.exit(1);
  }
  console.log(`# Bible ${b.id}`);
  console.log(`# Name: ${b.name}`);
  console.log(`# Chars: ${b.content?.length ?? 0}`);
  console.log("");
  console.log(b.content);
} finally {
  await client.end();
}
