import type { Prisma } from "../../../generated/prisma/client.js";
import { ForbiddenError } from "../../lib/errors.js";

export async function lockWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`;
}

export async function countActiveOwners(
  tx: Prisma.TransactionClient,
  workspaceId: string,
) {
  return tx.workspaceMember.count({
    where: {
      workspaceId,
      deletedAt: null,
      status: "ACTIVE",
      role: {
        key: "owner",
      },
    },
  });
}

export async function assertCanModifyMember(options: {
  actorRoleKey: string;
  targetRoleKey: string;
  nextRoleKey?: string;
  isSelf: boolean;
}) {
  const { actorRoleKey, targetRoleKey, nextRoleKey, isSelf } = options;

  if (targetRoleKey === "owner" && actorRoleKey !== "owner") {
    throw new ForbiddenError("Only owners can modify owner memberships");
  }

  if (nextRoleKey === "owner") {
    throw new ForbiddenError("Use ownership transfer to assign the owner role");
  }

  if (nextRoleKey === "admin" && actorRoleKey !== "owner") {
    throw new ForbiddenError("Only owners can assign the admin role");
  }

  if (actorRoleKey === "manager" && nextRoleKey && nextRoleKey !== "member") {
    throw new ForbiddenError("Managers can only assign the member role");
  }

  if (
    isSelf &&
    nextRoleKey &&
    nextRoleKey !== targetRoleKey &&
    actorRoleKey !== "owner"
  ) {
    throw new ForbiddenError("Members cannot change their own role");
  }
}

export async function assertNotLastOwner(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  targetRoleKey: string,
  nextRoleKey?: string,
) {
  if (targetRoleKey !== "owner") {
    return;
  }

  if (!nextRoleKey || nextRoleKey === "owner") {
    return;
  }

  const owners = await countActiveOwners(tx, workspaceId);
  if (owners <= 1) {
    throw new ForbiddenError("Cannot demote or remove the last owner");
  }
}
