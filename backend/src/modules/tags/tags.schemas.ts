import { z } from "zod";

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const tagIdParamsSchema = workspaceIdParamsSchema.extend({
  tagId: z.string().uuid(),
});

export const workspaceTaskParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

const colorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "color must be a hex color like #3B82F6");

export const listTagsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: colorSchema.default("#3B82F6"),
});

export const updateTagSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: colorSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.color !== undefined, {
    message: "At least one field is required",
  });

export const setTaskTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()).max(50),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type SetTaskTagsInput = z.infer<typeof setTaskTagsSchema>;
export type ListTagsQuery = z.infer<typeof listTagsQuerySchema>;
