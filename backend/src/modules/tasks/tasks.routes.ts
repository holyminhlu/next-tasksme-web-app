import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  archiveTask,
  bulkDelete,
  bulkUpdate,
  changeAssignee,
  changeStatus,
  createTask,
  deleteTask,
  getTaskActivity,
  getTask,
  listTasks,
  parseTask,
  restoreTask,
  unarchiveTask,
  updateTask,
} from "./tasks.controller.js";
import {
  assigneeMutationSchema,
  bulkDeleteSchema,
  bulkUpdateSchema,
  createTaskSchema,
  deleteTaskQuerySchema,
  listTasksQuerySchema,
  parseTaskSchema,
  statusMutationSchema,
  taskActivityQuerySchema,
  taskIdParamsSchema,
  updateTaskSchema,
  versionMutationSchema,
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

tasksRouter.post(
  "/bulk-update",
  validateRequest({ params: workspaceIdParamsSchema, body: bulkUpdateSchema }),
  tenantContext,
  requirePermission("tasks:update"),
  bulkUpdate,
);

tasksRouter.post(
  "/bulk-delete",
  validateRequest({ params: workspaceIdParamsSchema, body: bulkDeleteSchema }),
  tenantContext,
  requirePermission("tasks:delete"),
  bulkDelete,
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

tasksRouter.patch(
  "/:taskId/status",
  validateRequest({ params: taskIdParamsSchema, body: statusMutationSchema }),
  tenantContext,
  requirePermission("tasks:update"),
  changeStatus,
);

tasksRouter.patch(
  "/:taskId/assignee",
  validateRequest({ params: taskIdParamsSchema, body: assigneeMutationSchema }),
  tenantContext,
  requirePermission("tasks:assign"),
  changeAssignee,
);

for (const [path, handler] of [
  ["archive", archiveTask],
  ["unarchive", unarchiveTask],
  ["restore", restoreTask],
] as const) {
  tasksRouter.post(
    `/:taskId/${path}`,
    validateRequest({ params: taskIdParamsSchema, body: versionMutationSchema }),
    tenantContext,
    requirePermission("tasks:update"),
    handler,
  );
}

tasksRouter.get(
  "/:taskId/activity",
  validateRequest({
    params: taskIdParamsSchema,
    query: taskActivityQuerySchema,
  }),
  tenantContext,
  requirePermission("activity:read"),
  getTaskActivity,
);

tasksRouter.delete(
  "/:taskId",
  validateRequest({
    params: taskIdParamsSchema,
    query: deleteTaskQuerySchema,
  }),
  tenantContext,
  requirePermission("tasks:delete"),
  deleteTask,
);
