import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  visibility: z.enum(["WORKSPACE", "PRIVATE"]).default("WORKSPACE"),
  memberIds: z.array(z.string().uuid()).max(200).default([]),
});

export const listProjectsQuerySchema = z.object({});

export const projectParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const replaceProjectMembersSchema = z.object({
  memberIds: z.array(z.string().uuid()).max(200),
});

export const updateProjectVisibilitySchema = z.object({
  visibility: z.enum(["WORKSPACE", "PRIVATE"]),
});

export const eligibleAssigneesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ReplaceProjectMembersInput = z.infer<typeof replaceProjectMembersSchema>;
export type UpdateProjectVisibilityInput = z.infer<typeof updateProjectVisibilitySchema>;
export type EligibleAssigneesQuery = z.infer<typeof eligibleAssigneesQuerySchema>;
