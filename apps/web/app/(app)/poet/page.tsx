import { count, desc, eq, max, sql } from "drizzle-orm";
import Link from "next/link";

import { channels, poetBible, poetCustomTopics } from "@singularity/db";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { ensureCurrentUser } from "@/lib/users";

export default async function PoetLandingPage() {
  const user = await ensureCurrentUser();
  if (!user) return null;

  const bibleRows = await db
    .select({
      channelId: channels.id,
      channelSlug: channels.slug,
      channelName: channels.name,
      platform: channels.platform,
      bibleCount: count(poetBible.id),
      lastUpdatedAt: max(poetBible.updatedAt),
    })
    .from(channels)
    .leftJoin(poetBible, eq(poetBible.channelId, channels.id))
    .where(eq(channels.userId, user.id))
    .groupBy(channels.id, channels.slug, channels.name, channels.platform)
    .having(sql`count(${poetBible.id}) > 0`);

  const topicRows = await db
    .select({
      channelId: channels.id,
      topicCount: count(poetCustomTopics.id),
    })
    .from(channels)
    .leftJoin(poetCustomTopics, eq(poetCustomTopics.channelId, channels.id))
    .where(eq(channels.userId, user.id))
    .groupBy(channels.id);

  const topicsByChannel = new Map(topicRows.map((r) => [r.channelId, r.topicCount]));

  const rows = bibleRows
    .map((r) => ({ ...r, topicCount: topicsByChannel.get(r.channelId) ?? 0 }))
    .sort((a, b) => {
      const at = a.lastUpdatedAt?.getTime() ?? 0;
      const bt = b.lastUpdatedAt?.getTime() ?? 0;
      return bt - at;
    });

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-center gap-3">
        <span className="size-2 rounded-full bg-poet" />
        <h1 className="text-2xl font-semibold tracking-tight">Poet</h1>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-sm text-muted-foreground">
          No bibles yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead className="w-24">Platform</TableHead>
              <TableHead className="w-24">Bibles</TableHead>
              <TableHead className="w-28">Custom topics</TableHead>
              <TableHead className="w-40">Last updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.channelId}>
                <TableCell className="font-medium">
                  <Link
                    href={`/poet/${encodeURIComponent(r.channelSlug)}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {r.channelName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                    {r.platform}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{r.bibleCount}</TableCell>
                <TableCell className="font-mono text-sm">{r.topicCount}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.lastUpdatedAt
                    ? r.lastUpdatedAt.toLocaleDateString("zh-CN")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
