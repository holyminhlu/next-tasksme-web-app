import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../../lib/response.js";
import { actorFromRequest } from "../tasks/task-access.js";
import type {
  CreateCustomFieldInput,
  ListCustomFieldsQuery,
  SetTaskCustomFieldValuesInput,
  UpdateCustomFieldInput,
} from "./custom-fields.schemas.js";
import { customFieldsService } from "./custom-fields.service.js";

function param(req: Request, key: string) {
  const value = req.params[key];
  return Array.isArray(value) ? value[0]! : value!;
}

export async function listCustomFields(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await customFieldsService.list(
      param(req, "workspaceId"),
      req.query as unknown as ListCustomFieldsQuery,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function createCustomField(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await customFieldsService.create(
      param(req, "workspaceId"),
      actorFromRequest(req),
      req.body as CreateCustomFieldInput,
    );
    sendSuccess(res, data, { statusCode: 201 });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomField(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await customFieldsService.update(
      param(req, "workspaceId"),
      param(req, "fieldId"),
      actorFromRequest(req),
      req.body as UpdateCustomFieldInput,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function deleteCustomField(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await customFieldsService.remove(
      param(req, "workspaceId"),
      param(req, "fieldId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function listTaskCustomFieldValues(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await customFieldsService.listValues(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}

export async function setTaskCustomFieldValues(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await customFieldsService.setValues(
      param(req, "workspaceId"),
      param(req, "taskId"),
      actorFromRequest(req),
      req.body as SetTaskCustomFieldValuesInput,
    );
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
}
