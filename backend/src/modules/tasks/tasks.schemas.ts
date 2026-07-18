import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const taskStatusSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BLOCKED",
  "DONE",
  "CANCELLED",
]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

function multiValue<T extends z.ZodTypeAny>(schema: T) {
  return z
    .union([schema, z.array(schema)])
    .optional()
    .transform((value) =>
      Array.isArray(value) ? value : value === undefined ? undefined : [value],
    );
}

const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const taskIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const listTasksQuerySchema = paginationQuerySchema
  .extend({
    projectId: multiValue(z.string().uuid()),
    assigneeId: z.string().uuid().optional(),
    createdById: z.string().uuid().optional(),
    creatorId: z.string().uuid().optional(),
    status: multiValue(taskStatusSchema),
    priority: multiValue(taskPrioritySchema),
    due: z.enum(["today", "upcoming", "overdue"]).optional(),
    deadlineFrom: z.string().datetime().optional(),
    deadlineTo: z.string().datetime().optional(),
    overdue: booleanQuerySchema.optional(),
    unassigned: booleanQuerySchema.optional(),
    includeArchived: booleanQuerySchema.optional(),
    includeDeleted: booleanQuerySchema.optional(),
    /** @deprecated Prefer includeArchived — when true, means "include archived". */
    archived: booleanQuerySchema.optional(),
    /** @deprecated Prefer includeDeleted — when true, means "include deleted". */
    deleted: booleanQuerySchema.optional(),
    timezone: z.string().min(1).max(64).optional(),
    sortBy: z
      .enum([
        "taskNumber",
        "title",
        "status",
        "priority",
        "startAt",
        "dueDate",
        "createdAt",
        "updatedAt",
      ])
      .default("createdAt"),
  })
  .transform((query) => ({
    ...query,
    createdById: query.createdById ?? query.creatorId,
    includeArchived: query.includeArchived ?? query.archived ?? false,
    includeDeleted: query.includeDeleted ?? query.deleted ?? false,
  }));

const taskDatesValid = (data: { startAt?: string | null; dueDate?: string | null }) =>
  !data.startAt || !data.dueDate || new Date(data.dueDate) >= new Date(data.startAt);

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
    startAt: z.string().datetime().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().trim().max(500).nullable().optional(),
    confirmedFromQuickCapture: z.boolean().optional(),
  })
  .refine(taskDatesValid, {
    message: "dueDate must be greater than or equal to startAt",
    path: ["dueDate"],
  });

export const updateTaskSchema = z
  .object({
    version: z.number().int().min(1),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
    startAt: z.string().datetime().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z.string().trim().max(500).nullable().optional(),
  })
  .refine((data) => Object.keys(data).some((key) => key !== "version"), {
    message: "At least one field is required",
  })
  .refine(taskDatesValid, {
    message: "dueDate must be greater than or equal to startAt",
    path: ["dueDate"],
  });

export const versionMutationSchema = z.object({
  version: z.number().int().min(1),
});

export const statusMutationSchema = versionMutationSchema.extend({
  status: taskStatusSchema,
});

export const assigneeMutationSchema = versionMutationSchema.extend({
  assigneeId: z.string().uuid().nullable(),
});

export const deleteTaskQuerySchema = z.object({
  version: z.coerce.number().int().min(1),
});

export const taskActivityQuerySchema = paginationQuerySchema.pick({
  page: true,
  pageSize: true,
});

const bulkItemSchema = z.object({
  taskId: z.string().uuid(),
  version: z.number().int().min(1),
});

export const bulkUpdateSchema = z.object({
  items: z
    .array(
      bulkItemSchema.extend({
        changes: z
          .object({
            status: taskStatusSchema.optional(),
            priority: taskPrioritySchema.optional(),
            assigneeId: z.string().uuid().nullable().optional(),
            projectId: z.string().uuid().nullable().optional(),
            archived: z.boolean().optional(),
          })
          .refine((value) => Object.keys(value).length > 0, "Changes are required"),
      }),
    )
    .min(1)
    .max(100),
});

export const bulkDeleteSchema = z.object({
  items: z.array(bulkItemSchema).min(1).max(100),
});

export const parseTaskSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  locale: z.string().trim().min(2).max(16).optional(),
  timezone: z.string().trim().min(2).max(64).optional(),
  referenceDate: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
      { message: "referenceDate must be YYYY-MM-DD or ISO datetime" },
    )
    .optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ParseTaskInput = z.infer<typeof parseTaskSchema>;
export type VersionMutationInput = z.infer<typeof versionMutationSchema>;
export type StatusMutationInput = z.infer<typeof statusMutationSchema>;
export type AssigneeMutationInput = z.infer<typeof assigneeMutationSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type TaskActivityQuery = z.infer<typeof taskActivityQuerySchema>;
