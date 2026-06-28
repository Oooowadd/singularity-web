import { z } from "zod";

export const createProjectInput = z.object({
  accountSlug: z.string().min(1),
  name: z.string().min(1, "Required").max(80),
  description: z.string().max(500).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectInput>;

export const updateProjectInput = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullish(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectInput>;
