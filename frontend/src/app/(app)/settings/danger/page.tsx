"use client";

import { TriangleAlert } from "lucide-react";
import { hasPermission, useAuth } from "@/modules/auth";
import { Badge, Button, ForbiddenState } from "@/modules/design-system";
import styles from "../../app-pages.module.css";

export default function DangerZoneSettingsPage() {
  const { permissions, selectedWorkspace } = useAuth();

  if (!hasPermission(permissions, "workspace:update")) {
    return <ForbiddenState />;
  }

  const canTransfer = hasPermission(permissions, "ownership:transfer");
  const isOrganization = selectedWorkspace?.type === "ORGANIZATION";

  return (
    <div className={styles.stack}>
      <p className={styles.warningBanner}>
        <TriangleAlert size={16} aria-hidden className={styles.bannerIcon} />
        <span>
          Actions in this section are destructive and permanent. The APIs for
          them ship in a later phase, so both actions are currently
          unavailable — nothing here can be executed yet.
        </span>
      </p>

      {isOrganization && canTransfer && (
        <section
          className={`${styles.card} ${styles.dangerCard}`}
          aria-labelledby="transfer-heading"
        >
          <div className={styles.row}>
            <h2 id="transfer-heading" className={styles.cardTitle}>
              Transfer ownership
            </h2>
            <Badge tone="warning">API not yet available</Badge>
          </div>
          <p className={styles.cardDescription}>
            Hand this workspace over to another member. You&apos;ll become an
            admin after the transfer.
          </p>
          <Button
            variant="dangerOutline"
            disabled
            title="Ownership transfer API not yet available"
          >
            Transfer ownership
          </Button>
        </section>
      )}

      <section
        className={`${styles.card} ${styles.dangerCard}`}
        aria-labelledby="delete-heading"
      >
        <div className={styles.row}>
          <h2 id="delete-heading" className={styles.cardTitle}>
            Delete workspace
          </h2>
          <Badge tone="warning">API not yet available</Badge>
        </div>
        <p className={styles.cardDescription}>
          Permanently delete {selectedWorkspace?.name ?? "this workspace"} and
          all of its projects, tasks and members. This cannot be undone.
        </p>
        <Button
          variant="danger"
          disabled
          title="Workspace deletion API not yet available"
        >
          Delete workspace
        </Button>
      </section>
    </div>
  );
}
