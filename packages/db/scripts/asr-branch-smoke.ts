/**
 * Smoke test for the analyze-channel pipeline's ASR-fallback branch logic.
 * Exercises the same decision tree without Trigger.dev / DB writes.
 * Run: pnpm --filter @singularity/db asr-branch-smoke
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { getVideoWithTranscript } = await import("@singularity/shared/clients/tikhub");
const { transcribeYoutubeVideo } = await import("@singularity/shared/clients/asr");

const ASR_MAX_DURATION_SEC = 60 * 60;

type Probe = {
  label: string;
  videoId: string;
  expect: "caption" | "asr" | "null";
};

const PROBES: Probe[] = [
  // Rick Astley has caption tracks declared but all base_urls return empty
  // XML in 2026 — exercises the caption→ASR fallthrough.
  { label: "Rick Astley (caption tracks empty → ASR)", videoId: "dQw4w9WgXcQ", expect: "asr" },
  { label: "Lofi Girl 3h stream (no caption, > 60min → skip ASR)", videoId: "fhL67fnDXcU", expect: "null" },
  { label: "Bogus video id (graceful null)", videoId: "AAAAAAAAAAA", expect: "null" },
];

async function runOne(probe: Probe) {
  console.log(`\n═══ ${probe.label} (${probe.videoId}) — expect: ${probe.expect}`);
  let finalText: string | null = null;
  let source: "caption" | "asr" | null = null;
  try {
    const { info, transcript: captionTranscript } = await getVideoWithTranscript(probe.videoId);
    if (captionTranscript) {
      finalText = captionTranscript.text;
      source = "caption";
    } else {
      const durationSec = info.duration_sec ?? 0;
      const eligible = durationSec > 0 && durationSec <= ASR_MAX_DURATION_SEC;
      console.log(`  [branch] no caption · duration=${durationSec}s · asrEligible=${eligible}`);
      if (eligible) {
        const asr = await transcribeYoutubeVideo(probe.videoId, {
          logger: {
            info: (m) => console.log(`    [info] ${m}`),
            warn: (m) => console.log(`    [warn] ${m}`),
          },
        });
        if (asr) {
          finalText = asr.text;
          source = "asr";
        }
      }
    }
  } catch (err) {
    console.log(`  [error] ${(err as Error).message.slice(0, 200)}`);
    return;
  }
  const pass = source === (probe.expect === "null" ? null : probe.expect);
  console.log(
    `  ${pass ? "✓" : "✗"} source=${source ?? "null"} · text=${finalText?.length ?? 0} chars`,
  );
}

async function main() {
  for (const p of PROBES) await runOne(p);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
