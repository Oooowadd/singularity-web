// Full smoke for the xhs.ts TikHub client. Exercises every public function
// on real XHS accounts/notes the user provided in Phase 0. Asserts shape so
// schema regressions surface immediately.
//
// Run: pnpm --filter @goooose/db xhs-client-smoke

import { config } from "dotenv";
config({ path: new URL("../../../.env.local", import.meta.url) });

import {
  computeXhsEngagement,
  extractXhsNoteId,
  extractXhsUserId,
  extractXsecToken,
  getXhsNoteDetail,
  getXhsUserNotes,
  resolveXhsUser,
} from "@goooose/integrations/clients/xhs";
import { fetchReference } from "@goooose/integrations/clients/references";

const ACCOUNTS = {
  redhead_witch:
    "https://www.xiaohongshu.com/user/profile/6166b66a0000000002027a1d?xsec_token=ABcBlpM9zG5QXf3J-jkQg9UcCgXPNun7fnT3893-4_Nf0%3D&xsec_source=pc_search",
  exploration:
    "https://www.xiaohongshu.com/user/profile/672a8c0a000000001d02d088?xsec_token=ABQ690heASM4wOsX6L5eqZWYptp7YJ4mExC4XWC1AQ9Qc%3D&xsec_source=pc_search",
};

const NOTES = {
  video:
    "https://www.xiaohongshu.com/explore/69d4f1e60000000021010db4?xsec_token=ABHwAUKKTP-15YaVMFvDjANuRAcalo3kV4lrxeJc3KvFs=&xsec_source=pc_user",
  image:
    "https://www.xiaohongshu.com/explore/6a0288a20000000038035cae?xsec_token=ABzNOY2LoXXGgjNewauDBQoImpRie0a0KUslC0Y1e8IfY=&xsec_source=pc_feed",
};

