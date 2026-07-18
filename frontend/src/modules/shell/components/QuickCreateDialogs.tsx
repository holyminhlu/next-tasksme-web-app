"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/modules/auth";
import { inviteMember } from "@/modules/onboarding/onboarding.service";
import { SmartCaptureForm, CreateTaskForm, tasksService } from "@/modules/tasks";
import { listMembers } from "@/modules/workspaces/members.service";
import {
  Button,
  Checkbox,
  Dialog,
  FormField,
  Select,
  TextArea,
  TextInput,
  useToast,
} from "@/modules/design-system";
import type { ProjectVisibility } from "@/modules/tasks";
import { useShell } from "../ShellProvider";
import styles from "./QuickCreate.module.css";

const INVITABLE_ROLES = ["admin", "manager", "member"] as const;

type WorkspaceMemberOption = {
  userId: string;
  fullName: string;
  roleKey: string;
};

function CreateProjectForm({ onClose }: { onClose: () => void }) {
  const { selectedWorkspace, profile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ProjectVisibility>("WORKSPACE");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceMemberOption[]
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedWorkspace) {
      return;
    }

    let cancelled = false;
    void listMembers(selectedWorkspace.id).then((result) => {
      if (cancelled || !result.success) {
        return;
      }

      setWorkspaceMembers(
        result.data
          .filter((member) => member.status === "ACTIVE")
          .map((member) => ({
            userId: member.user.id,
            fullName: member.user.fullName,
            roleKey: member.role.key,
          })),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [selectedWorkspace]);

  const filteredMembers = useMemo(() => {
    const needle = memberQuery.trim().toLowerCase();
    const others = workspaceMembers.filter(
      (member) => member.userId !== profile?.id,
    );

    if (!needle) {
      return others;
    }

    return others.filter((member) => {
      const haystack = `${member.fullName} ${member.roleKey}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [workspaceMembers, memberQuery, profile?.id]);

  function toggleMember(userId: string) {
    setMemberIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

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
      visibility,
      memberIds: visibility === "PRIVATE" ? memberIds : [],
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
      description:
        result.data.visibility === "PRIVATE"
          ? `"${result.data.name}" is private to its members.`
          : `"${result.data.name}" is ready for tasks.`,
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
      <FormField
        label="Visibility"
        hint={
          visibility === "PRIVATE"
            ? "Only selected members can see this project. You are included automatically."
            : "Everyone in the workspace can see this project."
        }
      >
        {(props) => (
          <Select
            {...props}
            value={visibility}
            onChange={(event) =>
              setVisibility(event.target.value as ProjectVisibility)
            }
          >
            <option value="WORKSPACE">Workspace</option>
            <option value="PRIVATE">Private</option>
          </Select>
        )}
      </FormField>

      {visibility === "PRIVATE" && (
        <div className={styles.memberPicker}>
          <FormField
            label="Members"
            hint="Search ACTIVE workspace members. Creator is added on the server."
          >
            {(props) => (
              <TextInput
                {...props}
                type="search"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="Search people…"
              />
            )}
          </FormField>
          {profile && (
            <p className={styles.memberHint}>
              You ({profile.fullName}) are always a member.
            </p>
          )}
          <ul className={styles.memberList}>
            {filteredMembers.length === 0 ? (
              <li className={styles.memberEmpty}>No matching members</li>
            ) : (
              filteredMembers.map((member) => (
                <li key={member.userId}>
                  <Checkbox
                    label={`${member.fullName} · ${member.roleKey}`}
                    checked={memberIds.includes(member.userId)}
                    onChange={() => toggleMember(member.userId)}
                  />
                </li>
              ))
            )}
          </ul>
        </div>
      )}

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
  const { quickCreate, quickCreateOptions, setQuickCreate } = useShell();
  const [manualTaskMode, setManualTaskMode] = useState<"smart" | "full" | null>(
    null,
  );
  const preferFullForm = Boolean(quickCreateOptions?.initialDueDate);
  const taskMode = manualTaskMode ?? (preferFullForm ? "full" : "smart");

  const close = () => {
    setQuickCreate(null);
    setManualTaskMode(null);
  };

  return (
    <>
      <Dialog
        open={quickCreate === "task"}
        onClose={close}
        title="New task"
        description={
          taskMode === "smart"
            ? "Describe the task in your own words — Smart Capture structures it for you."
            : "Fill in the full task form with status, dates, project, and assignee."
        }
        size="lg"
      >
        <div className={styles.modeTabs} role="tablist" aria-label="Create mode">
          <button
            type="button"
            role="tab"
            aria-selected={taskMode === "smart"}
            className={`${styles.modeTab} ${taskMode === "smart" ? styles.modeTabActive : ""}`.trim()}
            onClick={() => setManualTaskMode("smart")}
          >
            Smart Capture
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={taskMode === "full"}
            className={`${styles.modeTab} ${taskMode === "full" ? styles.modeTabActive : ""}`.trim()}
            onClick={() => setManualTaskMode("full")}
          >
            Full form
          </button>
        </div>
        {taskMode === "smart" ? (
          <SmartCaptureForm onClose={close} />
        ) : (
          <CreateTaskForm
            onClose={close}
            initialDueDate={quickCreateOptions?.initialDueDate}
          />
        )}
      </Dialog>

      <Dialog
        open={quickCreate === "project"}
        onClose={close}
        title="New project"
        description="Group related tasks into a project. Private projects limit visibility to members."
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
