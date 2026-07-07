/**
 * Smoke test for chunked Qwen ASR (long-audio segmentation + stitching).
 * Synthesizes Chinese speech locally (macOS `say`), so it exercises the real
 * extract → segment → per-chunk Qwen → stitch pipeline without YouTube/proxies.
 * Run: pnpm --filter @goooose/db exec tsx scripts/asr-chunk-smoke.ts
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { transcribeWithQwen } = await import("@goooose/integrations/clients/asr");

const log = {
  info: (m: string) => console.log(`  [info] ${m}`),
  warn: (m: string) => console.log(`  [warn] ${m}`),
};

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗ FAIL"} ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

const tmpFiles = (prefix: string) => readdirSync(tmpdir()).filter((f) => f.startsWith(prefix));

function synthesize(text: string, outM4a: string) {
  const aiff = outM4a.replace(/\.m4a$/, ".aiff");
  execFileSync("say", ["-v", "Flo (Chinese (China mainland))", "-o", aiff, text]);
  execFileSync("ffmpeg", ["-y", "-i", aiff, "-c:a", "aac", "-b:a", "96k", outM4a], {
    stdio: "ignore",
  });
  unlinkSync(aiff);
  return outM4a;
}

const START_MARK = "智能内容教练测试开始";
const END_MARK = "测试顺利结束谢谢收听";
const FILLER =
  "小红书和油管的创作者每天都在研究对标账号的爆款结构，钩子要在前三秒抓住观众，节奏要稳，证据要具体。" +
  "频道圣经定义了人设与语气，写稿方法论决定了结构与节拍，选题官负责巡视对标提取爆款触发因素。";

async function main() {
  const before = tmpFiles("goooose-asr-").length;

  // Case A: short clip → single-shot path (no chunking needed).
  console.log("\n═══ Case A: short audio (single shot)");
  const shortPath = join(tmpdir(), `asr-smoke-short-${Date.now()}.m4a`);
  synthesize(`${START_MARK}。${FILLER}${END_MARK}。`, shortPath);
  const shortSec = Math.round(statSync(shortPath).size / 12000); // 96kbps ≈ 12KB/s
  console.log(`  input ~${shortSec}s, ${statSync(shortPath).size} bytes`);
  const a = await transcribeWithQwen(shortPath, "audio/mp4", "zh", log);
  check("A: returns text", !!a && a.text.length > 20, `${a?.text.length ?? 0} chars`);
  check("A: start marker present", !!a && a.text.includes("测试开始"));
  unlinkSync(shortPath);

  // Case B: ~8 min clip → must chunk (>170s) and stitch all segments.
  console.log("\n═══ Case B: long audio (chunked + stitched)");
  const longPath = join(tmpdir(), `asr-smoke-long-${Date.now()}.m4a`);
  const longText = `${START_MARK}。${Array(40).fill(FILLER).join("")}${END_MARK}。`;
  synthesize(longText, longPath);
  const longBytes = statSync(longPath).size;
  console.log(`  input ~${Math.round(longBytes / 12000)}s, ${longBytes} bytes`);
  const t0 = Date.now();
  const b = await transcribeWithQwen(longPath, "audio/mp4", "zh", log);
  console.log(`  elapsed ${(Date.now() - t0) / 1000}s`);
  check("B: returns text", !!b && b.text.length > 500, `${b?.text.length ?? 0} chars`);
  check("B: start marker present (first chunk ok)", !!b && b.text.includes("测试开始"));
  check("B: end marker present (last chunk stitched)", !!b && b.text.includes("顺利结束"));
  unlinkSync(longPath);

  // Case C: ffmpeg unavailable → graceful failure, no crash.
  console.log("\n═══ Case C: ffmpeg unavailable (graceful degrade)");
  const prevFfmpeg = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = "/nonexistent/ffmpeg";
  const junkPath = join(tmpdir(), `asr-smoke-junk-${Date.now()}.m4a`);
  writeFileSync(junkPath, Buffer.alloc(8_000_000)); // over body-safe cap, can't extract
  try {
    const c = await transcribeWithQwen(junkPath, "audio/mp4", "zh", log);
    check("C: returned null (no crash)", c === null, JSON.stringify(c)?.slice(0, 60));
  } catch (err) {
    const msg = (err as Error).message;
    check("C: threw a labeled cap error (no crash)", /Qwen body-safe cap/.test(msg), msg.slice(0, 80));
  } finally {
    process.env.FFMPEG_PATH = prevFfmpeg;
    unlinkSync(junkPath);
  }

  // Temp hygiene: extraction + segment files must all be cleaned up.
  const after = tmpFiles("goooose-asr-").length;
  check("temp files cleaned", after <= before, `before=${before} after=${after}`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
