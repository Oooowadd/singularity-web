import "server-only";

import { getLogtoContext } from "@logto/next/server-actions";
import { eq } from "drizzle-orm";

import { users, type User } from "@singularity/db";

import { db } from "./db";
import { logtoConfig } from "./logto";

type LogtoIdentity = {
  sub: string;
  email?: string | null;
  username?: string | null;
  name?: string | null;
};

async function upsertFromIdentity(identity: LogtoIdentity): Promise<User> {
  const email = identity.email ?? "";
  const displayName = identity.name ?? identity.username ?? null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.logtoId, identity.sub))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0]!;
    if (current.email !== email || current.displayName !== displayName) {
      const [updated] = await db
        .update(users)
        .set({ email, displayName })
        .where(eq(users.logtoId, identity.sub))
        .returning();
      return updated!;
    }
    return current;
  }

  const [created] = await db
    .insert(users)
    .values({ logtoId: identity.sub, email, displayName })
    .returning();
  return created!;
}

export async function ensureCurrentUser(): Promise<User | null> {
  const { isAuthenticated, claims } = await getLogtoContext(logtoConfig);
  if (!isAuthenticated || !claims) {
    return null;
  }

  return upsertFromIdentity({
    sub: claims.sub,
    email: claims.email,
    username: claims.username,
    name: claims.name,
  });
}
