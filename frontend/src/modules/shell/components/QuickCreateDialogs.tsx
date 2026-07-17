"use client";

import { useState, type FormEvent } from "react";
import { Info } from "lucide-react";
import { useAuth } from "@/modules/auth";
import { inviteMember } from "@/modules/onboarding/onboarding.service";
import {
  Badge,
  Button,
  Dialog,
  FormField,
  Select,
  TextArea,
  TextInput,
  useToast,
} from "@/modules/design-system";
import { useShell } from "../ShellProvider";
import styles from "./QuickCreate.module.css";

const INVITABLE_ROLES = ["admin", "manager", "member"] as const;

/**
 * Placeholder create form. Task/project creation APIs are not part of this
 * phase, so the form is intentionally non-submittable — we never fake a
 * successful backend mutation.
 */
function PlaceholderCreateForm({
  entity,
  onClose,
}: {
  entity: "task" | "project";
  onClose: () => void;
}) {
  return (
    <form
      className={styles.form}
      onSubmit={(event) => event.preventDefault()}
      aria-label={`New ${entity} (preview)`}
    >
      <p className={styles.notice}>
        <Info size={16} aria-hidden className={styles.noticeIcon} />
        <span>
          The {entity} API isn&apos;t available yet — this form is a preview of
          the quick-create flow and cannot save anything. Creating {entity}s
          arrives in a later phase.
        </span>
      </p>
      <FormField label={entity === "task" ? "Task title" : "Project name"} required>
        {(props) => (
          <TextInput
            {...props}
            data-autofocus
            placeholder={
              entity === "task" ? "e.g. Prepare weekly report" : "e.g. Website revamp"
            }
          />
        )}
      </FormField>
      <FormField label="Description" hint="Optional">
        {(props) => <TextArea {...props} rows={3} />}
      </FormField>
      {entity === "task" && (
        <FormField label="Priority">
          {(props) => (
            <Select {...props} defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          )}
        </FormField>
      )}
      <div>
        <Badge tone="warning">Save unavailable — API coming in a later phase</Badge>
      </div>
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </form>
  );
}

function InviteMemberForm({ onClose }: { onClose: () => void }) {
  const { selectedWorkspace } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<string>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedWorkspace || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await inviteMember(selectedWorkspace.id, {
      email: email.trim(),
      roleKey,
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    toast({
      title: "Invitation sent",
      description: `${result.data.email} was invited as ${result.data.roleKey}.`,
      tone: "success",
    });
    onClose();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && (
        <p className={styles.errorBanner} role="alert">
          {error}
        </p>
      )}
      <FormField label="Email address" required>
        {(props) => (
          <TextInput
            {...props}
            data-autofocus
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="teammate@company.com"
          />
        )}
      </FormField>
      <FormField label="Role">
        {(props) => (
          <Select
            {...props}
            value={roleKey}
            onChange={(event) => setRoleKey(event.target.value)}
          >
            {INVITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <Button type="submit" loading={submitting} disabled={!email.trim()}>
        Send invitation
      </Button>
    </form>
  );
}

export function QuickCreateDialogs() {
  const { quickCreate, setQuickCreate } = useShell();

  const close = () => setQuickCreate(null);

  return (
    <>
      <Dialog
        open={quickCreate === "task"}
        onClose={close}
        title="New task"
        description="Quickly capture a task in this workspace."
      >
        <PlaceholderCreateForm entity="task" onClose={close} />
      </Dialog>

      <Dialog
        open={quickCreate === "project"}
        onClose={close}
        title="New project"
        description="Group related tasks into a project."
      >
        <PlaceholderCreateForm entity="project" onClose={close} />
      </Dialog>

      <Dialog
        open={quickCreate === "invite"}
        onClose={close}
        title="Invite member"
        description="Invite a teammate to this workspace by email."
      >
        <InviteMemberForm onClose={close} />
      </Dialog>
    </>
  );
}
