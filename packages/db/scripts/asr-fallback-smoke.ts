/**
 * Smoke test for the production ASR helper.
 * Run: pnpm --filter @goooose/db asr-fallback-smoke
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { transcribeYoutubeVideo } = await import("@goooose/integrations/clients/asr");

const PROBES: Array<{ label: string; videoId: string; expectAsr: "yes" | "no" }> = [
  { label: "Rick Astley (audio present)", videoId: "dQw4w9WgXcQ", expectAsr: "yes" },
  { label: "Bogus video ID", videoId: "AAAAAAAAAAA", expectAsr: "no" },
];

async function main() {
  for (const probe of PROBES) {
    console.log(`\n═══ ${probe.label} (${probe.videoId}) — expect: ${probe.expectAsr}`);
    const t0 = Date.now();
    try {
      const result = await transcribeYoutubeVideo(probe.videoId, {
        logger: {
          info: (m) => console.log(`  [info] ${m}`),
          warn: (m) => console.log(`  [warn] ${m}`),
        },
        onPhase: (phase, info) =>
          console.log(
            `  [phase] ${phase}${info?.bytes ? ` (${(info.bytes / 1024 / 1024).toFixed(2)} MB)` : ""}`,
          ),
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (result) {
        console.log(
          `  ✓ ${elapsed}s · text=${result.text.length} chars · lang=${result.detectedLanguage ?? "?"} · dur=${result.durationSec ?? "?"}s`,
        );
        console.log(`    head: "${result.text.slice(0, 120)}…"`);
      } else {
        console.log(`  ∅ ${elapsed}s · null`);
      }
    } catch (err) {
      console.log(`  ✗ THREW: ${(err as Error).message.slice(0, 200)} (helper should never throw)`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
