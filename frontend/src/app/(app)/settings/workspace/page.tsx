"use client";

import { Info } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  ForbiddenState,
  FormField,
  TextInput,
} from "@/modules/design-system";
import styles from "../../app-pages.module.css";

export default function WorkspaceSettingsPage() {
  const { permissions, selectedWorkspace } = useAuth();

  if (!hasPermission(permissions, "workspace:read")) {
    return <ForbiddenState />;
  }

  const canUpdate = hasPermission(permissions, "workspace:update");
  const isOrganization = selectedWorkspace?.type === "ORGANIZATION";

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="workspace-heading">
        <div className={styles.row}>
          <h2 id="workspace-heading" className={styles.cardTitle}>
            Workspace details
          </h2>
          <Badge tone={isOrganization ? "primary" : "neutral"}>
            {isOrganization ? "Organization" : "Personal"}
          </Badge>
        </div>
        <p className={styles.cardDescription}>
          General information about this workspace.
        </p>

        <p className={styles.noticeBanner}>
          <Info size={16} aria-hidden className={styles.bannerIcon} />
          <span>
            Workspace editing outside onboarding isn&apos;t available yet — the
            workspace update API ships in a later phase. Fields below are
            read-only{canUpdate ? "" : " and you don't have update permission"}.
          </span>
        </p>

        <form
          className={styles.form}
          style={{ marginTop: 16 }}
          onSubmit={(event) => event.preventDefault()}
        >
          <FormField label="Workspace name">
            {(props) => (
              <TextInput
                {...props}
                value={selectedWorkspace?.name ?? ""}
                readOnly
                disabled
              />
            )}
          </FormField>
          <FormField label="Slug" hint="Used in links and integrations.">
            {(props) => (
              <TextInput
                {...props}
                value={selectedWorkspace?.slug ?? ""}
                readOnly
                disabled
              />
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
          <div className={styles.formActions}>
            <Button disabled title="Workspace update API not yet available">
              Save changes
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
