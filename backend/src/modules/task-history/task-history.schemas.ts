import { z } from "zod";

export const taskHistoryParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});
