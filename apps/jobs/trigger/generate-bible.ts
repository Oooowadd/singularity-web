import { logger, metadata, task } from "@trigger.dev/sdk";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { channels, pipelineRuns, poetBible, poetDriftEvents } from "@singularity/db";
import { generateChannelBible } from "@singularity/shared/services/poet/bible";

type Payload = {
  channelId: string;
  runId: string;
  ideaText: string;
  name?: string;
  language?: "en" | "zh";
};

function safeText(v: string | null | undefined): string | null {
  if (v == null) return null;
  const cleaned = v.replace(/ /g, "");
  return cleaned === "" ? null : cleaned;
}

export const generateBible = task({
  id: "poet-generate-bible",
  maxDuration: 600,
  run: async (payload: Payload) => {
    const language = payload.language ?? "zh";
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    const db = drizzle(client);

    try {
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, payload.channelId))
        .limit(1);
      if (!channel) throw new Error(`channel ${payload.channelId} not found`);

      await db
        .update(pipelineRuns)
        .set({ status: "running" })
        .where(eq(pipelineRuns.id, payload.runId));
      await metadata.set("progress", {
        current: 0,
        total: 1,
        phase: "writing bible",
        detail: "AI 生成频道圣经中（约 1-2 分钟）",
      });

      const bible = await generateChannelBible({
        ideaText: payload.ideaText,
        channelDescription: channel.description ?? channel.name,
        language,
      });

      const drifted = bible.driftWarning !== null;
      const cleanContent = safeText(bible.content) ?? "";
      if (!cleanContent) throw new Error("Bible generation returned empty content");

      await db
        .update(poetBible)
        .set({ isActive: false })
        .where(and(eq(poetBible.channelId, channel.id), eq(poetBible.isActive, true)));

      const [inserted] = await db
        .insert(poetBible)
        .values({
          channelId: channel.id,
          name: payload.name ?? (bible.topicClaimed || "未命名"),
          content: cleanContent,
          sourceIdea: payload.ideaText,
          isActive: !drifted,
        })
        .returning();

      if (drifted && bible.driftWarning && inserted) {
        await db.insert(poetDriftEvents).values({
          channelId: channel.id,
          bibleId: inserted.id,
          reason: bible.driftWarning.reason,
          claimedTopic: bible.driftWarning.claimedTopic,
          humanMessage: bible.driftWarning.humanMessage,
        });
        logger.warn(`Bible drift: ${bible.driftWarning.reason}`, {
          topic: bible.driftWarning.claimedTopic,
        });
      }

      await db
        .update(pipelineRuns)
        .set({ status: "done", completedAt: new Date(), progress: 1, total: 1 })
        .where(eq(pipelineRuns.id, payload.runId));

      return {
        bibleId: inserted?.id ?? null,
        drifted,
        driftReason: bible.driftWarning?.reason ?? null,
        topicClaimed: bible.topicClaimed,
      };
    } catch (err) {
      const message = (err as Error).message;
      logger.error(`Bible run ${payload.runId} failed: ${message}`);
      await db
        .update(pipelineRuns)
        .set({ status: "failed", errorMessage: message, completedAt: new Date() })
        .where(eq(pipelineRuns.id, payload.runId));
      throw err;
    } finally {
      await client.end();
    }
  },
});