let pass = 0;
let fail = 0;
function t(name: string, ok: boolean, detail?: string) {
  const marker = ok ? "✓" : "✗";
  console.log(`  ${marker} ${name}${detail ? ` · ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
}

async function main() {
  console.log("\n══════ A. URL / ID extractors (pure unit) ══════");
  t(
    "extractXhsUserId from profile URL",
    extractXhsUserId(ACCOUNTS.redhead_witch) === "6166b66a0000000002027a1d",
  );
  t(
    "extractXhsUserId from bare 24-hex",
    extractXhsUserId("6166b66a0000000002027a1d") === "6166b66a0000000002027a1d",
  );
  t("extractXhsUserId rejects garbage", extractXhsUserId("not-a-url") === null);
  t(
    "extractXhsUserId rejects 23-hex (too short)",
    extractXhsUserId("6166b66a0000000002027a1") === null,
  );
  t(
    "extractXhsNoteId from explore URL",
    extractXhsNoteId(NOTES.video) === "69d4f1e60000000021010db4",
  );
  t(
    "extractXhsNoteId from discovery/item URL",
    extractXhsNoteId("https://www.xiaohongshu.com/discovery/item/69d4f1e60000000021010db4") ===
      "69d4f1e60000000021010db4",
  );
  t(
    "extractXsecToken from URL",
    typeof extractXsecToken(NOTES.video) === "string" &&
      extractXsecToken(NOTES.video)!.length > 10,
  );
  t(
    "extractXsecToken null when absent",
    extractXsecToken("https://www.xiaohongshu.com/explore/abc") === null,
  );

  console.log("\n══════ B. resolveXhsUser (real API) ══════");
  const u1 = await resolveXhsUser(ACCOUNTS.redhead_witch);
  console.log(
    `  redhead_witch: nickname="${u1.nickname}" red_id=${u1.redId} fans=${u1.fansCount} interactions=${u1.interactionsCount}`,
  );
  console.log(`    desc head: ${u1.desc.slice(0, 60)}...`);
  t("redhead_witch nickname stripped of wrapper", u1.nickname === "AI红发魔女");
  t("redhead_witch fans count > 0", u1.fansCount > 0);
  t("redhead_witch interactions count > 0", u1.interactionsCount > 0);
  t("redhead_witch desc non-empty", u1.desc.length > 0);
  t("redhead_witch avatar URL parsable", /^https?:\/\//.test(u1.avatarUrl));
  t("redhead_witch userId echoed", u1.userId === "6166b66a0000000002027a1d");

  const u2 = await resolveXhsUser(ACCOUNTS.exploration);
  console.log(
    `  exploration: nickname="${u2.nickname}" fans=${u2.fansCount} interactions=${u2.interactionsCount}`,
  );
  t(
    "exploration nickname has no @/的个人主页 wrappers",
    u2.nickname.length > 0 && !u2.nickname.startsWith("@") && !u2.nickname.endsWith("的个人主页"),
  );

  console.log("\n══════ C. getXhsUserNotes (real API) ══════");
  const notes1 = await getXhsUserNotes(ACCOUNTS.redhead_witch, 3);
  console.log(`  redhead_witch returned ${notes1.length} notes`);
  for (const n of notes1) {
    console.log(
      `    [${n.type}] "${n.title.slice(0, 35)}" engagement=${n.engagementScore} streams=${n.videoStreams.length} images=${n.images.length}`,
    );
  }
  t("redhead_witch returned exactly 3 notes", notes1.length === 3);
  t(
    "every note has non-empty title",
    notes1.every((n) => n.title.length > 0 && n.title !== "(untitled)"),
  );
  t(
    "every note has valid note_id (24 hex)",
    notes1.every((n) => /^[a-f0-9]{16,32}$/i.test(n.noteId)),
  );
  t("every note has channelName", notes1.every((n) => n.channelName.length > 0));
  t(
    "engagement formula matches computeXhsEngagement",
    notes1.every(
      (n) =>
        n.engagementScore ===
        computeXhsEngagement({
          likes: n.likes,
          collectedCount: n.collectedCount,
          commentsCount: n.commentsCount,
          shareCount: n.shareCount,
        }),
    ),
  );

  const notes2 = await getXhsUserNotes(ACCOUNTS.exploration, 5);
  console.log(`  exploration returned ${notes2.length} notes`);
  const typeDist = notes2.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`    type distribution: ${JSON.stringify(typeDist)}`);
  const videoNote = notes2.find((n) => n.type === "video");
  const imageNote = notes2.find((n) => n.type === "image");
  t("exploration list has at least one video note", videoNote !== undefined);
  t("exploration list has at least one image note", imageNote !== undefined);

  if (videoNote) {
    console.log(
      `    video "${videoNote.title.slice(0, 35)}": ${videoNote.videoStreams.length} streams, smallest=${videoNote.videoStreams[0]?.size} bytes, duration=${videoNote.durationSec}s, thumb=${videoNote.thumbnailUrl ? "yes" : "no"}`,
    );
    t("video note has at least one stream", videoNote.videoStreams.length > 0);
    t(
      "smallest stream has http master_url",
      videoNote.videoStreams[0]?.masterUrl.startsWith("http") ?? false,
    );
    t(
      "streams sorted ascending by size",
      videoNote.videoStreams.every((s, i, arr) => i === 0 || s.size >= arr[i - 1]!.size),
    );
    t(
      "video has durationSec > 0",
      videoNote.durationSec !== null && videoNote.durationSec > 0,
    );
    t("video has thumbnail URL", videoNote.thumbnailUrl !== null);
  }

  if (imageNote) {
    console.log(
      `    image "${imageNote.title.slice(0, 35)}": ${imageNote.images.length} images, desc=${imageNote.desc.length} chars`,
    );
    t("image note has images_list populated", imageNote.images.length > 0);
    t("image note has zero video streams", imageNote.videoStreams.length === 0);
    t(
      "image[0] has http url",
      imageNote.images[0]?.url.startsWith("http") ?? false,
    );
    t("image note has non-empty desc", imageNote.desc.length > 0);
  }

  console.log("\n══════ D. getXhsNoteDetail (real API, no xsec_token) ══════");
  const videoNoteId = extractXhsNoteId(NOTES.video)!;
  const imageNoteId = extractXhsNoteId(NOTES.image)!;

  const detail1 = await getXhsNoteDetail(videoNoteId);
  console.log(
    `  video detail: ${detail1 ? `"${detail1.title.slice(0, 40)}" likes=${detail1.likes} comments=${detail1.commentsCount} shares=${detail1.shareCount}` : "(null)"}`,
  );
  t("video detail returned non-null", detail1 !== null);
  if (detail1) {
    t("video detail has likes > 0", detail1.likes > 0);
    t("video detail has channelName", detail1.channelName.length > 0);
    t("video detail noteId matches", detail1.noteId === videoNoteId);
  }

  const detail2 = await getXhsNoteDetail(imageNoteId);
  console.log(
    `  image detail: ${detail2 ? `"${detail2.title.slice(0, 40)}" likes=${detail2.likes} images=${detail2.images.length}` : "(null)"}`,
  );
  t("image detail returned non-null", detail2 !== null);
  if (detail2) {
    t("image detail has likes > 0", detail2.likes > 0);
    t("image detail has at least 1 image", detail2.images.length > 0);
  }

  console.log("\n══════ E. fetchReference → XHS path end-to-end (references.ts) ══════");
  const ref1 = await fetchReference({ kind: "xhs", url: NOTES.video });
  console.log(`  video ref: title="${ref1.title.slice(0, 40)}" content=${ref1.content.length} chars source=${ref1.source}`);
  t("video ref no error", !ref1.error);
  t("video ref content non-empty", ref1.content.length > 0);
  t("video ref source=text", ref1.source === "text");

  const ref2 = await fetchReference({ kind: "xhs", url: NOTES.image });
  console.log(`  image ref: title="${ref2.title.slice(0, 40)}" content=${ref2.content.length} chars source=${ref2.source}`);
  t("image ref no error", !ref2.error);
  t("image ref content non-empty (≥ 500 chars for J&J body)", ref2.content.length >= 500);
  t("image ref source=text", ref2.source === "text");

  console.log("\n══════ F. computeXhsEngagement (pure formula) ══════");
  t(
    "100 likes + 10 collects + 5 comments + 2 shares = 145",
    computeXhsEngagement({ likes: 100, collectedCount: 10, commentsCount: 5, shareCount: 2 }) ===
      145,
  );
  t(
    "0 across the board = 0",
    computeXhsEngagement({ likes: 0, collectedCount: 0, commentsCount: 0, shareCount: 0 }) === 0,
  );
  t(
    "weights are likes:1 collects:2 comments:3 shares:5",
    computeXhsEngagement({ likes: 1, collectedCount: 1, commentsCount: 1, shareCount: 1 }) === 11,
  );

  console.log(`\n${pass} pass / ${fail} fail`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
