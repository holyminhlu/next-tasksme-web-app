import { z } from "zod";

export const workspaceTaskParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const attachmentParamsSchema = workspaceTaskParamsSchema.extend({
  attachmentId: z.string().uuid(),
});
