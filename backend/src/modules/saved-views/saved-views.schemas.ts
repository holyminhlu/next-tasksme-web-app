import { z } from "zod";
import {
  taskPrioritySchema,
  taskStatusSchema,
} from "../tasks/tasks.schemas.js";

export const savedViewTypeSchema = z.enum([
  "LIST",
  "BOARD",
  "CALENDAR",
  "TIMELINE",
]);

export const savedViewIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  viewId: z.string().uuid(),
});

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

const filtersJsonSchema = z
  .object({
    search: z.string().max(200).optional(),
    projectId: z.string().uuid().nullable().optional(),
    statuses: z.array(taskStatusSchema).max(10).optional(),
    priorities: z.array(taskPrioritySchema).max(10).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    createdById: z.string().uuid().nullable().optional(),
    due: z.enum(["today", "upcoming", "overdue"]).nullable().optional(),
    deadlineFrom: z.string().nullable().optional(),
    deadlineTo: z.string().nullable().optional(),
    overdue: z.boolean().optional(),
    unassigned: z.boolean().optional(),
    includeArchived: z.boolean().optional(),
    includeDeleted: z.boolean().optional(),
  })
  .strict();

const sortJsonSchema = z
  .object({
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
        "rank",
      ])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

const groupByJsonSchema = z
  .object({
    groupBy: z.enum(["project", "assignee", "none"]).optional(),
  })
  .strict();

const columnsJsonSchema = z.array(z.string().min(1).max(64)).max(30);

const displayOptionsJsonSchema = z
  .object({
    view: z.enum(["list", "board", "calendar", "timeline"]).optional(),
    calMode: z.enum(["month", "week"]).optional(),
    tlZoom: z.enum(["day", "week", "month"]).optional(),
    dense: z.boolean().optional(),
  })
  .strict();

export const createSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(80),
  viewType: savedViewTypeSchema.default("LIST"),
  filtersJson: filtersJsonSchema.default({}),
  sortJson: sortJsonSchema.default({}),
  groupByJson: groupByJsonSchema.default({}),
  columnsJson: columnsJsonSchema.default([]),
  displayOptionsJson: displayOptionsJsonSchema.default({}),
  isDefault: z.boolean().optional(),
});

export const updateSavedViewSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    viewType: savedViewTypeSchema.optional(),
    filtersJson: filtersJsonSchema.optional(),
    sortJson: sortJsonSchema.optional(),
    groupByJson: groupByJsonSchema.optional(),
    columnsJson: columnsJsonSchema.optional(),
    displayOptionsJson: displayOptionsJsonSchema.optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;
