-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OneTimeTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserStatus" ADD VALUE 'PENDING_VERIFICATION';
ALTER TYPE "UserStatus" ADD VALUE 'LOCKED';

-- AlterTable
ALTER TABLE "refresh_sessions"
ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3),
ADD COLUMN "lastUsedAt" TIMESTAMP(3),
ADD COLUMN "rememberMe" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "revokeReason" TEXT;

UPDATE "refresh_sessions"
SET "absoluteExpiresAt" = "expiresAt"
WHERE "absoluteExpiresAt" IS NULL;

ALTER TABLE "refresh_sessions"
ALTER COLUMN "absoluteExpiresAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

UPDATE "users"
SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt")
WHERE "status" = 'ACTIVE';

-- CreateTable
CREATE TABLE "one_time_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "OneTimeTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_invitations" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "companyId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_tokenHash_key" ON "one_time_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "one_time_tokens_userId_type_idx" ON "one_time_tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "one_time_tokens_expiresAt_idx" ON "one_time_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "company_invitations_tokenHash_key" ON "company_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "company_invitations_companyId_email_idx" ON "company_invitations"("companyId", "email");

-- CreateIndex
CREATE INDEX "company_invitations_status_idx" ON "company_invitations"("status");

-- CreateIndex
CREATE INDEX "company_invitations_expiresAt_idx" ON "company_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_roleId_companyId_fkey" FOREIGN KEY ("roleId", "companyId") REFERENCES "roles"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
