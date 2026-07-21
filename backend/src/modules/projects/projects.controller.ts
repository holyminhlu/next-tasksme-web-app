import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  EligibleAssigneesQuery,
  ListProjectsQuery,
  ReplaceProjectMembersInput,
  PublishProjectWorkflowInput,
  UpdateProjectInput,
  UpdateProjectMemberInput,
  UpdateProjectVisibilityInput,
} from "./projects.schemas.js";
import { projectsService } from "./projects.service.js";

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value;
}

function actor(req: Request) {
  if (!req.user || !req.tenant) throw new UnauthorizedError();
  return { userId: req.user.id, roleKey: req.tenant.roleKey };
}

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant || !req.user) throw new ForbiddenError("Tenant context is required");
    const result = await projectsService.listProjects(
      getParam(req, "workspaceId"),
      actor(req),
      req.query as unknown as ListProjectsQuery,
    );
    sendSuccess(res, result.items, { meta: { pagination: result.pagination } });
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const current = actor(req);
    const project = await projectsService.createProject(
      getParam(req, "workspaceId"),
      current.userId,
      current,
      req.body as CreateProjectInput,
    );
    sendSuccess(res, project, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.getProject(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.updateProject(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.body as UpdateProjectInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function archiveProject(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.lifecycle(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        "archive",
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function unarchiveProject(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.lifecycle(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        "unarchive",
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.lifecycle(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        "delete",
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function restoreProject(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.lifecycle(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        "restore",
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function listProjectMembers(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.listMembers(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function addProjectMember(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.addMember(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.body as AddProjectMemberInput,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function updateProjectMember(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.updateMemberRole(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "memberUserId"),
        actor(req),
        req.body as UpdateProjectMemberInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function removeProjectMember(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.removeMember(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        getParam(req, "memberUserId"),
        actor(req),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function replaceProjectMembers(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.replaceMembers(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.body as ReplaceProjectMembersInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function publishProjectWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.publishWorkflow(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.body as PublishProjectWorkflowInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function updateProjectVisibility(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    sendSuccess(
      res,
      await projectsService.updateVisibility(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.body as UpdateProjectVisibilityInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function listEligibleAssignees(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await projectsService.eligibleAssignees(
        getParam(req, "workspaceId"),
        getParam(req, "projectId"),
        actor(req),
        req.query as unknown as EligibleAssigneesQuery,
      ),
    );
  } catch (error) {
    next(error);
  }
}
