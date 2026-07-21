import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import {
  templateContentV2Schema,
  type TemplateContentV2,
} from "../../lib/template-content.js";
import { workspaceIdParamsSchema } from "../tasks/tasks.schemas.js";

const templateStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const templateVisibilitySchema = z.enum(["WORKSPACE", "SYSTEM"]);

export const templateIdParamsSchema = workspaceIdParamsSchema.extend({
  templateId: z.string().uuid(),
});

export const listTemplatesQuerySchema = paginationQuerySchema.extend({
  status: templateStatusSchema.optional(),
  visibility: templateVisibilitySchema.optional(),
  search: z.string().trim().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).optional(),
  industryCode: z.string().trim().max(64).optional(),
  visibility: templateVisibilitySchema.default("WORKSPACE"),
  contentJson: templateContentV2Schema.optional(),
});

export const updateTemplateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    industryCode: z.string().trim().max(64).nullable().optional(),
    contentJson: templateContentV2Schema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const cloneTemplateSchema = z.object({
  projectName: z.string().trim().min(2).max(120),
  projectCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  startAt: z.iso.datetime().optional(),
  idempotencyKey: z.string().trim().min(8).max(128),
  memberBindings: z
    .record(z.string(), z.string().uuid())
    .refine((value) => Object.keys(value).length <= 100, "At most 100 bindings are allowed")
    .default({}),
}).strict();

export const cloneJobParamsSchema = workspaceIdParamsSchema.extend({
  cloneJobId: z.string().uuid(),
});

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CloneTemplateInput = z.infer<typeof cloneTemplateSchema>;
export type TemplateContent = TemplateContentV2;
