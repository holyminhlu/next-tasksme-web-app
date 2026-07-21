import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../lib/errors.js";
import { sendSuccess } from "../../lib/response.js";
import type {
  CloneTemplateInput,
  CreateTemplateInput,
  ListTemplatesQuery,
  UpdateTemplateInput,
} from "./templates.schemas.js";
import { templatesService } from "./template-lifecycle.service.js";

function getParam(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value;
}

function actor(req: Request) {
  if (!req.user || !req.tenant) throw new UnauthorizedError();
  return { userId: req.user.id, roleKey: req.tenant.roleKey };
}

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.tenant) throw new ForbiddenError("Tenant context is required");
    const result = await templatesService.list(
      getParam(req, "workspaceId"),
      req.query as unknown as ListTemplatesQuery,
    );
    sendSuccess(res, result.items, { meta: { pagination: result.pagination } });
  } catch (error) {
    next(error);
  }
}

export async function getTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.get(getParam(req, "workspaceId"), getParam(req, "templateId")),
    );
  } catch (error) {
    next(error);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const current = actor(req);
    sendSuccess(
      res,
      await templatesService.create(
        getParam(req, "workspaceId"),
        current.userId,
        req.body as CreateTemplateInput,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.update(
        getParam(req, "workspaceId"),
        getParam(req, "templateId"),
        req.body as UpdateTemplateInput,
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function publishTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.publish(
        getParam(req, "workspaceId"),
        getParam(req, "templateId"),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function archiveTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.archive(
        getParam(req, "workspaceId"),
        getParam(req, "templateId"),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function duplicateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const current = actor(req);
    sendSuccess(
      res,
      await templatesService.duplicate(
        getParam(req, "workspaceId"),
        getParam(req, "templateId"),
        current.userId,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function cloneTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.clone(
        getParam(req, "workspaceId"),
        getParam(req, "templateId"),
        actor(req),
        req.body as CloneTemplateInput,
      ),
      { statusCode: 202 },
    );
  } catch (error) {
    next(error);
  }
}

export async function getCloneJob(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.getCloneJob(
        getParam(req, "workspaceId"),
        getParam(req, "cloneJobId"),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function validateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.validate(
        getParam(req, "workspaceId"),
        getParam(req, "templateId"),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function createTemplateVersion(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.createVersion(
        getParam(req, "workspaceId"),
        getParam(req, "templateId"),
        actor(req).userId,
      ),
      { statusCode: 201 },
    );
  } catch (error) {
    next(error);
  }
}

export async function listTemplateVersions(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.versions(
        getParam(req, "workspaceId"),
        getParam(req, "templateId"),
      ),
    );
  } catch (error) {
    next(error);
  }
}

export async function retryCloneJob(req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(
      res,
      await templatesService.retryCloneJob(
        getParam(req, "workspaceId"),
        getParam(req, "cloneJobId"),
      ),
    );
  } catch (error) {
    next(error);
  }
}
