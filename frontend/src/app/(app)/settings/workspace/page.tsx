"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Button,
  ForbiddenState,
  FormField,
  LoadingState,
  Select,
  TextInput,
  useToast,
} from "@/modules/design-system";
import { getWorkspace, updateWorkspace } from "@/modules/workspaces";
import styles from "../../app-pages.module.css";

export default function WorkspaceSettingsPage() {
  const { permissions, refreshProfile, selectedWorkspace } = useAuth();
  const { toast } = useToast();

  const workspaceId = selectedWorkspace?.id;
  const canRead = hasPermission(permissions, "workspace:read");
  const canUpdate = hasPermission(permissions, "workspace:update");
  const isOrganization = selectedWorkspace?.type === "ORGANIZATION";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [usagePurpose, setUsagePurpose] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [locale, setLocale] = useState("vi");
  const [industryCode, setIndustryCode] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [dependencyPolicy, setDependencyPolicy] = useState<
    "WARN_ONLY" | "BLOCK" | "BLOCK_WITH_OVERRIDE"
  >("WARN_ONLY");
  const [slug, setSlug] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setLoading(true);
    const result = await getWorkspace(workspaceId);
    setLoading(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setError(null);
    setName(result.data.name);
    setSlug(result.data.slug);
    setUsagePurpose(result.data.usagePurpose ?? "");
    setTimezone(result.data.timezone);
    setLocale(result.data.locale);
    setIndustryCode(result.data.industryCode ?? "");
    setCompanySize(result.data.companySize ?? "");
    setDependencyPolicy(
      result.data.dependencyCompletionPolicy ?? "WARN_ONLY",
    );
  }, [workspaceId]);

  useEffect(() => {
    if (canRead && workspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
      void loadWorkspace();
    }
  }, [canRead, workspaceId, loadWorkspace]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceId || !canUpdate || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await updateWorkspace(workspaceId, {
      name: name.trim(),
      usagePurpose: usagePurpose.trim() || null,
      timezone: timezone.trim(),
      locale: locale.trim(),
      dependencyCompletionPolicy: dependencyPolicy,
      ...(isOrganization
        ? {
            industryCode: industryCode.trim() || null,
            companySize: companySize.trim() || null,
          }
        : {}),
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    await refreshProfile();
    toast({
      title: "Workspace updated",
      description: "Your workspace details were saved.",
      tone: "success",
    });
  }

  if (!canRead) {
    return <ForbiddenState />;
  }

  if (loading) {
    return <LoadingState label="Loading workspace details…" />;
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="workspace-heading">
        <h2 id="workspace-heading" className={styles.cardTitle}>
          Workspace details
        </h2>
        <p className={styles.cardDescription}>
          General information about this workspace.
        </p>

        {error && (
          <p className={styles.errorBanner} role="alert">
            {error}
          </p>
        )}

        <form
          className={styles.form}
          style={{ marginTop: 16 }}
          onSubmit={handleSubmit}
        >
          <FormField label="Workspace name" required>
            {(props) => (
              <TextInput
                {...props}
                value={name}
                onChange={(event) => setName(event.target.value)}
                readOnly={!canUpdate}
                disabled={!canUpdate}
                required
              />
            )}
          </FormField>
          <FormField label="Slug" hint="Used in links and integrations.">
            {(props) => (
              <TextInput {...props} value={slug} readOnly disabled />
            )}
          </FormField>
          <FormField label="Your role">
            {(props) => (
              <TextInput
                {...props}
                value={selectedWorkspace?.roleKey ?? ""}
                readOnly
                disabled
              />
            )}
          </FormField>
          <FormField label="Usage purpose" hint="Optional">
            {(props) => (
              <TextInput
                {...props}
                value={usagePurpose}
                onChange={(event) => setUsagePurpose(event.target.value)}
                readOnly={!canUpdate}
                disabled={!canUpdate}
              />
            )}
          </FormField>
          {isOrganization && (
            <>
              <FormField label="Industry code" hint="Optional">
                {(props) => (
                  <TextInput
                    {...props}
                    value={industryCode}
                    onChange={(event) => setIndustryCode(event.target.value)}
                    readOnly={!canUpdate}
                    disabled={!canUpdate}
                  />
                )}
              </FormField>
              <FormField label="Company size" hint="Optional">
                {(props) => (
                  <TextInput
                    {...props}
                    value={companySize}
                    onChange={(event) => setCompanySize(event.target.value)}
                    readOnly={!canUpdate}
                    disabled={!canUpdate}
                  />
                )}
              </FormField>
            </>
          )}
          <FormField label="Timezone">
            {(props) => (
              <TextInput
                {...props}
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                readOnly={!canUpdate}
                disabled={!canUpdate}
              />
            )}
          </FormField>
          <FormField label="Locale">
            {(props) => (
              <TextInput
                {...props}
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                readOnly={!canUpdate}
                disabled={!canUpdate}
              />
            )}
          </FormField>
          <FormField
            label="Dependency completion policy"
            hint="Controls completing a task while predecessor tasks are unfinished."
          >
            {(props) => (
              <Select
                {...props}
                value={dependencyPolicy}
                disabled={!canUpdate}
                onChange={(event) =>
                  setDependencyPolicy(
                    event.target.value as
                      | "WARN_ONLY"
                      | "BLOCK"
                      | "BLOCK_WITH_OVERRIDE",
                  )
                }
              >
                <option value="WARN_ONLY">Warn only</option>
                <option value="BLOCK">Block completion</option>
                <option value="BLOCK_WITH_OVERRIDE">
                  Block with permission-based override
                </option>
              </Select>
            )}
          </FormField>
          <div className={styles.formActions}>
            <Button type="submit" loading={submitting} disabled={!canUpdate}>
              Save changes
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
