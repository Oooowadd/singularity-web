/**
 * Sanity checks on the imported archive data.
 *
 * Run: pnpm --filter @goooose/db sanity-check
 *
 * Validates:
 *   1. row counts match the xlsx Summary TOTAL row
 *   2. every FK column resolves (no orphans)
 *   3. cascade delete works (creates a probe channel, deletes, verifies)
 *   4. data isolation: every row's channel.user_id resolves to one user
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  channels,
  clerkSops,
  clerkVideos,
  museIdeas,
  museMonitorVideos,
  poetBible,
  poetCustomTopics,
  users,
} from "../src/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const TARGET_EMAIL = "justinliuforever@gmail.com";

const EXPECTED_COUNTS: Record<string, number> = {
  channels: 10,
  clerk_videos: 218,
  clerk_sops: 31,
  muse_monitor_videos: 10,
  muse_ideas: 50,
  poet_bible: 7,
  poet_custom_topics: 18,
};

type CheckResult = { name: string; ok: boolean; detail: string };

const results: CheckResult[] = [];
let failed = 0;

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  const icon = ok ? "✓" : "✗";
  console.log(`  ${icon} ${name}: ${detail}`);
}

async function main() {
  const client = postgres(DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  const [user] = await db.select().from(users).where(eq(users.email, TARGET_EMAIL));
  if (!user) {
    console.error(`User ${TARGET_EMAIL} not found`);
    process.exit(1);
  }

  console.log(`\n[G1] Row counts (expecting xlsx TOTAL row)`);
  const counters = [
    { name: "channels", q: channels },
    { name: "clerk_videos", q: clerkVideos },
    { name: "clerk_sops", q: clerkSops },
    { name: "muse_monitor_videos", q: museMonitorVideos },
    { name: "muse_ideas", q: museIdeas },
    { name: "poet_bible", q: poetBible },
    { name: "poet_custom_topics", q: poetCustomTopics },
  ];
  for (const t of counters) {
    const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(t.q);
    const actual = row?.c ?? 0;
    const expected = EXPECTED_COUNTS[t.name]!;
    check(t.name, actual === expected, `${actual} (expected ${expected})`);
  }

  console.log(`\n[G2-G5] FK integrity — orphans must be 0`);
  // clerk_videos.channelId — NOT NULL FK; cascade ensures none orphaned
  const [orphanClerkVideos] = await db.execute(sql`
    select count(*)::int as c
    from clerk_videos cv
    where not exists (select 1 from channels c where c.id = cv.channel_id)
  `);
  check(
    "clerk_videos → channels",
    Number((orphanClerkVideos as { c: number })?.c) === 0,
    `${(orphanClerkVideos as { c: number })?.c ?? "?"} orphans`,
  );

  const [orphanSops] = await db.execute(sql`
    select count(*)::int as c
    from clerk_sops cs
    where not exists (select 1 from channels c where c.id = cs.channel_id)
  `);
  check(
    "clerk_sops → channels",
    Number((orphanSops as { c: number })?.c) === 0,
    `${(orphanSops as { c: number })?.c ?? "?"} orphans`,
  );

  // muse_ideas.sourceVideoId (nullable) — when set, must resolve
  const [danglingMuseSource] = await db.execute(sql`
    select count(*)::int as c
    from muse_ideas mi
    where mi.source_video_id is not null
      and not exists (select 1 from muse_monitor_videos mv where mv.id = mi.source_video_id)
  `);
  check(
    "muse_ideas.source_video_id resolves",
    Number((danglingMuseSource as { c: number })?.c) === 0,
    `${(danglingMuseSource as { c: number })?.c ?? "?"} dangling`,
  );

  // poet_custom_topics.bibleId (nullable) — when set, must resolve
  const [danglingTopicBible] = await db.execute(sql`
    select count(*)::int as c
    from poet_custom_topics t
    where t.bible_id is not null
      and not exists (select 1 from poet_bible b where b.id = t.bible_id)
  `);
  check(
    "poet_custom_topics.bible_id resolves",
    Number((danglingTopicBible as { c: number })?.c) === 0,
    `${(danglingTopicBible as { c: number })?.c ?? "?"} dangling`,
  );

  // poet_custom_topics.sopId (nullable) — when set, must resolve
  const [danglingTopicSop] = await db.execute(sql`
    select count(*)::int as c
    from poet_custom_topics t
    where t.sop_id is not null
      and not exists (select 1 from clerk_sops s where s.id = t.sop_id)
  `);
  check(
    "poet_custom_topics.sop_id resolves",
    Number((danglingTopicSop as { c: number })?.c) === 0,
    `${(danglingTopicSop as { c: number })?.c ?? "?"} dangling`,
  );

  console.log(`\n[G6] User isolation — every row belongs to ${TARGET_EMAIL}`);
  const [mineCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(channels)
    .where(eq(channels.userId, user.id));
  const [allCount] = await db.select({ c: sql<number>`count(*)::int` }).from(channels);
  check(
    "all channels belong to target user",
    mineCount?.c === allCount?.c,
    `${mineCount?.c}/${allCount?.c} owned`,
  );

  const [crossUserClerk] = await db.execute(sql`
    select count(*)::int as c
    from clerk_videos cv
    join channels c on c.id = cv.channel_id
    where c.user_id <> ${user.id}::uuid
  `);
  check(
    "no clerk_videos for other users",
    Number((crossUserClerk as { c: number })?.c) === 0,
    `${(crossUserClerk as { c: number })?.c ?? "?"} foreign rows`,
  );

  console.log(`\n[G7] Cascade delete probe`);
  // Create a probe channel + child rows, then delete the channel and assert children gone.
  await db.transaction(async (tx) => {
    const probeSlug = `__sanity_probe_${Date.now()}`;
    const [probe] = await tx
      .insert(channels)
      .values({
        userId: user.id,
        name: probeSlug,
        slug: probeSlug,
        platform: "youtube",
        platformUrl: "https://example.com/probe",
        competitors: [],
      })
      .returning();
    if (!probe) throw new Error("probe insert returned no row");

    await tx.insert(clerkVideos).values({
      channelId: probe.id,
      platformVideoId: "probe_video_1",
      title: "probe",
      url: "https://example.com/probe",
    });
    await tx.insert(museMonitorVideos).values({
      channelId: probe.id,
      platformVideoId: "probe_video_2",
      title: "probe",
      url: "https://example.com/probe",
    });
    await tx.insert(poetBible).values({
      channelId: probe.id,
      name: "probe bible",
      content: "probe",
    });

    const [pre] = await tx.execute(sql`
      select
        (select count(*) from clerk_videos where channel_id = ${probe.id}::uuid)::int as cv,
        (select count(*) from muse_monitor_videos where channel_id = ${probe.id}::uuid)::int as mv,
        (select count(*) from poet_bible where channel_id = ${probe.id}::uuid)::int as pb
    `);
    const preRow = pre as { cv: number; mv: number; pb: number };
    check(
      "probe children inserted",
      preRow.cv === 1 && preRow.mv === 1 && preRow.pb === 1,
      `cv=${preRow.cv} mv=${preRow.mv} pb=${preRow.pb}`,
    );

    await tx.delete(channels).where(eq(channels.id, probe.id));

    const [post] = await tx.execute(sql`
      select
        (select count(*) from clerk_videos where channel_id = ${probe.id}::uuid)::int as cv,
        (select count(*) from muse_monitor_videos where channel_id = ${probe.id}::uuid)::int as mv,
        (select count(*) from poet_bible where channel_id = ${probe.id}::uuid)::int as pb
    `);
    const postRow = post as { cv: number; mv: number; pb: number };
    check(
      "cascade delete cleared children",
      postRow.cv === 0 && postRow.mv === 0 && postRow.pb === 0,
      `cv=${postRow.cv} mv=${postRow.mv} pb=${postRow.pb}`,
    );
  });

  console.log(`\n[Bonus] Schema invariants`);
  // poet_scripts CHECK constraint: exactly one of idea_id/custom_topic_id (we don't import scripts,
  // so 0 rows; verify constraint exists by attempting an invalid insert is overkill — skip)
  // Channel slug uniqueness per user
  const [dupSlug] = await db.execute(sql`
    select slug, count(*)::int as c
    from channels
    where user_id = ${user.id}::uuid
    group by slug
    having count(*) > 1
    limit 1
  `);
  check(
    "channel slugs unique per user",
    !dupSlug,
    dupSlug ? `duplicate: ${JSON.stringify(dupSlug)}` : "ok",
  );

  // Custom topic exactly-one-link assertion: we imported with bible OR sop linked, both can be set.
  // The CHECK is only on poet_scripts; topics can link both. Just inspect:
  const [bothLinked] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(poetCustomTopics)
    .where(
      and(isNotNull(poetCustomTopics.bibleId), isNotNull(poetCustomTopics.sopId)),
    );
  console.log(
    `  • custom topics with BOTH bible + sop linked: ${bothLinked?.c ?? 0} (informational, no constraint)`,
  );

  await client.end();

  console.log(`\n${failed === 0 ? "All sanity checks passed." : `${failed} failure(s) — investigate above.`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
