import { beforeAll, afterAll, beforeEach } from "vitest";
import { resetEnvCache, loadEnv } from "../src/config/env.js";
import { prisma } from "../src/config/database.js";
import { PERMISSIONS } from "../src/modules/auth/permissions.js";

resetEnvCache();
loadEnv();

beforeAll(async () => {
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
  await prisma.refreshSession.deleteMany();
  await prisma.companyMember.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
