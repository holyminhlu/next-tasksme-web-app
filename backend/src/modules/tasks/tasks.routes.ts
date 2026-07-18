import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  parseTask,
  updateTask,
} from "./tasks.controller.js";
import {
  createTaskSchema,
  listTasksQuerySchema,
  parseTaskSchema,
  taskIdParamsSchema,
  updateTaskSchema,
  workspaceIdParamsSchema,
} from "./tasks.schemas.js";

export const tasksRouter = Router({ mergeParams: true });

tasksRouter.use(authenticate);

tasksRouter.get(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: listTasksQuerySchema,
  }),
  tenantContext,
  requirePermission("tasks:read"),
  listTasks,
);

tasksRouter.post(
  "/parse",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: parseTaskSchema,
  }),
  tenantContext,
  requirePermission("tasks:create"),
  parseTask,
);

tasksRouter.post(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: createTaskSchema,
  }),
  tenantContext,
  requirePermission("tasks:create"),
  createTask,
);

tasksRouter.get(
  "/:taskId",
  validateRequest({
    params: taskIdParamsSchema,
  }),
  tenantContext,
  requirePermission("tasks:read"),
  getTask,
);

tasksRouter.patch(
  "/:taskId",
  validateRequest({
    params: taskIdParamsSchema,
    body: updateTaskSchema,
  }),
  tenantContext,
  requirePermission("tasks:update"),
  updateTask,
);

tasksRouter.delete(
  "/:taskId",
  validateRequest({
    params: taskIdParamsSchema,
  }),
  tenantContext,
  requirePermission("tasks:delete"),
  deleteTask,
);
