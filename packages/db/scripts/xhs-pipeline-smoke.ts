// Full XHS Clerk pipeline end-to-end smoke. Exercises every code path:
// - 3 source modes (newest / popular / urls)
// - 2 content types (video → ASR, image → desc)
// - Multi-image vision A/B vs single-image
// - All 3 SOP builders on aggregated notes
//
// Runs ~15 min, costs ~$3-5 in TikHub + Deepgram + Claude vision + DeepSeek.
// Skips DB writes — dumps analysis JSON to console for quality eval.
//
// Run: pnpm --filter @singularity/db xhs-pipeline-smoke

import { config } from "dotenv";
config({ path: new URL("../../../.env.local", import.meta.url) });

import { generateText } from "ai";
import { jsonrepair } from "jsonrepair";

import { transcribeFromStreams } from "@singularity/integrations/clients/asr";
import { llm } from "@singularity/integrations/clients/llm";
import { analyzeImageStack, analyzeThumbnail } from "@singularity/integrations/clients/vision";
import {
  extractXhsNoteId,
  getXhsNoteDetail,
  getXhsUserNotes,
  type XhsNote,
} from "@singularity/integrations/clients/xhs";
import {
  buildAiSopReferencePrompt,
  buildHottestSopPrompt,
  buildHumanSopPrompt,
  buildVideoAnalysisPrompt,
} from "@singularity/prompts/clerk";
import { clerkAnalysisSchema } from "@singularity/domain/schemas/clerk";

// ── Test fixtures (from user-provided URLs) ─────────────────────────
const ACCOUNTS = {
  redhead_witch:
    "https://www.xiaohongshu.com/user/profile/6166b66a0000000002027a1d?xsec_token=ABcBlpM9zG5QXf3J-jkQg9UcCgXPNun7fnT3893-4_Nf0%3D&xsec_source=pc_search",
  exploration:
    "https://www.xiaohongshu.com/user/profile/672a8c0a000000001d02d088?xsec_token=ABQ690heASM4wOsX6L5eqZWYptp7YJ4mExC4XWC1AQ9Qc%3D&xsec_source=pc_search",
};
const NOTES = {
  video: "69d4f1e60000000021010db4",
  image: "6a0288a20000000038035cae",
};

