import { z } from "zod";

export const timeLogTaskParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const timeLogParamsSchema = timeLogTaskParamsSchema.extend({
  timeLogId: z.string().uuid(),
});

export const workspaceTimerParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const listTimeLogsQuerySchema = z.object({
  scope: z.enum(["mine", "team"]).default("mine"),
});

export const createManualTimeLogSchema = z
  .object({
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => new Date(value.endedAt) >= new Date(value.startedAt), {
    message: "endedAt must be on or after startedAt",
    path: ["endedAt"],
  });

export const updateTimeLogSchema = z
  .object({
    startedAt: z.string().datetime().optional(),
    endedAt: z.string().datetime().optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const startTimerSchema = z.object({
  description: z.string().trim().max(500).nullable().optional(),
});

export const stopTimerSchema = z.object({
  description: z.string().trim().max(500).nullable().optional(),
});

export type CreateManualTimeLogInput = z.infer<
  typeof createManualTimeLogSchema
>;
export type UpdateTimeLogInput = z.infer<typeof updateTimeLogSchema>;
export type ListTimeLogsQuery = z.infer<typeof listTimeLogsQuerySchema>;
export type StartTimerInput = z.infer<typeof startTimerSchema>;
export type StopTimerInput = z.infer<typeof stopTimerSchema>;
