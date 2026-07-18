import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createManualTimeLog,
  deleteTimeLog,
  getRunningTimer,
  listTimeLogs,
  startTimer,
  stopTimer,
  updateTimeLog,
} from "./time-logs.controller.js";
import {
  createManualTimeLogSchema,
  listTimeLogsQuerySchema,
  startTimerSchema,
  stopTimerSchema,
  timeLogParamsSchema,
  timeLogTaskParamsSchema,
  updateTimeLogSchema,
  workspaceTimerParamsSchema,
} from "./time-logs.schemas.js";

export const taskTimeLogsRouter = Router({ mergeParams: true });
export const workspaceTimerRouter = Router({ mergeParams: true });

taskTimeLogsRouter.use(authenticate);
workspaceTimerRouter.use(authenticate);

taskTimeLogsRouter.get(
  "/",
  validateRequest({
    params: timeLogTaskParamsSchema,
    query: listTimeLogsQuerySchema,
  }),
  tenantContext,
  requirePermission("time_log.view_own"),
  listTimeLogs,
);

taskTimeLogsRouter.post(
  "/",
  validateRequest({
    params: timeLogTaskParamsSchema,
    body: createManualTimeLogSchema,
  }),
  tenantContext,
  requirePermission("time_log.create"),
  createManualTimeLog,
);

taskTimeLogsRouter.post(
  "/timer/start",
  validateRequest({
    params: timeLogTaskParamsSchema,
    body: startTimerSchema,
  }),
  tenantContext,
  requirePermission("time_log.create"),
  startTimer,
);

taskTimeLogsRouter.post(
  "/timer/stop",
  validateRequest({
    params: timeLogTaskParamsSchema,
    body: stopTimerSchema,
  }),
  tenantContext,
  requirePermission("time_log.create"),
  stopTimer,
);

taskTimeLogsRouter.patch(
  "/:timeLogId",
  validateRequest({
    params: timeLogParamsSchema,
    body: updateTimeLogSchema,
  }),
  tenantContext,
  requirePermission("time_log.update_own"),
  updateTimeLog,
);

taskTimeLogsRouter.delete(
  "/:timeLogId",
  validateRequest({ params: timeLogParamsSchema }),
  tenantContext,
  requirePermission("time_log.delete_own"),
  deleteTimeLog,
);

workspaceTimerRouter.get(
  "/running",
  validateRequest({ params: workspaceTimerParamsSchema }),
  tenantContext,
  requirePermission("time_log.view_own"),
  getRunningTimer,
);
