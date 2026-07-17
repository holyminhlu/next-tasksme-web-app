"use client";

import { useState, type FormEvent } from "react";
import { permissionsForRole, type PermissionKey } from "@/modules/auth";
import { ROLE_LABELS } from "../../constants";
import { useOnboarding } from "../../OnboardingProvider";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

const PERMISSION_LABELS: Partial<Record<PermissionKey, string>> = {
  "workspace:read": "Xem thông tin không gian làm việc",
  "workspace:update": "Cập nhật thông tin không gian làm việc",
  "members:read": "Xem danh sách thành viên",
  "members:invite": "Mời thành viên mới",
  "members:update": "Cập nhật vai trò thành viên",
  "members:remove": "Xóa thành viên",
  "ownership:transfer": "Chuyển quyền sở hữu",
  "roles:read": "Xem vai trò và quyền",
  "roles:manage": "Quản lý vai trò và quyền",
  "modules:manage": "Quản lý tính năng",
  "projects:read": "Xem dự án",
  "projects:create": "Tạo dự án",
  "projects:update": "Cập nhật dự án",
  "tasks:read": "Xem công việc",
  "tasks:create": "Tạo công việc",
  "tasks:update": "Cập nhật công việc",
};

export function RoleIntroStep() {
  const { workspace, onboarding, advance, goBack, saving } = useOnboarding();
  const [error, setError] = useState<string | null>(null);

  const rolePermissions = permissionsForRole(workspace.roleKey);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = await advance("role_intro");

    if (!result.ok) {
      setError(result.message ?? "Không thể tiếp tục");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="role_intro"
      title={`Vai trò của bạn: ${ROLE_LABELS[workspace.roleKey] ?? workspace.roleKey}`}
      description={`Những gì bạn có thể làm trong ${workspace.name}.`}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.summaryList}>
          {rolePermissions.map((permission) => (
            <div key={permission} className={styles.summaryRow}>
              <span>✓</span>
              <strong>{PERMISSION_LABELS[permission] ?? permission}</strong>
            </div>
          ))}
        </div>

        <StepActions
          onBack={() => goBack("role_intro")}
          submitLabel="Tiếp tục"
          submitting={saving}
        />
      </form>
    </OnboardingShell>
  );
}
