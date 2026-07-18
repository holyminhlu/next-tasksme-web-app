"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/modules/auth";
import { inviteMember } from "@/modules/onboarding/onboarding.service";
import { SmartCaptureForm, tasksService } from "@/modules/tasks";
import {
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

function CreateProjectForm({ onClose }: { onClose: () => void }) {
  const { selectedWorkspace } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedWorkspace || submitting || !name.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await tasksService.createProject(selectedWorkspace.id, {
      name: name.trim(),
      description: description.trim() || undefined,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(
        result.code === "NOT_FOUND"
          ? "Project creation isn't available yet on this server."
          : result.message,
      );
      return;
    }

    toast({
      title: "Project created",
      description: `"${result.data.name}" is ready for tasks.`,
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
      <FormField label="Project name" required>
        {(props) => (
          <TextInput
            {...props}
            data-autofocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Website revamp"
          />
        )}
      </FormField>
      <FormField label="Description" hint="Optional">
        {(props) => (
          <TextArea
            {...props}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </FormField>
      <Button type="submit" loading={submitting} disabled={!name.trim()}>
        Create project
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
        description="Describe the task in your own words — Smart Capture structures it for you."
        size="lg"
      >
        <SmartCaptureForm onClose={close} />
      </Dialog>

      <Dialog
        open={quickCreate === "project"}
        onClose={close}
        title="New project"
        description="Group related tasks into a project."
      >
        <CreateProjectForm onClose={close} />
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
