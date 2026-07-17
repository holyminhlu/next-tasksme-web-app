"use client";

import { Info } from "lucide-react";
import { useAuth } from "@/modules/auth";
import { Badge, Button, FormField, TextInput } from "@/modules/design-system";
import styles from "../../app-pages.module.css";

export default function ProfileSettingsPage() {
  const { profile } = useAuth();

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="profile-heading">
        <h2 id="profile-heading" className={styles.cardTitle}>
          Profile
        </h2>
        <p className={styles.cardDescription}>
          Your personal details as other workspace members see them.
        </p>

        <p className={styles.noticeBanner}>
          <Info size={16} aria-hidden className={styles.bannerIcon} />
          <span>
            Profile editing isn&apos;t available yet — the profile update API
            ships in a later phase. Fields below are read-only.
          </span>
        </p>

        <form
          className={styles.form}
          style={{ marginTop: 16 }}
          onSubmit={(event) => event.preventDefault()}
        >
          <FormField label="Full name">
            {(props) => (
              <TextInput {...props} value={profile?.fullName ?? ""} readOnly disabled />
            )}
          </FormField>
          <FormField
            label="Email address"
            hint={
              profile?.emailVerifiedAt
                ? "Your email address is verified."
                : "Your email address is not verified yet."
            }
          >
            {(props) => (
              <TextInput
                {...props}
                type="email"
                value={profile?.email ?? ""}
                readOnly
                disabled
              />
            )}
          </FormField>
          <div className={styles.row}>
            <span className={styles.muted}>Account status</span>
            <Badge tone={profile?.status === "ACTIVE" ? "success" : "warning"}>
              {profile?.status ?? "UNKNOWN"}
            </Badge>
            {profile?.emailVerifiedAt ? (
              <Badge tone="success">Email verified</Badge>
            ) : (
              <Badge tone="warning">Email unverified</Badge>
            )}
          </div>
          <div className={styles.formActions}>
            <Button disabled title="Profile update API not yet available">
              Save changes
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
