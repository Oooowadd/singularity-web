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
    const [pinned] = await db.select().from(poetBible).where(eq(poetBible.id, proj.pin)).limit(1);
    if (pinned) return { bible: pinned, viaFallback: false };
  }
  const [legacy] = await db
    .select()
    .from(poetBible)
    .where(and(eq(poetBible.channelId, projectId), eq(poetBible.isActive, true)))
    .limit(1);
  return legacy ? { bible: legacy, viaFallback: true } : null;
}
