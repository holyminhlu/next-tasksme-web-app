import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { tenantContext } from "../../middleware/tenantContext.js";
import { validateRequest } from "../../middleware/validate.js";
import {
  deleteAttachment,
  downloadAttachment,
  listAttachments,
  uploadAttachment,
} from "./attachments.controller.js";
import {
  attachmentParamsSchema,
  workspaceTaskParamsSchema,
} from "./attachments.schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Hard ceiling; service enforces ATTACHMENT_MAX_BYTES from env.
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
});

export const attachmentsRouter = Router({ mergeParams: true });

attachmentsRouter.use(authenticate);

attachmentsRouter.get(
  "/",
  validateRequest({ params: workspaceTaskParamsSchema }),
  tenantContext,
  requirePermission("attachment.view"),
  listAttachments,
);

attachmentsRouter.post(
  "/",
  validateRequest({ params: workspaceTaskParamsSchema }),
  tenantContext,
  requirePermission("attachment.upload"),
  upload.single("file"),
  uploadAttachment,
);

attachmentsRouter.get(
  "/:attachmentId/download",
  validateRequest({ params: attachmentParamsSchema }),
  tenantContext,
  requirePermission("attachment.view"),
  downloadAttachment,
);

attachmentsRouter.delete(
  "/:attachmentId",
  validateRequest({ params: attachmentParamsSchema }),
  tenantContext,
  requirePermission("attachment.delete_own"),
  deleteAttachment,
);
