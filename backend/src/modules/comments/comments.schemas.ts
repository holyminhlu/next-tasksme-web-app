import { z } from "zod";

export const workspaceTaskParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const commentParamsSchema = workspaceTaskParamsSchema.extend({
  commentId: z.string().uuid(),
});

export const listCommentsQuerySchema = z.object({
  includeDeleted: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) =>
      value === undefined ? false : value === true || value === "true",
    ),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  parentCommentId: z.string().uuid().nullable().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ListCommentsQuery = Partial<z.infer<typeof listCommentsQuerySchema>>;
