import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { INVITABLE_ROLE_KEYS } from "../auth/permissions.js";
import { MODULE_PRESET_KEYS } from "./modules.catalog.js";

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const createWorkspaceSchema = z.object({
  type: z.enum(["PERSONAL", "ORGANIZATION"]),
  name: z.string().trim().min(2).max(120).optional(),
  usagePurpose: z.string().trim().min(2).max(200).optional(),
  industryCode: z.string().trim().min(2).max(50).optional(),
  companySize: z.string().trim().min(1).max(50).optional(),
  timezone: z.string().trim().min(2).max(64).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  logoUrl: z.string().url().max(500).optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    type: z.enum(["PERSONAL", "ORGANIZATION"]).optional(),
    usagePurpose: z.string().trim().min(2).max(200).nullable().optional(),
    industryCode: z.string().trim().min(2).max(50).nullable().optional(),
    companySize: z.string().trim().min(1).max(50).nullable().optional(),
    timezone: z.string().trim().min(2).max(64).optional(),
    locale: z.string().trim().min(2).max(16).optional(),
    logoUrl: z.string().url().max(500).nullable().optional(),
    dependencyCompletionPolicy: z
      .enum(["WARN_ONLY", "BLOCK", "BLOCK_WITH_OVERRIDE"])
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const listMembersQuerySchema = paginationQuerySchema;

export const inviteMemberSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  roleKey: z.enum(INVITABLE_ROLE_KEYS as unknown as [string, ...string[]]),
});

export const invitationIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

export const memberIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const updateMemberRoleSchema = z.object({
  roleKey: z.enum(INVITABLE_ROLE_KEYS as unknown as [string, ...string[]]),
});

export const transferOwnershipSchema = z.object({
  memberId: z.string().uuid(),
});

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1),
    fullName: z.string().trim().min(2).max(120).optional(),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Za-z]/, "Password must include a letter")
      .regex(/[0-9]/, "Password must include a number")
      .optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.password ||
      !data.confirmPassword ||
      data.password === data.confirmPassword,
    {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    },
  )
  .transform(({ confirmPassword: _confirmPassword, ...data }) => data);

export const updateOnboardingSchema = z
  .object({
    currentStep: z.string().trim().min(1).max(64).optional(),
    completedSteps: z.array(z.string().trim().min(1).max(64)).optional(),
    markStepCompleted: z.string().trim().min(1).max(64).optional(),
    workspace: z
      .object({
        name: z.string().trim().min(2).max(120).optional(),
        usagePurpose: z.string().trim().min(2).max(200).nullable().optional(),
        industryCode: z.string().trim().min(2).max(50).nullable().optional(),
        companySize: z.string().trim().min(1).max(50).nullable().optional(),
        timezone: z.string().trim().min(2).max(64).optional(),
        locale: z.string().trim().min(2).max(16).optional(),
        logoUrl: z.string().url().max(500).nullable().optional(),
      })
      .optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.currentStep ||
          data.completedSteps ||
          data.markStepCompleted ||
          data.workspace,
      ),
    { message: "At least one onboarding field is required" },
  );

export const applyModulePresetSchema = z.object({
  presetKey: z.enum(MODULE_PRESET_KEYS as unknown as [string, ...string[]]),
});

export const updateModulesSchema = z.object({
  modules: z
    .array(
      z.object({
        moduleKey: z.string().trim().min(1).max(64),
        enabled: z.boolean(),
      }),
    )
    .min(1),
});

export const createFirstProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(1000).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        dueDate: z.string().datetime().optional(),
      }),
    )
    .max(20)
    .optional(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type UpdateOnboardingInput = z.infer<typeof updateOnboardingSchema>;
export type ApplyModulePresetInput = z.infer<typeof applyModulePresetSchema>;
export type UpdateModulesInput = z.infer<typeof updateModulesSchema>;
export type CreateFirstProjectInput = z.infer<typeof createFirstProjectSchema>;
