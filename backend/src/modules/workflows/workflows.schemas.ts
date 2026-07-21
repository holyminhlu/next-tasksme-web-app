import { z } from "zod";
import { workflowConditionsSchema } from "../../lib/workflow-conditions.js";
import { workspaceIdParamsSchema } from "../tasks/tasks.schemas.js";

const workflowStageCategorySchema = z.enum([
  "BACKLOG",
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
]);

export const workflowIdParamsSchema = workspaceIdParamsSchema.extend({
  workflowId: z.string().uuid(),
});

export const workflowStageParamsSchema = workflowIdParamsSchema.extend({
  stageId: z.string().uuid(),
});

export const projectWorkflowParamsSchema = workspaceIdParamsSchema.extend({
  projectId: z.string().uuid(),
});

export const createWorkflowStageSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: workflowStageCategorySchema,
  color: z.string().trim().max(32).optional(),
  isInitial: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
});

export const updateWorkflowStageSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    category: workflowStageCategorySchema.optional(),
    color: z.string().trim().max(32).nullable().optional(),
    isInitial: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const deleteWorkflowStageQuerySchema = z.object({
  moveToStageId: z.string().uuid().optional(),
});

export const reorderWorkflowStagesSchema = z.object({
  stageIds: z.array(z.string().uuid()).min(1).max(50),
});

export const upsertWorkflowTransitionsSchema = z.object({
  transitions: z
    .array(
      z.object({
        fromStageId: z.string().uuid(),
        toStageId: z.string().uuid(),
        requiredPermission: z.string().trim().max(120).nullable().optional(),
        conditionsJson: workflowConditionsSchema.optional(),
      }).strict(),
    )
    .max(500),
});

export type CreateWorkflowStageInput = z.infer<typeof createWorkflowStageSchema>;
export type UpdateWorkflowStageInput = z.infer<typeof updateWorkflowStageSchema>;
export type DeleteWorkflowStageInput = z.infer<typeof deleteWorkflowStageQuerySchema>;
export type ReorderWorkflowStagesInput = z.infer<typeof reorderWorkflowStagesSchema>;
export type UpsertWorkflowTransitionsInput = z.infer<typeof upsertWorkflowTransitionsSchema>;
