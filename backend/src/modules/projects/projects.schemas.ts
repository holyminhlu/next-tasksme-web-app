import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
});

export const listProjectsQuerySchema = z.object({});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
