import type { WorkspaceType } from "@/modules/auth";

export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  status: string;
  usagePurpose: string | null;
  industryCode: string | null;
  companySize: string | null;
  timezone: string;
  locale: string;
  logoUrl: string | null;
  dependencyCompletionPolicy:
    | "WARN_ONLY"
    | "BLOCK"
    | "BLOCK_WITH_OVERRIDE";
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateWorkspaceInput = {
  name?: string;
  usagePurpose?: string | null;
  industryCode?: string | null;
  companySize?: string | null;
  timezone?: string;
  locale?: string;
  logoUrl?: string | null;
  dependencyCompletionPolicy?:
    | "WARN_ONLY"
    | "BLOCK"
    | "BLOCK_WITH_OVERRIDE";
};

export type TransferOwnershipInput = {
  memberId: string;
};

export type TransferOwnershipResponse = {
  transferred: boolean;
  ownerId: string;
};
