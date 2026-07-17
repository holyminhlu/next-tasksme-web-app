"use client";

import { useState, type FormEvent } from "react";
import {
  COMPANY_SIZES,
  INDUSTRIES,
  LOCALES,
  TIMEZONES,
} from "../../constants";
import { useOnboarding } from "../../OnboardingProvider";
import { validateOrganizationProfile } from "../../validation";
import { OnboardingShell } from "../OnboardingShell";
import { StepActions } from "../StepActions";
import styles from "../../onboarding.module.css";

export function WorkspaceProfileStep() {
  const { workspace, onboarding, advance, saving } = useOnboarding();
  const [name, setName] = useState(workspace.name);
  const [industryCode, setIndustryCode] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [timezone, setTimezone] = useState("Asia/Ho_Chi_Minh");
  const [locale, setLocale] = useState("vi");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateOrganizationProfile({
      name,
      industryCode,
      companySize,
      timezone,
      locale,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    const result = await advance("workspace_profile", {
      workspace: {
        name: name.trim(),
        industryCode,
        companySize,
        timezone,
        locale,
      },
    });

    if (!result.ok) {
      setError(result.message ?? "Không lưu được thông tin tổ chức");
    }
  }

  return (
    <OnboardingShell
      onboardingType={onboarding.onboardingType}
      step="workspace_profile"
      title="Thông tin tổ chức của bạn"
      description="Cho chúng tôi biết về công ty để thiết lập không gian làm việc phù hợp."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <label htmlFor="orgName">Tên công ty / tổ chức</label>
          <input
            id="orgName"
            name="orgName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={120}
            autoFocus
          />
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="industryCode">Lĩnh vực hoạt động</label>
            <select
              id="industryCode"
              name="industryCode"
              value={industryCode}
              onChange={(event) => setIndustryCode(event.target.value)}
              required
            >
              <option value="" disabled>
                Chọn lĩnh vực
              </option>
              {INDUSTRIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="companySize">Quy mô công ty</label>
            <select
              id="companySize"
              name="companySize"
              value={companySize}
              onChange={(event) => setCompanySize(event.target.value)}
              required
            >
              <option value="" disabled>
                Chọn quy mô
              </option>
              {COMPANY_SIZES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="timezone">Múi giờ</label>
            <select
              id="timezone"
              name="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              required
            >
              {TIMEZONES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="locale">Ngôn ngữ</label>
            <select
              id="locale"
              name="locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              required
            >
              {LOCALES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className={styles.hint}>
          Việc tải lên logo công ty sẽ được hỗ trợ trong phiên bản sau.
        </p>

        <StepActions submitLabel="Tiếp tục" submitting={saving} />
      </form>
    </OnboardingShell>
  );
}
