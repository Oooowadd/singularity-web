/**
 * Workaround for `drizzle-kit push` choking on CHECK constraint introspection.
 * Run: pnpm --filter @goooose/db exec tsx scripts/apply-pending-migration.ts <sql-file>
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const file = process.argv[2];
if (!file) {
  console.error("Usage: tsx scripts/apply-pending-migration.ts <sql-file>");
  process.exit(1);
}

const sql = readFileSync(resolve(__dirname, "..", file), "utf-8");
console.log(`Applying ${file}…`);
console.log(`SQL: ${sql.trim()}`);

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
try {
  await client.unsafe(sql);
  console.log("✓ Migration applied");
} finally {
  await client.end();
}
