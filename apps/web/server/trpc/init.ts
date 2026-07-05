import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import { createUsageSink, type User } from "@singularity/db";
import { runWithUsage } from "@singularity/integrations/metering";

import { db } from "@/lib/db";
import { ensureCurrentUser } from "@/lib/users";

export type Context = {
  user: User | null;
};

export async function createContext(): Promise<Context> {
  const user = await ensureCurrentUser();
  return { user };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Authenticated but not necessarily approved — only for the request-access flow.
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const usageSink = createUsageSink(db);

export const protectedProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.accessStatus !== "approved") {
    throw new TRPCError({ code: "FORBIDDEN", message: "内测资格待审批" });
  }
  // Attribute in-request client calls (TikHub verify/refresh etc.) to the user.
  return runWithUsage({ userId: ctx.user.id, feature: "web", sink: usageSink }, async () => next());
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next();
});
