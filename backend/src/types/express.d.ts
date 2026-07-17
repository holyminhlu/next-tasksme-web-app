import type { MembershipStatus, UserStatus } from "../../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      sessionId?: string;
      user?: {
        id: string;
        email: string;
        fullName: string;
        status: UserStatus;
        authVersion: number;
      };
      tenant?: {
        companyId: string;
        membershipId: string;
        roleId: string;
        roleKey: string;
        status: MembershipStatus;
        permissions: string[];
      };
    }
  }
}

export {};
