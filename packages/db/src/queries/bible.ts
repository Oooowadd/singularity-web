import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { poetBible } from "../schema/poet";
import { projects } from "../schema/project";

export type ResolvedBible = { bible: typeof poetBible.$inferSelect; viaFallback: boolean } | null;

// The Bible a project writes against: its hard pin (project.active_bible_id). A channel
// active-bible fallback covers the 1:1 expand phase and is flagged viaFallback so the caller
// logs it (not a silent cross-niche fallback). Drop the fallback once a project can pin a
// Bible different from its channel's active one (multiple projects per account).
export async function resolveActiveBible(
  db: PostgresJsDatabase,
  projectId: string,
): Promise<ResolvedBible> {
  const [proj] = await db
    .select({ pin: projects.activeBibleId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (proj?.pin) {
    // Require the pinned Bible to still be active: a stale pin (left pointing at a now-
    // deactivated Bible by an un-synced switch during a deploy window) falls through to the
    // active-Bible fallback instead of serving the wrong voice. In 1:1 pin == active, so this
    // is a no-op; revisit when a project can pin a Bible that isn't its channel's active one.
    const [pinned] = await db
      .select()
      .from(poetBible)
      .where(and(eq(poetBible.id, proj.pin), eq(poetBible.isActive, true)))
      .limit(1);
    if (pinned) return { bible: pinned, viaFallback: false };
  }
  const [legacy] = await db
    .select()
    .from(poetBible)
    .where(and(eq(poetBible.channelId, projectId), eq(poetBible.isActive, true)))
    .limit(1);
  return legacy ? { bible: legacy, viaFallback: true } : null;
}
