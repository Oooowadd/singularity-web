import "server-only";

import { getLogtoContext } from "@logto/next/server-actions";

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

  // Race-free single round trip: select-then-insert let concurrent first-login
  // requests collide on the logto_id unique.
  const [row] = await db
    .insert(users)
    .values({ logtoId: identity.sub, email, displayName })
    .onConflictDoUpdate({
      target: users.logtoId,
      set: { email, displayName },
    })
    .returning();
  return row!;
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
