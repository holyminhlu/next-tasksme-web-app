import type { WorkspaceType } from "@/modules/auth";
import type { CreateWorkspaceInput } from "./onboarding.types";

export type UsageTypeSelection = {
  type: WorkspaceType | null;
};

export function validateUsageType(selection: UsageTypeSelection): string | null {
  if (!selection.type) {
    return "Vui lòng chọn hình thức sử dụng";
  }

  return null;
}

/**
 * Builds the POST /workspaces payload for the chosen usage type.
 * The backend generates a default name; onboarding steps refine it later.
 */
export function buildCreateWorkspacePayload(
  type: WorkspaceType,
): CreateWorkspaceInput {
  if (type === "PERSONAL") {
    return { type, timezone: "Asia/Ho_Chi_Minh", locale: "vi" };
  }

  return { type, timezone: "Asia/Ho_Chi_Minh", locale: "vi" };
}

export function validateWorkspaceName(name: string): string | null {
  if (name.trim().length < 2) {
    return "Tên không gian làm việc cần ít nhất 2 ký tự";
  }

  if (name.trim().length > 120) {
    return "Tên không gian làm việc tối đa 120 ký tự";
  }

  return null;
}

export function validateUsagePurpose(purpose: string): string | null {
  if (!purpose) {
    return "Vui lòng chọn mục đích sử dụng";
  }

  return null;
}

export type OrganizationProfileInput = {
  name: string;
  industryCode: string;
  companySize: string;
  timezone: string;
  locale: string;
};

export function validateOrganizationProfile(
  input: OrganizationProfileInput,
): string | null {
  const nameError = validateWorkspaceName(input.name);
  if (nameError) {
    return nameError;
  }

  if (!input.industryCode) {
    return "Vui lòng chọn lĩnh vực hoạt động";
  }

  if (!input.companySize) {
    return "Vui lòng chọn quy mô công ty";
  }

  if (!input.timezone) {
    return "Vui lòng chọn múi giờ";
  }

  if (!input.locale) {
    return "Vui lòng chọn ngôn ngữ";
  }

  return null;
}

export type FirstProjectFormInput = {
  name: string;
  taskTitles: string[];
};

export function validateFirstProject(
  input: FirstProjectFormInput,
): string | null {
  if (input.name.trim().length < 2) {
    return "Tên dự án cần ít nhất 2 ký tự";
  }

  const nonEmpty = input.taskTitles.filter((title) => title.trim().length > 0);
  if (nonEmpty.length > 20) {
    return "Tối đa 20 công việc cho dự án đầu tiên";
  }

  return null;
}

export function normalizeTaskTitles(taskTitles: string[]): string[] {
  return taskTitles
    .map((title) => title.trim())
    .filter((title) => title.length > 0);
}

export function validateInviteEmail(email: string): string | null {
  if (!email.includes("@") || email.trim().length < 5) {
    return "Vui lòng nhập địa chỉ email hợp lệ";
  }

  return null;
}
