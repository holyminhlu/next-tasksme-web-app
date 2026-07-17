"use client";

import { Check, Minus } from "lucide-react";
import {
  hasPermission,
  ROLE_PERMISSION_MAP,
  useAuth,
  type PermissionKey,
} from "@/modules/auth";
import { Badge, ForbiddenState, Table } from "@/modules/design-system";
import styles from "../../app-pages.module.css";

const ROLE_ORDER = ["owner", "admin", "manager", "member"] as const;

const ALL_PERMISSIONS: PermissionKey[] = Array.from(
  new Set(Object.values(ROLE_PERMISSION_MAP).flat()),
);

export default function RolesSettingsPage() {
  const { permissions, selectedWorkspace } = useAuth();

  if (!hasPermission(permissions, "roles:read")) {
    return <ForbiddenState />;
  }

  const currentRole = selectedWorkspace?.roleKey;

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="roles-heading">
        <h2 id="roles-heading" className={styles.cardTitle}>
          Roles and permissions
        </h2>
        <p className={styles.cardDescription}>
          What each role can do in this workspace. Custom roles arrive with the
          role management API in a later phase.
        </p>

        <Table aria-label="Role permission matrix">
          <thead>
            <tr>
              <th scope="col">Permission</th>
              {ROLE_ORDER.map((role) => (
                <th scope="col" key={role}>
                  {role}
                  {role === currentRole && (
                    <>
                      {" "}
                      <Badge tone="primary">You</Badge>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((permission) => (
              <tr key={permission}>
                <th scope="row">{permission}</th>
                {ROLE_ORDER.map((role) => {
                  const granted =
                    ROLE_PERMISSION_MAP[role]?.includes(permission) ?? false;

                  return (
                    <td key={role}>
                      {granted ? (
                        <>
                          <Check size={16} aria-hidden color="var(--ds-color-success)" />
                          <span className={styles.srOnlyText}>Granted</span>
                        </>
                      ) : (
                        <>
                          <Minus size={16} aria-hidden color="var(--ds-color-text-subtle)" />
                          <span className={styles.srOnlyText}>Not granted</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
