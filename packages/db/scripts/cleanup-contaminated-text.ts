// Detects + repairs records contaminated by the pre-fix `safeText(/ /g, "")` bug
// (all spaces stripped). Uses DeepSeek Flash to restore spaces in-place.
// Affects: poet_bible.content, poet_scripts.script_text, poet_custom_topics.*,
// clerk_videos analysis text fields, clerk_sops.content_md.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { generateText } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  clerkSops,
  clerkVideos,
  poetBible,
  poetCustomTopics,
  poetScripts,
} from "../src/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const dryRun = process.argv.includes("--dry-run");

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY! });
const flash = deepseek("deepseek-v4-flash");

// Heuristic: a text has lost spaces if (a) length > 100 and (b) the longest
// alphabetic run with no whitespace is unreasonably long. Chinese-only text
// legitimately has no spaces so we skip strings that are mostly CJK.
function isContaminated(s: string | null | undefined): boolean {
  if (!s || s.length < 100) return false;
  // Strip CJK + punctuation to find Latin runs
  const latinOnly = s.replace(/[㐀-鿿　-〿，。！？、；：（）「」『』\s\d\W_]/g, "");
  if (latinOnly.length < 80) return false;
  // Compute average "word" length in the latin portion
  const totalSpaces = (s.match(/ /g) || []).length;
  const latinChars = latinOnly.length;
  const ratio = totalSpaces / Math.max(latinChars, 1);
  return ratio < 0.04;
}

async function restore(text: string): Promise<string> {
  // 8000-char chunks fit comfortably within Flash budget.
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += 7000) chunks.push(text.slice(i, i + 7000));
  const restored: string[] = [];
  for (const chunk of chunks) {
    const prompt = `The following text had ALL its spaces accidentally stripped by a data-processing bug. Restore proper spacing for English/markdown content, preserve all Chinese characters as-is, preserve markdown structure (## headers, - bullets, code fences, [links]). Output ONLY the restored text, no preamble, no commentary, no fences around the whole thing.\n\n=== CONTAMINATED TEXT ===\n${chunk}\n=== END ===`;
    const result = await generateText({
      model: flash,
      prompt,
      temperature: 0.1,
      maxOutputTokens: 12000,
      maxRetries: 2,
    });
    if (result.text.trim().length > chunk.length * 0.5) {
      restored.push(result.text.trim());
    } else {
      restored.push(chunk);
    }
  }
  return restored.join("\n");
}

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

type Job = { table: string; id: string; field: string; len: number };

try {
  const jobs: Array<Job & { text: string; update: (newText: string) => Promise<unknown> }> = [];

  for (const b of await db.select().from(poetBible)) {
    if (isContaminated(b.content)) {
      jobs.push({
        table: "poet_bible",
        id: b.id,
        field: "content",
        len: b.content.length,
        text: b.content,
        update: (t) => db.update(poetBible).set({ content: t }).where(eq(poetBible.id, b.id)),
      });
    }
  }
  for (const s of await db.select().from(poetScripts)) {
    if (isContaminated(s.scriptText)) {
      jobs.push({
        table: "poet_scripts",
        id: s.id,
        field: "scriptText",
        len: s.scriptText.length,
        text: s.scriptText,
        update: (t) =>
          db.update(poetScripts).set({ scriptText: t }).where(eq(poetScripts.id, s.id)),
      });
    }
  }
  for (const t of await db.select().from(poetCustomTopics)) {
    const fields: Array<["storyAngle" | "factsAndData" | "verbatimFacts" | "whySimilar" | "viralTrigger", string | null]> = [
      ["storyAngle", t.storyAngle],
      ["factsAndData", t.factsAndData],
      ["verbatimFacts", t.verbatimFacts],
      ["whySimilar", t.whySimilar],
      ["viralTrigger", t.viralTrigger],
    ];
    for (const [name, val] of fields) {
      if (isContaminated(val)) {
        jobs.push({
          table: "poet_custom_topics",
          id: t.id,
          field: name,
          len: (val ?? "").length,
          text: val!,
          update: (nt) =>
            db.update(poetCustomTopics).set({ [name]: nt }).where(eq(poetCustomTopics.id, t.id)),
        });
      }
    }
  }
  for (const sop of await db.select().from(clerkSops)) {
    if (sop.contentMd && isContaminated(sop.contentMd)) {
      jobs.push({
        table: "clerk_sops",
        id: sop.id,
        field: "contentMd",
        len: sop.contentMd.length,
        text: sop.contentMd,
        update: (nt) => db.update(clerkSops).set({ contentMd: nt }).where(eq(clerkSops.id, sop.id)),
      });
    }
  }
  for (const v of await db.select().from(clerkVideos)) {
    const fields: Array<[
      "framework" | "openingStructure" | "scriptStructure" | "storytellingFramework" | "retentionPattern" | "ctaPlacement" | "keyTakeaways" | "openingHook" | "hooksThroughout" | "allHookTypes" | "textHook" | "rehooksUsed",
      string | null,
    ]> = [
      ["framework", v.framework],
      ["openingStructure", v.openingStructure],
      ["scriptStructure", v.scriptStructure],
      ["storytellingFramework", v.storytellingFramework],
      ["retentionPattern", v.retentionPattern],
      ["ctaPlacement", v.ctaPlacement],
      ["keyTakeaways", v.keyTakeaways],
      ["openingHook", v.openingHook],
      ["hooksThroughout", v.hooksThroughout],
      ["allHookTypes", v.allHookTypes],
      ["textHook", v.textHook],
      ["rehooksUsed", v.rehooksUsed],
    ];
    for (const [name, val] of fields) {
      if (isContaminated(val)) {
        jobs.push({
          table: "clerk_videos",
          id: v.id,
          field: name,
          len: (val ?? "").length,
          text: val!,
          update: (nt) =>
            db.update(clerkVideos).set({ [name]: nt }).where(eq(clerkVideos.id, v.id)),
        });
      }
    }
  }

  console.log(`Detected ${jobs.length} contaminated fields:`);
  for (const j of jobs) console.log(`  - ${j.table}.${j.field} [${j.id}] ${j.len} chars`);

  if (dryRun) {
    console.log("\n(dry-run — no writes)");
  } else {
    let done = 0;
    for (const j of jobs) {
      const cleaned = await restore(j.text);
      await j.update(cleaned);
      done++;
      console.log(`  [${done}/${jobs.length}] restored ${j.table}.${j.field} ${j.len} → ${cleaned.length} chars`);
    }
    console.log(`\nDONE. Restored ${done} fields.`);
  }
} finally {
  await client.end();
}
