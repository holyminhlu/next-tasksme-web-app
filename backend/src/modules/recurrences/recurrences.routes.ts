import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../lib/response.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import { actorFromRequest } from "../tasks/task-access.js";
import { recurrencesService, type RecurrenceInput } from "./recurrences.service.js";

const params = z.object({ workspaceId: z.string().uuid(), taskId: z.string().uuid() });
const body = z
  .object({
    frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
    interval: z.number().int().min(1).max(365).default(1),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    timezone: z.string().min(1),
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime().nullable().optional(),
    overlapPolicy: z
      .enum(["CREATE_ANYWAY", "SKIP_IF_OPEN", "CREATE_AND_NOTIFY"])
      .default("SKIP_IF_OPEN"),
  })
  .superRefine((value, context) => {
    if (value.frequency === "WEEKLY" && value.daysOfWeek.length === 0) {
      context.addIssue({ code: "custom", path: ["daysOfWeek"], message: "daysOfWeek is required" });
    }
    if (value.frequency === "MONTHLY" && !value.dayOfMonth) {
      context.addIssue({ code: "custom", path: ["dayOfMonth"], message: "dayOfMonth is required" });
    }
  });
const previewBody = body.extend({ count: z.number().int().min(1).max(100).default(10) });

const endpoint =
  (action: "get" | "upsert" | "delete" | "pause" | "resume" | "preview") =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = String(req.params.workspaceId);
      const taskId = String(req.params.taskId);
      const actor = actorFromRequest(req);
      let data: unknown;
      if (action === "get") data = await recurrencesService.get(workspaceId, taskId, actor);
      else if (action === "upsert")
        data = await recurrencesService.upsert(
          workspaceId,
          taskId,
          actor,
          req.body as RecurrenceInput,
        );
      else if (action === "delete")
        data = await recurrencesService.remove(workspaceId, taskId, actor);
      else if (action === "pause")
        data = await recurrencesService.pause(workspaceId, taskId, actor);
      else if (action === "resume")
        data = await recurrencesService.resume(workspaceId, taskId, actor);
      else {
        const { count, ...schedule } = req.body as RecurrenceInput & { count: number };
        data = await recurrencesService.preview(schedule, count);
      }
      sendSuccess(res, data, { statusCode: action === "upsert" ? 201 : 200 });
    } catch (error) {
      next(error);
    }
  };

export const recurrencesRouter = Router({ mergeParams: true });
recurrencesRouter.use(authenticate);
recurrencesRouter.get(
  "/",
  validateRequest({ params }),
  tenantContext,
  requirePermission("recurrence.view"),
  endpoint("get"),
);
for (const method of ["post", "put"] as const) {
  recurrencesRouter[method](
    "/",
    validateRequest({ params, body }),
    tenantContext,
    requirePermission("recurrence.manage"),
    endpoint("upsert"),
  );
}
recurrencesRouter.delete(
  "/",
  validateRequest({ params }),
  tenantContext,
  requirePermission("recurrence.manage"),
  endpoint("delete"),
);
recurrencesRouter.post(
  "/preview",
  validateRequest({ params, body: previewBody }),
  tenantContext,
  requirePermission("recurrence.view"),
  endpoint("preview"),
);
for (const action of ["pause", "resume"] as const) {
  recurrencesRouter.post(
    `/${action}`,
    validateRequest({ params }),
    tenantContext,
    requirePermission("recurrence.manage"),
    endpoint(action),
  );
}
