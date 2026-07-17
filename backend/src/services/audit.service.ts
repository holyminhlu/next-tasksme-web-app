import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/database.js";

type AuditInput = {
  action: string;
  userId?: string | null;
  workspaceId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      userId: input.userId ?? undefined,
      workspaceId: input.workspaceId ?? undefined,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
      requestId: input.requestId ?? undefined,
    },
  });
}