// ── Test runner state ───────────────────────────────────────────────
let pass = 0;
let fail = 0;
const t = (name: string, ok: boolean, detail?: string) => {
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? ` · ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};
const T0 = Date.now();
const elapsed = () => `${((Date.now() - T0) / 1000).toFixed(0)}s`;

// ── Analyzer JSON parser (1:1 replica of analyze-channel.ts logic) ──
function parseAnalysis(rawText: string) {
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
  const i = cleaned.indexOf("{");
  const j = cleaned.lastIndexOf("}");
  if (i === -1 || j === -1) return null;
  const slice = cleaned.slice(i, j + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(slice));
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const str = (k: string): string =>
    typeof obj[k] === "string"
      ? (obj[k] as string)
      : obj[k] == null
        ? ""
        : Array.isArray(obj[k])
          ? (obj[k] as unknown[]).join("\n")
          : JSON.stringify(obj[k]);
  const candidate = {
    thumbnail_description: str("thumbnail_description"),
    thumbnail_why_it_works: str("thumbnail_why_it_works"),
    opening_hook: str("opening_hook"),
    opening_hook_type: str("opening_hook_type"),
    hooks_throughout: str("hooks_throughout"),
    all_hook_types: str("all_hook_types"),
    text_hook: str("text_hook"),
    framework: str("framework"),
    opening_structure: str("opening_structure"),
    script_structure: str("script_structure"),
    storytelling_framework: str("storytelling_framework"),
    rehooks_used: str("rehooks_used"),
    retention_pattern: str("retention_pattern"),
    cta_placement: str("cta_placement"),
    key_takeaways: str("key_takeaways"),
  };
  const v = clerkAnalysisSchema.safeParse(candidate);
  return v.success ? v.data : null;
}

// ── Per-note pipeline (skips DB write) ──────────────────────────────
type Processed = {
  note: XhsNote;
  contentType: "xhs_video" | "xhs_image";
  transcript: string | null;
  transcriptSource: "xhs_asr" | "xhs_text";
  visionDescription: string | null;
  visionWhy: string | null;
  visionMode: "stack" | "single" | "none";
  analysis: ReturnType<typeof parseAnalysis> | null;
  asrSeconds?: number;
};

async function processNote(note: XhsNote): Promise<Processed> {
  const titleAndDesc = [note.title, note.desc]
    .filter((s) => s.trim().length > 0)
    .join("\n\n");
  let transcript: string | null = null;
  let transcriptSource: Processed["transcriptSource"];
  let contentType: Processed["contentType"];
  let asrSeconds: number | undefined;

  if (note.type === "video") {
    contentType = "xhs_video";
    if (
      note.videoStreams.length > 0 &&
      note.durationSec &&
      note.durationSec <= 3600
    ) {
      const t0 = Date.now();
      const asr = await transcribeFromStreams(
        note.videoStreams.map((s) => ({
          url: s.masterUrl,
          mimeType: "video/mp4",
          sizeHint: s.size,
          label: `${s.codec} ${s.width}x${s.height}`,
        })),
        {
          durationSec: note.durationSec ?? undefined,
          tag: `XHS ${note.noteId}`,
          logger: {
            info: (m) => console.log(`    · ${m}`),
            warn: (m) => console.log(`    ! ${m}`),
          },
        },
      );
      asrSeconds = (Date.now() - t0) / 1000;
      if (asr) {
        transcript = `${titleAndDesc}\n\n[Audio Transcript]\n${asr.text}`.trim();
        transcriptSource = "xhs_asr";
      } else {
        transcript = titleAndDesc || null;
        transcriptSource = "xhs_text";
      }
    } else {
      transcript = titleAndDesc || null;
      transcriptSource = "xhs_text";
    }
  } else {
    contentType = "xhs_image";
    transcript = titleAndDesc || null;
    transcriptSource = "xhs_text";
  }

  // Vision: image post → multi-image stack; video → single thumbnail.
  const visionUrls =
    note.type === "image" && note.images.length > 0
      ? note.images.map((img) => img.originalUrl || img.url).filter(Boolean)
      : note.thumbnailUrl
        ? [note.thumbnailUrl]
        : [];
  let visionDescription: string | null = null;
  let visionWhy: string | null = null;
  let visionMode: Processed["visionMode"] = "none";
  if (visionUrls.length > 0) {
    visionMode = visionUrls.length > 1 ? "stack" : "single";
    const visual =
      visionUrls.length > 1
        ? await analyzeImageStack(visionUrls, "zh")
        : await analyzeThumbnail(visionUrls[0]!, "zh");
    if (visual) {
      visionDescription = visual.description || null;
      visionWhy = visual.whyItWorks || null;
    }
  }

  // Analyzer
  const prompt = buildVideoAnalysisPrompt({
    title: note.title,
    views: note.engagementScore,
    durationSec: note.durationSec,
    thumbnailUrl: note.thumbnailUrl,
    transcript,
    contentType,
    language: "zh",
  });
  const result = await generateText({
    model: llm("pro"),
    prompt,
    maxOutputTokens: 8192,
    temperature: 0.3,
    maxRetries: 2,
  });
  const analysis = parseAnalysis(result.text);
  if (!analysis) {
    console.log(`    ! analyzer raw output (first 400 chars): ${result.text.slice(0, 400)}`);
    console.log(`    ! analyzer raw output (last 400 chars):  …${result.text.slice(-400)}`);
  }

  return {
    note,
    contentType,
    transcript,
    transcriptSource,
    visionDescription,
    visionWhy,
    visionMode,
    analysis,
    asrSeconds,
  };
}

// ── Output formatter ────────────────────────────────────────────────
function head(s: string | null | undefined, n = 120): string {
  if (!s) return "—";
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length <= n ? flat : `${flat.slice(0, n)}…`;
}

function dumpProcessed(label: string, p: Processed) {
  const n = p.note;
  console.log(
    `\n── ${label} ─ [${p.contentType}] "${n.title.slice(0, 40)}" ─ engagement=${n.engagementScore} ${n.durationSec ? `dur=${n.durationSec}s` : "(image)"}`,
  );
  console.log(`    note_id: ${n.noteId}  channel: ${n.channelName}`);
  console.log(
    `    likes=${n.likes}  collected=${n.collectedCount}  comments=${n.commentsCount}  shares=${n.shareCount}  → engagement=${n.engagementScore}`,
  );
  console.log(`    images=${n.images.length}  video_streams=${n.videoStreams.length}`);
  if (p.asrSeconds) console.log(`    ASR elapsed: ${p.asrSeconds.toFixed(0)}s`);
  console.log(`    transcript_source: ${p.transcriptSource}`);
  console.log(`    transcript head: ${head(p.transcript, 150)}`);
  console.log(`    vision (${p.visionMode}):`);
  console.log(`      desc: ${head(p.visionDescription, 150)}`);
  console.log(`      why:  ${head(p.visionWhy, 150)}`);
  if (!p.analysis) {
    console.log(`    ✗ analyzer JSON parse failed`);
    return;
  }
  console.log(`    analysis (14 fields):`);
  const a = p.analysis;
  const fields: Array<[string, string]> = [
    ["thumbnail_description", a.thumbnail_description],
    ["thumbnail_why_it_works", a.thumbnail_why_it_works],
    ["opening_hook", a.opening_hook],
    ["opening_hook_type", a.opening_hook_type],
    ["hooks_throughout", a.hooks_throughout],
    ["all_hook_types", a.all_hook_types],
    ["text_hook", a.text_hook],
    ["framework", a.framework],
    ["opening_structure", a.opening_structure],
    ["script_structure", a.script_structure],
    ["storytelling_framework", a.storytelling_framework],
    ["rehooks_used", a.rehooks_used],
    ["retention_pattern", a.retention_pattern],
    ["cta_placement", a.cta_placement],
    ["key_takeaways", a.key_takeaways],
  ];
  for (const [k, v] of fields) {
    console.log(`      • ${k.padEnd(25)} ${head(v, 100)}`);
  }
}

// Heuristics for content quality: each field should be predominantly Chinese (when language=zh).
function isChineseHeavy(s: string | null | undefined): boolean {
  if (!s) return false;
  const cjk = (s.match(/[一-鿿]/g) ?? []).length;
  return cjk >= 3;
}

function qualityAssertions(label: string, p: Processed) {
  console.log(`    quality:`);
  if (!p.analysis) {
    t(`${label} analyzer returned valid JSON`, false);
    return;
  }
  const a = p.analysis;
  const cnFields = (
    [
      "opening_hook",
      "framework",
      "script_structure",
      "key_takeaways",
    ] as const
  ).filter((k) => isChineseHeavy(a[k]));
  t(`${label} ≥4 key fields in Chinese`, cnFields.length === 4, `(${cnFields.length}/4)`);
  // For image posts, hooks_throughout should reference sections, not timestamps.
  if (p.contentType === "xhs_image") {
    const hasTimestamp = /\d+:\d{2}/.test(a.hooks_throughout);
    t(
      `${label} image post avoids minute:second timestamps in hooks_throughout`,
      !hasTimestamp,
    );
  }
  // Engagement score appeared as Views: in prompt — make sure it didn't read as 0/invalid.
  t(`${label} engagement passed through to prompt > 0`, p.note.engagementScore > 0);
  // Vision should produce non-empty description for any note with images/thumb.
  if (p.visionMode !== "none") {
    t(`${label} vision returned non-empty description`, !!p.visionDescription);
  }
}

// ── Main scenarios ──────────────────────────────────────────────────
async function main() {
  console.log(`\n══════════════ XHS PIPELINE FULL SMOKE  (start ${new Date().toISOString()}) ══════════════`);

  // SCENARIO A — newest mode on redhead_witch
  console.log(`\n\n━━━━━━━━━━━━ A. newest mode ━━━━━━━━━━━━ (${elapsed()})`);
  const newest = await getXhsUserNotes(ACCOUNTS.redhead_witch, 1);
  t("newest returned exactly 1 note", newest.length === 1);
  const aNote = newest[0];
  if (aNote) {
    const a = await processNote(aNote);
    dumpProcessed("A.newest", a);
    qualityAssertions("A.newest", a);
  }

  // SCENARIO B — popular mode on exploration (sort by engagement)
  console.log(`\n\n━━━━━━━━━━━━ B. popular mode (engagement sort) ━━━━━━━━━━━━ (${elapsed()})`);
  const all = await getXhsUserNotes(ACCOUNTS.exploration, 20);
  const sortedByEngagement = [...all].sort((x, y) => y.engagementScore - x.engagementScore);
  console.log(`  fetched ${all.length} notes, sorted by engagement:`);
  for (const n of sortedByEngagement.slice(0, 5)) {
    console.log(
      `    ${n.type === "video" ? "🎬" : "🖼 "} ${n.engagementScore.toString().padStart(6)} — ${n.title.slice(0, 50)}`,
    );
  }
  const top5 = sortedByEngagement.slice(0, 5);
  t(
    "popular sort produced descending engagement",
    top5.every((n, i) => i === 0 || n.engagementScore <= top5[i - 1]!.engagementScore),
  );
  const bNote = sortedByEngagement[0];
  if (bNote) {
    const b = await processNote(bNote);
    dumpProcessed("B.popular[0]", b);
    qualityAssertions("B.popular[0]", b);
  }

  // SCENARIO C — urls mode (specific video + image URL)
  console.log(`\n\n━━━━━━━━━━━━ C. urls mode (1 video + 1 image) ━━━━━━━━━━━━ (${elapsed()})`);
  const videoId = extractXhsNoteId(NOTES.video)!;
  const imageId = extractXhsNoteId(NOTES.image)!;
  const cVideoDetail = await getXhsNoteDetail(videoId);
  const cImageDetail = await getXhsNoteDetail(imageId);
  t("getXhsNoteDetail returned video note", cVideoDetail !== null);
  t("getXhsNoteDetail returned image note", cImageDetail !== null);
  if (cVideoDetail) {
    const c1 = await processNote(cVideoDetail);
    dumpProcessed("C.urls.video", c1);
    qualityAssertions("C.urls.video", c1);
    t("C.urls.video transcript_source = xhs_asr (when video has streams)",
      cVideoDetail.videoStreams.length === 0 || c1.transcriptSource === "xhs_asr");
  }
  if (cImageDetail) {
    const c2 = await processNote(cImageDetail);
    dumpProcessed("C.urls.image", c2);
    qualityAssertions("C.urls.image", c2);
    t("C.urls.image transcript_source = xhs_text", c2.transcriptSource === "xhs_text");
    t("C.urls.image content_type = xhs_image", c2.contentType === "xhs_image");
  }

  // SCENARIO D — Multi-image vision A/B (same image post, single vs stack)
  console.log(`\n\n━━━━━━━━━━━━ D. multi-image vision A/B ━━━━━━━━━━━━ (${elapsed()})`);
  if (cImageDetail && cImageDetail.images.length >= 3) {
    const allUrls = cImageDetail.images.map((i) => i.originalUrl || i.url).filter(Boolean);
    console.log(`  comparing on ${cImageDetail.images.length}-image post: "${cImageDetail.title.slice(0, 50)}"`);
    const single = await analyzeThumbnail(allUrls[0]!, "zh");
    const stack = await analyzeImageStack(allUrls, "zh");
    console.log(`\n  ─ single (cover only):`);
    console.log(`    desc: ${head(single?.description, 200)}`);
    console.log(`    why:  ${head(single?.whyItWorks, 200)}`);
    console.log(`\n  ─ stack (all ${allUrls.length} images):`);
    console.log(`    desc: ${head(stack?.description, 200)}`);
    console.log(`    why:  ${head(stack?.whyItWorks, 200)}`);
    t("vision A/B both returned non-null", !!single && !!stack);
    if (single && stack) {
      t(
        "stack description ≥ single description length (richer)",
        stack.description.length >= single.description.length,
      );
    }
  } else {
    console.log("  skipped (image note unavailable or <3 images)");
  }

  // SCENARIO E — SOP generation on aggregated XHS notes (the channel-level output)
  console.log(`\n\n━━━━━━━━━━━━ E. SOP generation (channel-level) ━━━━━━━━━━━━ (${elapsed()})`);
  // Use the 4 notes processed so far if available; otherwise skip.
  // For brevity here we re-fetch exploration top-5 by engagement and process them all if not done yet.
  console.log(`  using exploration top-3 by engagement as channel input`);
  const sopInputNotes = sortedByEngagement.slice(0, 3);
  const sopProcessed: Processed[] = [];
  for (let i = 0; i < sopInputNotes.length; i++) {
    const n = sopInputNotes[i]!;
    console.log(`\n  processing ${i + 1}/${sopInputNotes.length}: "${n.title.slice(0, 40)}"`);
    sopProcessed.push(await processNote(n));
  }

  // Build "videos_data" text in the same shape analyze-channel.ts does.
  function videoBlock(p: Processed, i: number): string {
    const n = p.note;
    const lines: string[] = [];
    lines.push(`### Note ${i + 1}: "${n.title || "(untitled)"}"`);
    lines.push(`- Engagement score: ${n.engagementScore}`);
    lines.push(`- Type: ${p.contentType}`);
    if (n.durationSec) lines.push(`- Duration: ${n.durationSec}s`);
    lines.push(`- URL: ${n.noteUrl}`);
    if (p.analysis) {
      const a = p.analysis;
      const entries: Array<[string, string]> = [
        ["opening_hook", a.opening_hook],
        ["framework", a.framework],
        ["script_structure", a.script_structure],
        ["retention_pattern", a.retention_pattern],
        ["key_takeaways", a.key_takeaways],
      ];
      for (const [k, v] of entries) {
        if (v) lines.push(`- ${k}: ${v.slice(0, 400)}`);
      }
    }
    if (p.transcript) lines.push(`- Transcript: ${p.transcript.slice(0, 1500)}`);
    return lines.join("\n");
  }
  const videosData = sopProcessed
    .filter((p) => p.analysis)
    .map((p, i) => videoBlock(p, i))
    .join("\n\n");
  const totalEngagement = sopProcessed.reduce((s, p) => s + p.note.engagementScore, 0);
  const date = new Date().toISOString().split("T")[0]!;

  // Each SOP builder. DeepSeek per SOP, sequentially.
  const sopRecipes: Array<{ type: string; prompt: () => string | null }> = [
    {
      type: "human",
      prompt: () =>
        buildHumanSopPrompt({
          channelName: "纽约野富美",
          videoCount: sopProcessed.length,
          totalViews: totalEngagement,
          date,
          videosData,
          language: "zh",
        }),
    },
    {
      type: "ai_reference",
      prompt: () =>
        buildAiSopReferencePrompt({
          channelName: "纽约野富美",
          videoCount: sopProcessed.length,
          totalViews: totalEngagement,
          date,
          videosData,
          language: "zh",
        }),
    },
    {
      type: "hottest",
      prompt: () => {
        const top = sopProcessed.find((p) => p.transcript && p.analysis);
        if (!top) return null;
        return buildHottestSopPrompt({
          channelName: "纽约野富美",
          title: top.note.title,
          views: top.note.engagementScore,
          durationSec: top.note.durationSec ?? 0,
          url: top.note.noteUrl,
          transcript: top.transcript!,
          analysisSummary: [
            top.analysis!.opening_hook && `**开场钩子**: ${top.analysis!.opening_hook}`,
            top.analysis!.framework && `**内容框架**: ${top.analysis!.framework}`,
            top.analysis!.script_structure && `**脚本结构**: ${top.analysis!.script_structure}`,
            top.analysis!.retention_pattern && `**留存模式**: ${top.analysis!.retention_pattern}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
          language: "zh",
        });
      },
    },
  ];

  for (const recipe of sopRecipes) {
    const p = recipe.prompt();
    if (!p) {
      t(`SOP ${recipe.type} generated`, false, "precondition not met");
      continue;
    }
    console.log(`\n  generating ${recipe.type} SOP (DeepSeek pro, maxTokens=8192)…`);
    const t0 = Date.now();
    const res = await generateText({
      model: llm("pro"),
      prompt: p,
      maxOutputTokens: 8192,
      temperature: 0.4,
      maxRetries: 2,
    });
    const dur = ((Date.now() - t0) / 1000).toFixed(0);
    const md = res.text.trim();
    const cn = (md.match(/[一-鿿]/g) ?? []).length;
    console.log(`  ${recipe.type}: ${md.length} chars, ${cn} CJK chars, ${dur}s`);
    console.log(`  head: ${head(md, 250)}`);
    t(`SOP ${recipe.type} generated (≥ 1500 chars)`, md.length >= 1500);
    // English structural markers (CONTENT_FORMULA, headings) lower the ratio;
    // 50% is the realistic threshold for a mostly-Chinese SOP.
    t(`SOP ${recipe.type} Chinese-heavy (≥ 50% CJK)`, cn / md.length >= 0.5);
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log(`\n\n══════════════ SUMMARY ══════════════`);
  console.log(`  pass: ${pass}    fail: ${fail}    total elapsed: ${elapsed()}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\n✗ FATAL:", err);
  process.exit(1);
});
