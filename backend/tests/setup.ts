import { beforeAll, afterAll, beforeEach } from "vitest";
import { resetEnvCache, loadEnv } from "../src/config/env.js";
import { prisma } from "../src/config/database.js";
import { PERMISSIONS } from "../src/modules/auth/permissions.js";
import { resetEmailService } from "../src/services/email/index.js";

resetEnvCache();
loadEnv();
resetEmailService();

/**
 * Phase 4 migration may already be marked applied on the test DB before
 * completedAt was added to the SQL. Ensure the column/index exist without reset.
 */
async function ensureTaskCompletedAtColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tasks_workspaceId_status_completedAt_idx"
      ON "tasks"("workspaceId", "status", "completedAt")
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "tasks"
    SET "completedAt" = "updatedAt"
    WHERE "status" = 'DONE'
      AND "completedAt" IS NULL
      AND "deletedAt" IS NULL
  `);
}

beforeAll(async () => {
  await ensureTaskCompletedAtColumn();

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: {
        key: permission.key,
        description: permission.description,
      },
    });
  }
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.commentMention.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.taskCustomFieldValue.deleteMany();
  await prisma.customFieldDefinition.deleteMany();
  await prisma.taskTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.task.deleteMany();
  await prisma.workspaceTaskCounter.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceModule.deleteMany();
  await prisma.workspaceOnboarding.deleteMany();
  await prisma.oneTimeToken.deleteMany();
  await prisma.workspaceInvitation.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
