import { z } from "zod";

export const milestoneStatusSchema = z.enum([
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const milestoneParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid(),
});

export const projectMilestonesParamsSchema = milestoneParamsSchema.omit({
  milestoneId: true,
});

const milestoneDatesValid = (data: {
  startAt?: string | null;
  dueAt?: string | null;
}) => !data.startAt || !data.dueAt || new Date(data.dueAt) >= new Date(data.startAt);

export const createMilestoneSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).optional(),
    status: milestoneStatusSchema.optional(),
    position: z.number().int().min(0).optional(),
    startAt: z.string().datetime().nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .refine(milestoneDatesValid, {
    message: "dueAt must be greater than or equal to startAt",
    path: ["dueAt"],
  });

export const updateMilestoneSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    status: milestoneStatusSchema.optional(),
    position: z.number().int().min(0).optional(),
    startAt: z.string().datetime().nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })
  .refine(milestoneDatesValid, {
    message: "dueAt must be greater than or equal to startAt",
    path: ["dueAt"],
  });

export const reorderMilestonesSchema = z.object({
  milestoneIds: z.array(z.string().uuid()).min(1).max(500).refine(
    (ids) => new Set(ids).size === ids.length,
    "milestoneIds must be unique",
  ),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
export type ReorderMilestonesInput = z.infer<typeof reorderMilestonesSchema>;
