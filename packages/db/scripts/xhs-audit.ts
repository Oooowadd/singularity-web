import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { channels, clerkSops, clerkVideos, museIdeas, museMonitorVideos, poetBible } from "../src/schema";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
const c = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(c);
try {
  const xhsChannels = await db.select().from(channels).where(eq(channels.platform, "xhs"));
  console.log(`XHS channels: ${xhsChannels.length}`);
  for (const ch of xhsChannels) console.log(`  ${ch.id} | ${ch.name} | ${ch.platformUrl}`);
  console.log();
  for (const ch of xhsChannels) {
    const videos = await db.select({ count: sql<number>`count(*)::int` }).from(clerkVideos).where(eq(clerkVideos.channelId, ch.id));
    const sops = await db.select({ count: sql<number>`count(*)::int` }).from(clerkSops).where(eq(clerkSops.channelId, ch.id));
    const monitor = await db.select({ count: sql<number>`count(*)::int` }).from(museMonitorVideos).where(eq(museMonitorVideos.channelId, ch.id));
    const ideas = await db.select({ count: sql<number>`count(*)::int` }).from(museIdeas).where(eq(museIdeas.channelId, ch.id));
    const bibles = await db.select({ count: sql<number>`count(*)::int` }).from(poetBible).where(eq(poetBible.channelId, ch.id));
    console.log(`${ch.name}:`);
    console.log(`  clerk videos: ${videos[0]?.count ?? 0}`);
    console.log(`  clerk sops: ${sops[0]?.count ?? 0}`);
    console.log(`  muse monitor videos: ${monitor[0]?.count ?? 0}`);
    console.log(`  muse ideas: ${ideas[0]?.count ?? 0}`);
    console.log(`  poet bibles: ${bibles[0]?.count ?? 0}`);
  }
} finally { await c.end(); }
