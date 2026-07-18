import { z } from "zod";

export const CUSTOM_FIELD_TYPES = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "USER",
] as const;

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const fieldIdParamsSchema = workspaceIdParamsSchema.extend({
  fieldId: z.string().uuid(),
});

export const workspaceTaskParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

const optionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
});

export const listCustomFieldsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  includeInactive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) =>
      value === undefined ? false : value === true || value === "true",
    ),
});

export const createCustomFieldSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    fieldType: z.enum(CUSTOM_FIELD_TYPES),
    projectId: z.string().uuid().nullable().optional(),
    isRequired: z.boolean().optional().default(false),
    options: z.array(optionSchema).max(50).optional().default([]),
    defaultValue: z.unknown().optional().nullable(),
    position: z.number().int().min(0).max(10_000).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.fieldType === "SELECT" || value.fieldType === "MULTI_SELECT") &&
      value.options.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "SELECT fields require at least one option",
        path: ["options"],
      });
    }
  });

export const updateCustomFieldSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    isRequired: z.boolean().optional(),
    options: z.array(optionSchema).max(50).optional(),
    defaultValue: z.unknown().optional().nullable(),
    position: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const setTaskCustomFieldValuesSchema = z.object({
  values: z
    .array(
      z.object({
        customFieldId: z.string().uuid(),
        value: z.unknown().nullable(),
      }),
    )
    .max(100),
});

export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;
export type SetTaskCustomFieldValuesInput = z.infer<
  typeof setTaskCustomFieldValuesSchema
>;
export type ListCustomFieldsQuery = Partial<
  z.infer<typeof listCustomFieldsQuerySchema>
>;
