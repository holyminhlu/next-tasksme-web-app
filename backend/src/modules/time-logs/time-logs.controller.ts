import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { actorFromRequest } from "../tasks/task-access.js";
import type {
  CreateManualTimeLogInput,
  ListTimeLogsQuery,
  StartTimerInput,
  StopTimerInput,
  UpdateTimeLogInput,
} from "./time-logs.schemas.js";
import { timeLogsService } from "./time-logs.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listTimeLogs(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await timeLogsService.list(
        param(req, "workspaceId"),
        param(req, "taskId"),
        actorFromRequest(req),
        req.query as unknown as ListTimeLogsQuery,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function getRunningTimer(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await timeLogsService.running(
        param(req, "workspaceId"),
        actorFromRequest(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function startTimer(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await timeLogsService.start(
        param(req, "workspaceId"),
        param(req, "taskId"),
        actorFromRequest(req),
        req.body as StartTimerInput,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function stopTimer(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await timeLogsService.stop(
        param(req, "workspaceId"),
        param(req, "taskId"),
        actorFromRequest(req),
        req.body as StopTimerInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function createManualTimeLog(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await timeLogsService.createManual(
        param(req, "workspaceId"),
        param(req, "taskId"),
        actorFromRequest(req),
        req.body as CreateManualTimeLogInput,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function updateTimeLog(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await timeLogsService.update(
        param(req, "workspaceId"),
        param(req, "taskId"),
        param(req, "timeLogId"),
        actorFromRequest(req),
        req.body as UpdateTimeLogInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function deleteTimeLog(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await timeLogsService.remove(
        param(req, "workspaceId"),
        param(req, "taskId"),
        param(req, "timeLogId"),
        actorFromRequest(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}
