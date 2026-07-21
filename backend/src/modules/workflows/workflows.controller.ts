import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  CreateWorkflowStageInput,
  DeleteWorkflowStageInput,
  ReorderWorkflowStagesInput,
  UpdateWorkflowStageInput,
  UpsertWorkflowTransitionsInput,
} from "./workflows.schemas.js";
import { workflowsService } from "./workflows.service.js";

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value;
}

function actor(req: Request) {
  if (!req.user || !req.tenant) throw new UnauthorizedError();
  return {
    userId: req.user.id,
    roleKey: req.tenant.roleKey,
    permissions: req.tenant.permissions,
  };
}

export async function getProjectWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) throw new ForbiddenError("Tenant context is required");
    sendSuccess(
      res,
      await workflowsService.getProjectWorkflowState(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function createWorkflowDraft(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await workflowsService.createDraftFromPublished(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function getWorkflowPublishPreview(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await workflowsService.getPublishPreview(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "workflowId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function getWorkflowDraft(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await workflowsService.getDraft(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "workflowId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function addWorkflowStage(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await workflowsService.addStage(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "workflowId"),
        actor(req),
        req.body as CreateWorkflowStageInput,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function updateWorkflowStage(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await workflowsService.updateStage(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "workflowId"),
        getParam(req, "stageId"),
        actor(req),
        req.body as UpdateWorkflowStageInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function deleteWorkflowStage(req: Request, res: Response, next: NextFunction) {
  try {
    await workflowsService.deleteStage(
      getParam(req, "workspaceId"),
      getParam(req, "projectId"),
      getParam(req, "workflowId"),
      getParam(req, "stageId"),
      actor(req),
      req.query as DeleteWorkflowStageInput,
    );
    sendSuccess(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function reorderWorkflowStages(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await workflowsService.reorderStages(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "workflowId"),
        actor(req),
        req.body as ReorderWorkflowStagesInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function upsertWorkflowTransitions(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await workflowsService.upsertTransitions(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "workflowId"),
        actor(req),
        req.body as UpsertWorkflowTransitionsInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function validateWorkflowDraft(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await workflowsService.validateDraft(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "workflowId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}
