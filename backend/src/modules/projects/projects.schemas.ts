import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

const projectStatusSchema = z.enum([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
]);

const projectRoleSchema = z.enum([
  "PROJECT_OWNER",
  "PROJECT_MANAGER",
  "PROJECT_MEMBER",
  "PROJECT_VIEWER",
]);

const projectPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const legacyTaskStatusSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BLOCKED",
  "DONE",
  "CANCELLED",
]);

const completionPolicySchema = z.enum(["WARN_ONLY", "BLOCK", "BLOCK_WITH_OVERRIDE"]);

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    description: z.string().trim().max(5000).optional(),
    status: projectStatusSchema.default("ACTIVE"),
    priority: projectPrioritySchema.default("MEDIUM"),
    visibility: z.enum(["WORKSPACE", "PRIVATE"]).optional(),
    managerId: z.string().uuid().optional(),
    startAt: z.iso.datetime().optional(),
    endAt: z.iso.datetime().optional(),
    completionPolicy: completionPolicySchema.default("WARN_ONLY"),
    memberIds: z.array(z.string().uuid()).max(200).default([]),
    members: z
      .array(
        z.object({
          userId: z.string().uuid(),
          projectRole: projectRoleSchema.default("PROJECT_MEMBER"),
        }),
      )
      .max(200)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startAt && value.endAt && new Date(value.startAt) > new Date(value.endAt)) {
      ctx.addIssue({
        code: "custom",
        message: "End date must be on or after start date",
        path: ["endAt"],
      });
    }
  });

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    code: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/)
      .nullable()
      .optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: projectStatusSchema.optional(),
    priority: projectPrioritySchema.optional(),
    visibility: z.enum(["WORKSPACE", "PRIVATE"]).optional(),
    managerId: z.string().uuid().nullable().optional(),
    startAt: z.iso.datetime().nullable().optional(),
    endAt: z.iso.datetime().nullable().optional(),
    completionPolicy: completionPolicySchema.optional(),
    completionOverrideReason: z.string().trim().min(3).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.startAt !== undefined &&
      value.endAt !== undefined &&
      value.startAt &&
      value.endAt &&
      new Date(value.startAt) > new Date(value.endAt)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "End date must be on or after start date",
        path: ["endAt"],
      });
    }
  });

export const listProjectsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z
    .union([projectStatusSchema, z.array(projectStatusSchema)])
    .optional()
    .transform((value) => (Array.isArray(value) ? value : value ? [value] : undefined)),
  managerId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  startFrom: z.iso.datetime().optional(),
  startTo: z.iso.datetime().optional(),
  endFrom: z.iso.datetime().optional(),
  endTo: z.iso.datetime().optional(),
  sortBy: z
    .enum(["name", "status", "startAt", "endAt", "updatedAt", "priority"])
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeArchived: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().optional(),
  deletedOnly: z.coerce.boolean().optional(),
  archivedOnly: z.coerce.boolean().optional(),
});

export const projectParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const replaceProjectMembersSchema = z
  .object({
    members: z
      .array(
        z.object({
          userId: z.string().uuid(),
          projectRole: projectRoleSchema,
        }),
      )
      .max(200)
      .optional(),
    memberIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .refine((value) => (value.members?.length ?? 0) > 0 || (value.memberIds?.length ?? 0) > 0, {
    message: "At least one member is required",
  });

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  projectRole: projectRoleSchema.default("PROJECT_MEMBER"),
});

export const updateProjectMemberSchema = z.object({
  projectRole: projectRoleSchema,
});

export const updateProjectVisibilitySchema = z.object({
  visibility: z.enum(["WORKSPACE", "PRIVATE"]),
});

export const eligibleAssigneesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export const projectMemberParamsSchema = projectParamsSchema.extend({
  memberUserId: z.string().uuid(),
});

export const publishProjectWorkflowSchema = z
  .object({
    draftWorkflowId: z.string().uuid(),
    stageMappings: z
      .array(
        z.object({
          fromStageId: z.string().uuid(),
          toStageId: z.string().uuid(),
        }),
      )
      .max(500)
      .optional()
      .default([]),
    legacyStatusMappings: z
      .array(
        z.object({
          fromStatus: legacyTaskStatusSchema,
          toStageId: z.string().uuid(),
        }),
      )
      .max(50)
      .optional()
      .default([]),
  })
  .superRefine((value, ctx) => {
    const sourceIds = new Set<string>();
    value.stageMappings.forEach((mapping, index) => {
      if (sourceIds.has(mapping.fromStageId)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate source stage mapping",
          path: ["stageMappings", index, "fromStageId"],
        });
      }
      sourceIds.add(mapping.fromStageId);
    });
    const statuses = new Set<string>();
    value.legacyStatusMappings.forEach((mapping, index) => {
      if (statuses.has(mapping.fromStatus)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate legacy status mapping",
          path: ["legacyStatusMappings", index, "fromStatus"],
        });
      }
      statuses.add(mapping.fromStatus);
    });
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type ReplaceProjectMembersInput = z.infer<typeof replaceProjectMembersSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>;
export type UpdateProjectVisibilityInput = z.infer<typeof updateProjectVisibilitySchema>;
export type EligibleAssigneesQuery = z.infer<typeof eligibleAssigneesQuerySchema>;
export type PublishProjectWorkflowInput = z.infer<typeof publishProjectWorkflowSchema>;
