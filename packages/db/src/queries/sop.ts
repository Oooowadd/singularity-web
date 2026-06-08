import { and, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { clerkSops } from "../schema/clerk";
import { projectSops } from "../schema/project";

export type ResolvedSop = { id: string; contentMd: string };

// The SOP a project writes/reads against: its primary-role binding in project_sops,
// falling back to the channel's latest ai_reference SOP (project.id == channel.id during
// the expand phase) so an unbound project still resolves correctly — equivalent behavior
// until projects bind SOPs explicitly.
export async function resolvePrimarySop(
  db: PostgresJsDatabase,
  projectId: string,
): Promise<ResolvedSop | null> {
  const [bound] = await db
    .select({ id: clerkSops.id, contentMd: clerkSops.contentMd })
    .from(projectSops)
    .innerJoin(clerkSops, eq(clerkSops.id, projectSops.sopId))
    .where(and(eq(projectSops.projectId, projectId), eq(projectSops.role, "primary")))
    .orderBy(desc(clerkSops.generatedAt), desc(clerkSops.id))
    .limit(1);
  if (bound) return bound;

  const [legacy] = await db
    .select({ id: clerkSops.id, contentMd: clerkSops.contentMd })
    .from(clerkSops)
    .where(and(eq(clerkSops.channelId, projectId), eq(clerkSops.sopType, "ai_reference")))
    .orderBy(desc(clerkSops.generatedAt), desc(clerkSops.id))
    .limit(1);
  return legacy ?? null;
}
