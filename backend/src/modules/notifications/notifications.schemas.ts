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

export const updateNotificationPreferenceSchema = z.object({
  taskAssigned: z.boolean(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type UpdateNotificationPreferenceInput = z.infer<
  typeof updateNotificationPreferenceSchema
>;
