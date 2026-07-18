import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const taskIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const listTasksQuerySchema = paginationQuerySchema.extend({
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: z
    .union([
      z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
      z.array(z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"])),
    ])
    .optional()
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : undefined)),
  due: z.enum(["today", "upcoming", "overdue"]).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  isBlocked: z.boolean().optional(),
  blockedReason: z.string().trim().max(500).nullable().optional(),
  confirmedFromQuickCapture: z.boolean().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
    dueDate: z.string().datetime().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().trim().max(500).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const parseTaskSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  locale: z.string().trim().min(2).max(16).optional(),
  timezone: z.string().trim().min(2).max(64).optional(),
  referenceDate: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
      { message: "referenceDate must be YYYY-MM-DD or ISO datetime" },
    )
    .optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ParseTaskInput = z.infer<typeof parseTaskSchema>;
