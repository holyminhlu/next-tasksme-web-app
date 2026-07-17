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
};

export type TransferOwnershipInput = {
  memberId: string;
};

export type TransferOwnershipResponse = {
  transferred: boolean;
  ownerId: string;
};
