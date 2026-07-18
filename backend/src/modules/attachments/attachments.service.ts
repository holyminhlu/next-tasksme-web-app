import { prisma } from "../../config/database.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { recordActivity, ACTIVITY_ACTIONS } from "../../services/activity.service.js";
import {
  assertAllowedAttachment,
  buildStorageKey,
  checksumBuffer,
  createSignedDownloadUrl,
  deleteObject,
  putObject,
} from "../../services/storage.service.js";
import {
  assertCanMutateTask,
  getVisibleTask,
  type TaskActor,
} from "../tasks/task-access.js";

function mapAttachment(row: {
  id: string;
  workspaceId: string;
  taskId: string;
  uploadedById: string | null;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  scanStatus: string;
  createdAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    taskId: row.taskId,
    uploadedById: row.uploadedById,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    scanStatus: row.scanStatus,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export const attachmentsService = {
  async list(workspaceId: string, taskId: string, actor: TaskActor) {
    await getVisibleTask(workspaceId, taskId, actor);
    const rows = await prisma.attachment.findMany({
      where: { workspaceId, taskId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapAttachment);
  },

  async upload(
    workspaceId: string,
    taskId: string,
    actor: TaskActor,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    const task = await getVisibleTask(workspaceId, taskId, actor);
    assertCanMutateTask(actor, task, "upload attachments");

    if (!file?.buffer) {
      throw new ValidationError("file is required", { field: "file" });
    }

    assertAllowedAttachment({
      mimeType: file.mimetype,
      sizeBytes: file.size,
      originalFileName: file.originalname,
    });

    const storageKey = buildStorageKey(workspaceId, taskId);
    const checksum = checksumBuffer(file.buffer);

    await putObject({
      storageKey,
      body: file.buffer,
      mimeType: file.mimetype,
    });

    const row = await prisma.attachment.create({
      data: {
        workspaceId,
        taskId,
        uploadedById: actor.userId,
        originalFileName: file.originalname.slice(0, 255),
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        checksum,
        scanStatus: "CLEAN",
      },
    });

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.ATTACHMENT_UPLOADED,
      resourceType: "task",
      resourceId: taskId,
      projectId: task.projectId,
      summary: `Uploaded "${row.originalFileName}" to "${task.title}"`,
      metadata: { attachmentId: row.id, mimeType: row.mimeType },
    });

    return mapAttachment(row);
  },

  async createDownloadUrl(
    workspaceId: string,
    taskId: string,
    attachmentId: string,
    actor: TaskActor,
  ) {
    await getVisibleTask(workspaceId, taskId, actor);
    const row = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        workspaceId,
        taskId,
        deletedAt: null,
      },
    });
    if (!row) throw new NotFoundError("Attachment not found");
    if (row.scanStatus === "REJECTED") {
      throw new ForbiddenError("Attachment failed security scan");
    }

    const signed = await createSignedDownloadUrl(row.storageKey, row.mimeType);
    return {
      attachment: mapAttachment(row),
      downloadUrl: signed.url,
      expiresIn: signed.expiresIn,
    };
  },

  async remove(
    workspaceId: string,
    taskId: string,
    attachmentId: string,
    actor: TaskActor,
  ) {
    await getVisibleTask(workspaceId, taskId, actor);
    const row = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        workspaceId,
        taskId,
        deletedAt: null,
      },
    });
    if (!row) throw new NotFoundError("Attachment not found");

    const canManage = actor.permissions?.includes("attachment.manage");
    if (row.uploadedById !== actor.userId && !canManage) {
      throw new ForbiddenError("You can only delete your own attachments");
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });

    try {
      await deleteObject(row.storageKey);
    } catch {
      // Soft-deleted metadata remains even if object cleanup fails.
    }

    await recordActivity({
      workspaceId,
      actorId: actor.userId,
      action: ACTIVITY_ACTIONS.ATTACHMENT_DELETED,
      resourceType: "task",
      resourceId: taskId,
      summary: `Deleted attachment "${row.originalFileName}"`,
      metadata: { attachmentId },
    });

    return { id: attachmentId };
  },
};
