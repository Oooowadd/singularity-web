import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";

import { channels, museIdeas, museMonitorVideos } from "@singularity/db";

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

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function MuseChannelPage({ params }: Props) {
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

  const [monitored, ideas] = await Promise.all([
    db
      .select()
      .from(museMonitorVideos)
      .where(eq(museMonitorVideos.channelId, channel.id))
      .orderBy(desc(museMonitorVideos.processedAt)),
    db
      .select({
        id: museIdeas.id,
        ideaNumber: museIdeas.ideaNumber,
        storyAngle: museIdeas.storyAngle,
        factsAndData: museIdeas.factsAndData,
        whySimilar: museIdeas.whySimilar,
        viralTrigger: museIdeas.viralTrigger,
        approved: museIdeas.approved,
        scripted: museIdeas.scripted,
        generatedAt: museIdeas.generatedAt,
        sourceTitle: museMonitorVideos.title,
        sourceUrl: museMonitorVideos.url,
      })
      .from(museIdeas)
      .leftJoin(museMonitorVideos, eq(museMonitorVideos.id, museIdeas.sourceVideoId))
      .where(eq(museIdeas.channelId, channel.id))
      .orderBy(asc(museIdeas.ideaNumber)),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/muse" />}
        className="w-fit text-muted-foreground"
      >
        <ChevronLeft data-icon="inline-start" />
        Muse
      </Button>

      <header className="flex items-center gap-3">
        <span className="size-2 rounded-full bg-muse" />
        <h1 className="text-2xl font-semibold tracking-tight">{channel.name}</h1>
        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
          {ideas.length} ideas
        </Badge>
      </header>

      {monitored.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Monitored videos</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-40">Source channel</TableHead>
                <TableHead className="w-20">Duration</TableHead>
                <TableHead className="w-24">Relevant</TableHead>
                <TableHead className="w-32">Topic</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitored.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="max-w-md truncate">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {v.title}
                      <ExternalLink className="size-3" />
                    </a>
                  </TableCell>
                  <TableCell className="truncate text-sm text-muted-foreground">
                    {v.sourceChannelName ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDuration(v.durationSec)}
                  </TableCell>
                  <TableCell>
                    {v.relevant === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : v.relevant ? (
                      <Badge variant="secondary" className="text-[10px]">
                        relevant
                      </Badge>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">
                        rejected
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="truncate text-xs text-muted-foreground">
                    {v.topicClassification ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      {ideas.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Ideas</h2>
          <div className="flex flex-col gap-4">
            {ideas.map((idea) => (
              <article
                key={idea.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-5"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{idea.ideaNumber}
                      {idea.sourceTitle ? (
                        <>
                          {" · from "}
                          {idea.sourceUrl ? (
                            <a
                              href={idea.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-foreground"
                            >
                              {idea.sourceTitle}
                            </a>
                          ) : (
                            idea.sourceTitle
                          )}
                        </>
                      ) : null}
                    </span>
                    <h3 className="text-base font-medium whitespace-pre-wrap">
                      {idea.storyAngle ?? "—"}
                    </h3>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {idea.approved ? (
                      <Badge variant="secondary" className="text-[10px]">
                        approved
                      </Badge>
                    ) : null}
                    {idea.scripted ? (
                      <Badge variant="secondary" className="text-[10px]">
                        scripted
                      </Badge>
                    ) : null}
                  </div>
                </header>

                {idea.factsAndData ? (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Facts & data
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">{idea.factsAndData}</p>
                  </div>
                ) : null}

                {idea.whySimilar ? (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Why similar
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">{idea.whySimilar}</p>
                  </div>
                ) : null}

                {idea.viralTrigger ? (
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Viral trigger
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">{idea.viralTrigger}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
