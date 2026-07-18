import { z } from "zod";

export const dependencyTaskParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const dependencyParamsSchema = dependencyTaskParamsSchema.extend({
  dependencyId: z.string().uuid(),
});

export const createDependencySchema = z.object({
  relatedTaskId: z.string().uuid(),
  direction: z.enum(["WAITING_ON", "BLOCKING"]),
  dependencyType: z.literal("FINISH_TO_START").default("FINISH_TO_START"),
});

export type CreateDependencyInput = z.infer<typeof createDependencySchema>;
