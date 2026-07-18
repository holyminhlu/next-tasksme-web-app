import { z } from "zod";

export const workspaceTaskParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const checklistItemParamsSchema = workspaceTaskParamsSchema.extend({
  itemId: z.string().uuid(),
});

export const createChecklistItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
});

export const updateChecklistItemSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine((value) => value.title !== undefined || value.isCompleted !== undefined, {
    message: "At least one field is required",
  });

export const reorderChecklistSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type ReorderChecklistInput = z.infer<typeof reorderChecklistSchema>;
