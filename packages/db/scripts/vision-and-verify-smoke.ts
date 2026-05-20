/**
 * Smoke for the two coverage gaps left after Clerk/Muse/Poet smokes:
 *   A. analyzeThumbnail (single-image Claude vision) — used by Clerk
 *   B. channels.verifyUrl flow — YT Data API primary + XHS path
 *
 * Run: pnpm --filter @singularity/db vision-and-verify-smoke
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { analyzeThumbnail } = await import("@singularity/shared/clients/vision");
const {
  fetchChannelMetaByHandle,
  fetchChannelMetaById,
  parseYoutubeChannelUrl,
} = await import("@singularity/shared/clients/youtube-data");
const { isValidYoutubeChannelUrl } = await import("@singularity/shared/clients/tikhub");
const { isValidXhsProfileUrl, resolveXhsUser } = await import(
  "@singularity/shared/clients/xhs"
);

let pass = 0;
let fail = 0;
function ok(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
  }
}

async function testThumbnailVision() {
  console.log("\n══════ A. analyzeThumbnail (Claude single-image) ══════");
  // Rick Astley thumbnail — public, never moves, always 200 OK.
  const url = "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg";
  const t0 = Date.now();
  const result = await analyzeThumbnail(url, "zh", {
    warn: (m) => console.log(`  [warn] ${m}`),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  ok(`returned non-null in ${elapsed}s`, result !== null);
  if (!result) return;

  ok("has description (≥ 20 chars)", result.description.length >= 20);
  ok("has whyItWorks (≥ 20 chars)", result.whyItWorks.length >= 20);
  const desc = result.description;
  ok("description is Chinese", /[一-鿿]/.test(desc));
  console.log(`  description head: ${desc.slice(0, 120)}…`);
}

async function testValidators() {
  console.log("\n══════ B1. URL validators (pure unit) ══════");

  // YouTube — accept
  ok("@handle", isValidYoutubeChannelUrl("https://www.youtube.com/@mkbhd"));
  ok(
    "/channel/UC",
    isValidYoutubeChannelUrl("https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ"),
  );
  ok("/c/name", isValidYoutubeChannelUrl("https://www.youtube.com/c/mkbhd"));
  ok("/user/name", isValidYoutubeChannelUrl("https://www.youtube.com/user/marquesbrownlee"));
  // YouTube — reject
  ok(
    "rejects watch URL",
    !isValidYoutubeChannelUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
  );
  ok("rejects non-yt host", !isValidYoutubeChannelUrl("https://example.com/@foo"));

  // XHS — accept
  ok(
    "xhs /user/profile/24hex",
    isValidXhsProfileUrl(
      "https://www.xiaohongshu.com/user/profile/5b8b3b3b3b3b3b3b3b3b3b3b",
    ),
  );
  // XHS — reject
  ok(
    "xhs rejects 23-hex",
    !isValidXhsProfileUrl(
      "https://www.xiaohongshu.com/user/profile/5b8b3b3b3b3b3b3b3b3b3b3",
    ),
  );
  ok("xhs rejects youtube URL", !isValidXhsProfileUrl("https://www.youtube.com/@mkbhd"));
}

async function testYoutubeVerify() {
  console.log("\n══════ B2. YouTube verifyUrl flow (handle → YT Data API) ══════");
  const url = "https://www.youtube.com/@mkbhd";
  const parsed = parseYoutubeChannelUrl(url);
  ok("parsed type=handle", parsed?.type === "handle");
  if (parsed?.type !== "handle") return;

  const t0 = Date.now();
  const meta = await fetchChannelMetaByHandle(parsed.handle);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  ok(`fetchChannelMetaByHandle returned non-null in ${elapsed}s`, meta !== null);
  if (!meta) return;

  ok("title non-empty", !!meta.title);
  ok("channelId starts with UC", meta.channelId.startsWith("UC"));
  ok("subscriberCount is number > 0", typeof meta.subscriberCount === "number" && meta.subscriberCount > 0);
  ok("videoCount is number ≥ 0", typeof meta.videoCount === "number" && meta.videoCount >= 0);
  console.log(
    `  title=${meta.title} · subs=${meta.subscriberCount?.toLocaleString()} · videos=${meta.videoCount}`,
  );

  // Test id-based fetch on the same channel
  console.log("\n══════ B3. YouTube verifyUrl flow (/channel/UC → YT Data API) ══════");
  const metaById = await fetchChannelMetaById(meta.channelId);
  ok("fetchChannelMetaById returned non-null", metaById !== null);
  ok("same channelId echoed", metaById?.channelId === meta.channelId);
  ok("same title", metaById?.title === meta.title);
}

async function testXhsVerify() {
  console.log("\n══════ B4. XHS verifyUrl flow (resolveXhsUser) ══════");
  // Reuses redhead_witch profile from xhs-client-smoke — stable public profile.
  const url = "https://www.xiaohongshu.com/user/profile/6166b66a0000000002027a1d";
  ok("URL passes validator", isValidXhsProfileUrl(url));
  const t0 = Date.now();
  const user = await resolveXhsUser(url);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  ok(`resolved in ${elapsed}s`, !!user);
  if (!user) return;
  ok("nickname non-empty", !!user.nickname);
  ok("fansCount > 0", user.fansCount > 0);
  ok("interactionsCount > 0", user.interactionsCount > 0);
  console.log(
    `  nickname=${user.nickname} · fans=${user.fansCount} · interactions=${user.interactionsCount}`,
  );
}

async function main() {
  await testThumbnailVision();
  await testValidators();
  await testYoutubeVerify();
  await testXhsVerify();
  console.log(`\n${pass} pass / ${fail} fail`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
