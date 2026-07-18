import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createTag,
  deleteTag,
  listTags,
  listTaskTags,
  setTaskTags,
  updateTag,
} from "./tags.controller.js";
import {
  createTagSchema,
  listTagsQuerySchema,
  setTaskTagsSchema,
  tagIdParamsSchema,
  updateTagSchema,
  workspaceIdParamsSchema,
  workspaceTaskParamsSchema,
} from "./tags.schemas.js";

export const tagsRouter = Router({ mergeParams: true });
export const taskTagsRouter = Router({ mergeParams: true });

tagsRouter.use(authenticate);
taskTagsRouter.use(authenticate);

tagsRouter.get(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    query: listTagsQuerySchema,
  }),
  tenantContext,
  requirePermission("tag.view"),
  listTags,
);

tagsRouter.post(
  "/",
  validateRequest({
    params: workspaceIdParamsSchema,
    body: createTagSchema,
  }),
  tenantContext,
  requirePermission("tag.create"),
  createTag,
);

tagsRouter.patch(
  "/:tagId",
  validateRequest({
    params: tagIdParamsSchema,
    body: updateTagSchema,
  }),
  tenantContext,
  requirePermission("tag.update"),
  updateTag,
);

tagsRouter.delete(
  "/:tagId",
  validateRequest({ params: tagIdParamsSchema }),
  tenantContext,
  requirePermission("tag.delete"),
  deleteTag,
);

taskTagsRouter.get(
  "/",
  validateRequest({ params: workspaceTaskParamsSchema }),
  tenantContext,
  requirePermission("tag.view"),
  listTaskTags,
);

taskTagsRouter.put(
  "/",
  validateRequest({
    params: workspaceTaskParamsSchema,
    body: setTaskTagsSchema,
  }),
  tenantContext,
  requirePermission("task.tag.manage"),
  setTaskTags,
);
