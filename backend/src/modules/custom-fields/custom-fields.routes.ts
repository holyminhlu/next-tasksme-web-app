import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createCustomField,
  deleteCustomField,
  listCustomFields,
  listTaskCustomFieldValues,
  setTaskCustomFieldValues,
  updateCustomField,
} from "./custom-fields.controller.js";
import {
  createCustomFieldSchema,
  fieldIdParamsSchema,
  listCustomFieldsQuerySchema,
  setTaskCustomFieldValuesSchema,
  updateCustomFieldSchema,
  workspaceIdParamsSchema,
  workspaceTaskParamsSchema,
} from "./custom-fields.schemas.js";

export const customFieldsRouter = Router({ mergeParams: true });
export const taskCustomFieldsRouter = Router({ mergeParams: true });

customFieldsRouter.use(authenticate);
taskCustomFieldsRouter.use(authenticate);

customFieldsRouter.get(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: listCustomFieldsQuerySchema,
  }),
  tenantContext,
  requirePermission("custom_field.view"),
  listCustomFields,
);

customFieldsRouter.post(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: createCustomFieldSchema,
  }),
  tenantContext,
  requirePermission("custom_field.configure"),
  createCustomField,
);

customFieldsRouter.patch(
  "/:fieldId",
  validateRequest({
    params: fieldIdParamsSchema,
    body: updateCustomFieldSchema,
  }),
  tenantContext,
  requirePermission("custom_field.configure"),
  updateCustomField,
);

customFieldsRouter.delete(
  "/:fieldId",
  validateRequest({ params: fieldIdParamsSchema }),
  tenantContext,
  requirePermission("custom_field.configure"),
  deleteCustomField,
);

taskCustomFieldsRouter.get(
  "/",
  validateRequest({ params: workspaceTaskParamsSchema }),
  tenantContext,
  requirePermission("custom_field.view"),
  listTaskCustomFieldValues,
);

taskCustomFieldsRouter.put(
  "/",
  validateRequest({
    params: workspaceTaskParamsSchema,
    body: setTaskCustomFieldValuesSchema,
  }),
  tenantContext,
  requirePermission("custom_field.value.update"),
  setTaskCustomFieldValues,
);
