import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { actorFromRequest } from "../tasks/task-access.js";
import {
  businessCalendarsService,
  type BusinessCalendarMutation,
} from "./business-calendars.service.js";

const params = z.object({ workspaceId: z.string().uuid(), calendarId: z.string().uuid().optional() });
const body = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().min(1),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  workingHours: z
    .array(
      z
        .object({
          dayOfWeek: z.number().int().min(0).max(6),
          startMinute: z.number().int().min(0).max(1439),
          endMinute: z.number().int().min(1).max(1440),
        })
        .refine((hours) => hours.endMinute > hours.startMinute),
    )
    .optional(),
  holidays: z
    .array(
      z.object({
        date: z.iso.date(),
        name: z.string().min(1),
        isWorking: z.boolean().optional(),
      }),
    )
    .optional(),
});

const endpoint =
  (action: "list" | "get" | "create" | "update" | "delete") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = String(req.params.workspaceId);
      const id = String(req.params.calendarId ?? "");
      const actor = actorFromRequest(req);
      const data =
        action === "list"
          ? await businessCalendarsService.list(workspaceId)
          : action === "get"
            ? await businessCalendarsService.get(workspaceId, id)
            : action === "create"
              ? await businessCalendarsService.create(
                  workspaceId,
                  actor.userId,
                  req.body as BusinessCalendarMutation,
                )
              : action === "update"
                ? await businessCalendarsService.update(
                    workspaceId,
                    id,
                    req.body as Partial<BusinessCalendarMutation>,
                  )
                : await businessCalendarsService.remove(workspaceId, id);
      sendSuccess(res, data, { statusCode: action === "create" ? 201 : 200 });
    } catch (error) {
      next(error);
    }
  };

export const businessCalendarsRouter = Router({ mergeParams: true });
businessCalendarsRouter.use(authenticate);
businessCalendarsRouter.get(
  "/",
  validateRequest({ params }),
  tenantContext,
  requirePermission("sla.view"),
  endpoint("list"),
);
businessCalendarsRouter.get(
  "/:calendarId",
  validateRequest({ params }),
  tenantContext,
  requirePermission("sla.view"),
  endpoint("get"),
);
businessCalendarsRouter.post(
  "/",
  validateRequest({ params, body }),
  tenantContext,
  requirePermission("sla.configure"),
  endpoint("create"),
);
businessCalendarsRouter.patch(
  "/:calendarId",
  validateRequest({ params, body: body.partial() }),
  tenantContext,
  requirePermission("sla.configure"),
  endpoint("update"),
);
businessCalendarsRouter.delete(
  "/:calendarId",
  validateRequest({ params }),
  tenantContext,
  requirePermission("sla.configure"),
  endpoint("delete"),
);
