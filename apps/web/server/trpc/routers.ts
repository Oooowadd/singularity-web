import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { channels } from "@singularity/db";

import { db } from "@/lib/db";
import { protectedProcedure, router } from "./init";
import { createChannelInput, deleteChannelInput } from "./schemas/channels";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "channel";
}

async function uniqueSlug(userId: string, base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  while (true) {
    const existing = await db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.userId, userId), eq(channels.slug, candidate)))
      .limit(1);
    if (existing.length === 0) return candidate;
    suffix++;
    candidate = `${base}-${suffix}`;
  }
}

export const appRouter = router({
  channels: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db
        .select()
        .from(channels)
        .where(eq(channels.userId, ctx.user.id))
        .orderBy(desc(channels.createdAt));
    }),

    create: protectedProcedure
      .input(createChannelInput)
      .mutation(async ({ ctx, input }) => {
        const slug = await uniqueSlug(ctx.user.id, slugify(input.name));
        const [created] = await db
          .insert(channels)
          .values({
            userId: ctx.user.id,
            name: input.name,
            slug,
            platform: input.platform,
            platformUrl: input.platformUrl,
            description: input.description ?? null,
          })
          .returning();
        return created!;
      }),

    delete: protectedProcedure
      .input(deleteChannelInput)
      .mutation(async ({ ctx, input }) => {
        const [deleted] = await db
          .delete(channels)
          .where(and(eq(channels.id, input.id), eq(channels.userId, ctx.user.id)))
          .returning({ id: channels.id });
        return { id: deleted?.id ?? null };
      }),
  }),
});

export type AppRouter = typeof appRouter;
