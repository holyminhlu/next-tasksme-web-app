import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";
import { isValidIanaTimeZone } from "../../lib/timezone.js";

export const dashboardQuerySchema = z.object({
  from: z.string().trim().min(1).max(40).optional(),
  to: z.string().trim().min(1).max(40).optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidIanaTimeZone, { message: "Invalid IANA timezone" })
    .optional(),
  projectId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  status: z
    .union([
      z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
      z.array(z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"])),
    ])
    .optional()
    .transform((value) =>
      Array.isArray(value) ? value : value ? [value] : undefined,
    ),
});

export const myWorkQuerySchema = dashboardQuerySchema.extend({
  tab: z
    .enum(["today", "upcoming", "overdue", "in-progress", "completed"])
    .default("today"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const activityQuerySchema = paginationQuerySchema.extend({
  projectId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type MyWorkQuery = z.infer<typeof myWorkQuerySchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
