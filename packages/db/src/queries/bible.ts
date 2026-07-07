import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { poetBible } from "../schema/poet";
import { projects } from "../schema/project";

export type ResolvedBible = { bible: typeof poetBible.$inferSelect; viaFallback: boolean } | null;

// Bibles are per-account (accountId = channel/own-account spine), shared across its projects;
// viaFallback = served the account active Bible instead of the project's hard pin, for caller logging.
export async function resolveActiveBible(
  db: PostgresJsDatabase,
  projectId: string,
  accountId: string,
): Promise<ResolvedBible> {
  const [proj] = await db
    .select({ pin: projects.activeBibleId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (proj?.pin) {
    // A stale pin (pointing at a now-deactivated Bible) falls through to the account active
    // Bible instead of serving the wrong voice.
    const [pinned] = await db
      .select()
      .from(poetBible)
      .where(and(eq(poetBible.id, proj.pin), eq(poetBible.isActive, true)))
      .limit(1);
    if (pinned) return { bible: pinned, viaFallback: false };
  }
  const [active] = await db
    .select()
    .from(poetBible)
    .where(and(eq(poetBible.channelId, accountId), eq(poetBible.isActive, true)))
    .limit(1);
  return active ? { bible: active, viaFallback: true } : null;
}
