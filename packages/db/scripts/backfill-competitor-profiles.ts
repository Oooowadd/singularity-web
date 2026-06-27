import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });

const { resolveXhsUser } = await import("@singularity/integrations/clients/xhs");
const { getChannelInfo } = await import("@singularity/integrations/clients/tikhub");

// Backfill avatar/follower metadata for competitor_accounts created before the import
// path captured it. Idempotent; only touches rows missing data. YouTube rows still
// pending key resolution are skipped (getChannelInfo needs a UC id).
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
try {
  const rows = await client`
    select id, platform, platform_key, url, name from competitor_accounts
    where deleted_at is null
      and (avatar_url is null or subscriber_count is null or name is null)
      and not (platform = 'youtube' and needs_resolution)`;
  console.log(`candidates: ${rows.length}`);
  let ok = 0;
  for (const r of rows) {
    try {
      let name: string | null = null;
      let avatarUrl: string | null = null;
      let subscriberCount: number | null = null;
      if (r.platform === "xhs") {
        const u = await resolveXhsUser(r.url);
        name = u.nickname || null;
        avatarUrl = u.avatarUrl || null;
        subscriberCount = u.fansCount || null;
      } else {
        const info = await getChannelInfo(r.platform_key);
        name = info.channel_name || null;
        avatarUrl = info.thumbnail_url;
        subscriberCount = info.subscriberCount;
      }
      await client`
        update competitor_accounts set
          name = coalesce(${name}, name),
          avatar_url = coalesce(${avatarUrl}, avatar_url),
          subscriber_count = coalesce(${subscriberCount}, subscriber_count),
          last_verified_at = now(),
          updated_at = now()
        where id = ${r.id}`;
      ok++;
      console.log(`✓ ${r.platform} ${name ?? r.name ?? r.url} (${subscriberCount ?? "?"})`);
    } catch (err) {
      console.warn(`✗ ${r.url}: ${(err as Error).message.slice(0, 100)}`);
    }
  }
  console.log(`done: ${ok}/${rows.length} updated`);
} finally {
  await client.end();
}
