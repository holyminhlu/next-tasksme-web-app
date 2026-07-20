import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const listNotificationsQuerySchema = paginationQuerySchema
  .pick({
    page: true,
    pageSize: true,
  })
  .extend({
    unread: booleanQuerySchema.optional(),
  });

export const notificationParamsSchema = z.object({
  workspaceId: z.string().uuid(),
  notificationId: z.string().uuid(),
});

export const updateNotificationPreferenceSchema = z
  .object({
    taskAssigned: z.boolean().optional(),
    taskMentioned: z.boolean().optional(),
    taskUnblocked: z.boolean().optional(),
    recurrenceCreated: z.boolean().optional(),
    recurrenceSkipped: z.boolean().optional(),
    slaWarning: z.boolean().optional(),
    slaBreached: z.boolean().optional(),
    riskEscalated: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one preference is required",
  });

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type UpdateNotificationPreferenceInput = z.infer<
  typeof updateNotificationPreferenceSchema
>;
