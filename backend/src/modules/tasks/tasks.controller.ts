import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  AssigneeMutationInput,
  BoardTasksQuery,
  BulkDeleteInput,
  BulkUpdateInput,
  CalendarTasksQuery,
  CreateTaskInput,
  ExportTasksInput,
  ListTasksQuery,
  MoveTaskInput,
  ParseTaskInput,
  StatusMutationInput,
  TaskActivityQuery,
  TimelineTasksQuery,
  UpdateTaskInput,
  VersionMutationInput,
} from "./tasks.schemas.js";
import { tasksService } from "./tasks.service.js";

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

function requireActor(req: Request) {
  if (!req.user || !req.tenant) {
    throw new ForbiddenError("Tenant context is required");
  }
  return {
    userId: req.user.id,
    roleKey: req.tenant.roleKey,
    permissions: req.tenant.permissions,
  };
}

export async function listTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const result = await tasksService.listTasks(
      getParam(req, "workspaceId"),
      actor,
      req.query as unknown as ListTasksQuery,
    );
    sendSuccess(res, result.items, {
      meta: { pagination: result.pagination },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const task = await tasksService.getTask(
      getParam(req, "workspaceId"),
      getParam(req, "taskId"),
      actor,
    );
    sendSuccess(res, task);
  } catch (error) {
    next(error);
  }
}

export async function createTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    const actor = requireActor(req);
    const task = await tasksService.createTask(
      getParam(req, "workspaceId"),
      actor,
      req.body as CreateTaskInput,
    );
    sendSuccess(res, task, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function updateTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const task = await tasksService.updateTask(
      getParam(req, "workspaceId"),
      getParam(req, "taskId"),
      actor,
      req.body as UpdateTaskInput,
    );
    sendSuccess(res, task);
  } catch (error) {
    next(error);
  }
}

export async function deleteTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const result = await tasksService.deleteTask(
      getParam(req, "workspaceId"),
      getParam(req, "taskId"),
      actor,
      Number(req.query.version),
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await tasksService.changeStatus(
        getParam(req, "workspaceId"),
        getParam(req, "taskId"),
        requireActor(req),
        req.body as StatusMutationInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function changeAssignee(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await tasksService.changeAssignee(
        getParam(req, "workspaceId"),
        getParam(req, "taskId"),
        requireActor(req),
        req.body as AssigneeMutationInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

function lifecycleHandler(method: "archiveTask" | "unarchiveTask" | "restoreTask") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(
        res,
        await tasksService[method](
          getParam(req, "workspaceId"),
          getParam(req, "taskId"),
          requireActor(req),
          req.body as VersionMutationInput,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}

export const archiveTask = lifecycleHandler("archiveTask");
export const unarchiveTask = lifecycleHandler("unarchiveTask");
export const restoreTask = lifecycleHandler("restoreTask");

export async function getTaskActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await tasksService.getTaskActivity(
      getParam(req, "workspaceId"),
      getParam(req, "taskId"),
      requireActor(req),
      req.query as unknown as TaskActivityQuery,
    );
    sendSuccess(res, result.items, { meta: { pagination: result.pagination } });
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await tasksService.bulkUpdate(
        getParam(req, "workspaceId"),
        requireActor(req),
        req.body as BulkUpdateInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function bulkDelete(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await tasksService.bulkDelete(
        getParam(req, "workspaceId"),
        requireActor(req),
        req.body as BulkDeleteInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function parseTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireActor(req);
    const result = await tasksService.parseTask(
      getParam(req, "workspaceId"),
      actor,
      req.body as ParseTaskInput,
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function listBoardColumn(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await tasksService.listBoardColumn(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.query as unknown as BoardTasksQuery,
    );
    sendSuccess(res, result.items, {
      meta: { pagination: result.pagination },
    });
  } catch (error) {
    next(error);
  }
}

export async function listCalendar(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await tasksService.listCalendar(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.query as unknown as CalendarTasksQuery,
    );
    sendSuccess(res, result.items, {
      meta: {
        pagination: result.pagination,
        unscheduledCount: result.unscheduledCount,
        timezone: result.timezone,
        from: result.from,
        to: result.to,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listTimeline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await tasksService.listTimeline(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.query as unknown as TimelineTasksQuery,
    );
    sendSuccess(res, result.groups, {
      meta: {
        pagination: result.pagination,
        timezone: result.timezone,
        from: result.from,
        to: result.to,
        groupBy: result.groupBy,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function moveTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    sendSuccess(
      res,
      await tasksService.moveTask(
        getParam(req, "workspaceId"),
        getParam(req, "taskId"),
        requireActor(req),
        req.body as MoveTaskInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function exportTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await tasksService.exportTasks(
      getParam(req, "workspaceId"),
      requireActor(req),
      req.body as ExportTasksInput,
      {
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
        requestId: req.requestId,
      },
    );
    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader("X-Export-Row-Count", String(result.rowCount));
    res.status(200).send(result.body);
  } catch (error) {
    next(error);
  }
}
