import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { channels, poetBible, poetCustomTopics } from "@singularity/db";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type Props = { params: Promise<{ slug: string }> };

export default async function PoetChannelPage({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const user = await ensureCurrentUser();
  if (!user) return null;

  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.slug, slug))
    .limit(1);

  if (!channel || channel.userId !== user.id) notFound();

  const [bibles, topics] = await Promise.all([
    db
      .select()
      .from(poetBible)
      .where(eq(poetBible.channelId, channel.id))
      .orderBy(desc(poetBible.isActive), desc(poetBible.updatedAt)),
    db
      .select()
      .from(poetCustomTopics)
      .where(eq(poetCustomTopics.channelId, channel.id))
      .orderBy(desc(poetCustomTopics.updatedAt)),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/poet" />}
        className="w-fit text-muted-foreground"
      >
        <ChevronLeft data-icon="inline-start" />
        Poet
      </Button>

      <header className="flex items-center gap-3">
        <span className="size-2 rounded-full bg-poet" />
        <h1 className="text-2xl font-semibold tracking-tight">{channel.name}</h1>
        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
          {bibles.length} bibles · {topics.length} topics
        </Badge>
      </header>

      {bibles.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Bibles</h2>
          <div className="flex flex-col gap-4">
            {bibles.map((b) => (
              <article
                key={b.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-5"
              >
                <header className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-medium">{b.name}</h3>
                  {b.isActive ? (
                    <Badge variant="secondary" className="text-[10px]">
                      active
                    </Badge>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      archived
                    </span>
                  )}
                </header>
                {b.sourceIdea ? (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Source idea
                    </h4>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {b.sourceIdea}
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1">
                  <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Content
                  </h4>
                  <p className="text-sm whitespace-pre-wrap">{b.content}</p>
                </div>
                <footer className="font-mono text-xs text-muted-foreground">
                  generated {b.generatedAt.toLocaleDateString("zh-CN")}
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {topics.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Custom topics</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20">Language</TableHead>
                <TableHead className="w-24">Duration</TableHead>
                <TableHead className="w-28">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-md truncate font-medium">
                    <Link
                      href={`/poet/${encodeURIComponent(slug)}/topics/${t.id}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {t.topic}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground uppercase">
                    {t.language}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.durationMinutes ? `${t.durationMinutes}m` : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.updatedAt.toLocaleDateString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}
