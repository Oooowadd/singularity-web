/**
 * One-off: convert legacy 3-section bibles to the anchored 9-section format.
 * Faithful restructure (no new facts) + bidirectional digit audit; skips rows that
 * already carry anchors. Backs up poet_bible to backups/ before writing.
 * Run: pnpm --filter @singularity/db exec tsx scripts/convert-bibles-to-anchored.ts [--execute]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { generateTextWithFallback } = await import("@singularity/integrations/clients/llm");
const { extractHostLine, extractTopicLine, BIBLE_ANCHORS } = await import(
  "@singularity/domain/services/poet/bible"
);

const execute = process.argv.includes("--execute");
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

const digits = (s: string) => new Set(s.match(/\d+(?:\.\d+)?/g) ?? []);

function hasAnchors(content: string): boolean {
  return BIBLE_ANCHORS.some((a: string) => new RegExp(`^##\\s+${a}\\b`, "m").test(content));
}

function buildConvertPrompt(content: string): string {
  return `You are reformatting a Channel Bible into a standardized anchored layout. This is a RESTRUCTURE, not a rewrite.

## ABSOLUTE RULES
- Redistribute the existing content into the new sections. Copy wording as-is wherever possible.
- Do NOT add any fact, number, name, or claim that is not in the original. Do NOT drop concrete facts.
- Keep the first line \`TOPIC: ...\` exactly as in the original (or derive it from the original's TOPIC line).
- Add a \`HOST: <name>\` second line ONLY if the original explicitly names the account's host person.
- Body language stays the same as the original. Section anchors stay English.
- If the original has no material for a section, write a single line （暂无，可后续补充） under it.

## OUTPUT FORMAT
TOPIC: <from original>
(optional) HOST: <name>

## POSITIONING
## PERSONA
## AUDIENCE
## CONTENT_PILLARS
## CONTENT_RULES
## METHODOLOGY
## INFORMATION_SOURCES
## TOPIC_FRAMEWORK
## FACT_SHEET

Mapping hints: "CHANNEL DESCRIPTION" content → POSITIONING (+ AUDIENCE / CONTENT_PILLARS if present); "INFORMATION SOURCES" → INFORMATION_SOURCES; "TOPIC GENERATION FRAMEWORK" → TOPIC_FRAMEWORK; concrete verbatim facts worth citing → FACT_SHEET.

## ORIGINAL
${content}`;
}

const rows = await sql`
  SELECT id, channel_id, name, content, is_active
  FROM poet_bible ORDER BY updated_at DESC`;
console.log(`${rows.length} bibles total`);

// Backup before any write (mirrors the surgical-backup precedent).
if (execute) {
  const dir = resolve(__dirname, "../backups");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `poet_bible-pre-anchored-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(rows, null, 2));
  console.log(`backup written: ${path}`);
}

let converted = 0;
let skipped = 0;
let failed = 0;
for (const row of rows) {
  const content: string = row.content;
  if (hasAnchors(content)) {
    skipped++;
    continue;
  }
  console.log(`\n-- ${row.id} 「${row.name}」 (${content.length} chars, active=${row.is_active})`);
  const { text } = await generateTextWithFallback({
    prompt: buildConvertPrompt(content),
    maxOutputTokens: 16384,
    temperature: 0.2,
  });
  const next = text.trim();
  const oldTopic = extractTopicLine(content);
  const checks: [string, boolean][] = [
    ["non-empty", next.length > 0],
    ["anchors present", hasAnchors(next)],
    ["TOPIC preserved", !oldTopic || extractTopicLine(next).length > 0],
    // Bidirectional: no invented digits, no lost digits.
    ["no new digits", [...digits(next)].every((n) => digits(content).has(n))],
    ["no lost digits", [...digits(content)].every((n) => digits(next).has(n))],
    ["length sane", next.length >= content.length * 0.5 && next.length <= content.length * 2.5],
  ];
  const bad = checks.filter(([, ok]) => !ok);
  if (bad.length > 0) {
    failed++;
    console.log(`  SKIP (checks failed: ${bad.map(([n]) => n).join(", ")})`);
    continue;
  }
  console.log(`  OK ${content.length} → ${next.length} chars, host=${extractHostLine(next) ?? "-"}`);
  if (execute) {
    await sql`UPDATE poet_bible SET content = ${next}, host_name = ${extractHostLine(next)}, updated_at = now() WHERE id = ${row.id}`;
    console.log("  written");
  }
  converted++;
}

console.log(`\n${execute ? "EXECUTED" : "DRY-RUN"}: ${converted} converted, ${skipped} already anchored, ${failed} failed checks`);
await sql.end();
