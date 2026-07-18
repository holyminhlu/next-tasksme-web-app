import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "./comments.controller.js";
import {
  commentParamsSchema,
  createCommentSchema,
  listCommentsQuerySchema,
  updateCommentSchema,
  workspaceTaskParamsSchema,
} from "./comments.schemas.js";

export const commentsRouter = Router({ mergeParams: true });

commentsRouter.use(authenticate);

commentsRouter.get(
  "/",
  validateRequest({
    params: workspaceTaskParamsSchema,
    query: listCommentsQuerySchema,
  }),
  tenantContext,
  requirePermission("comment.view"),
  listComments,
);

commentsRouter.post(
  "/",
  validateRequest({
    params: workspaceTaskParamsSchema,
    body: createCommentSchema,
  }),
  tenantContext,
  requirePermission("comment.create"),
  createComment,
);

commentsRouter.patch(
  "/:commentId",
  validateRequest({
    params: commentParamsSchema,
    body: updateCommentSchema,
  }),
  tenantContext,
  requirePermission("comment.update_own"),
  updateComment,
);

commentsRouter.delete(
  "/:commentId",
  validateRequest({ params: commentParamsSchema }),
  tenantContext,
  requirePermission("comment.delete_own"),
  deleteComment,
);
