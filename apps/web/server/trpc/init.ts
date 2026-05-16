import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

import type { User } from "@singularity/db";

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

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
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
