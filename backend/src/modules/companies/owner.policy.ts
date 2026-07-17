import type { Prisma } from "../../../generated/prisma/client.js";
import { ForbiddenError } from "../../lib/errors.js";

export async function lockCompany(
  tx: Prisma.TransactionClient,
  companyId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`;
}

export async function countActiveOwners(
  tx: Prisma.TransactionClient,
  companyId: string,
) {
  return tx.companyMember.count({
    where: {
      companyId,
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
  companyId: string,
  targetRoleKey: string,
  nextRoleKey?: string,
) {
  if (targetRoleKey !== "owner") {
    return;
  }

  if (!nextRoleKey || nextRoleKey === "owner") {
    return;
  }

  const owners = await countActiveOwners(tx, companyId);
  if (owners <= 1) {
    throw new ForbiddenError("Cannot demote or remove the last owner");
  }
}
