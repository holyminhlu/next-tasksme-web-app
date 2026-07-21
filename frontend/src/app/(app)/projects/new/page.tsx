"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Button,
  FormField,
  Select,
  TextInput,
  TextArea,
  useToast,
} from "@/modules/design-system";
import { projectsService, type ProjectPriority, type ProjectStatus } from "@/modules/projects";
import { PageHeader } from "@/modules/shell";
import styles from "../../app-pages.module.css";
import pageStyles from "../projects.module.css";

const STEPS = ["Basics", "Schedule", "Access", "Confirm"];

export default function NewProjectPage() {
  const router = useRouter();
  const { selectedWorkspace, permissions } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;
  const canCreate = hasPermission(permissions, "projects:create");

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNING");
  const [priority, setPriority] = useState<ProjectPriority>("MEDIUM");
  const [visibility, setVisibility] = useState<"WORKSPACE" | "PRIVATE">(
    selectedWorkspace?.type === "PERSONAL" ? "PRIVATE" : "WORKSPACE",
  );
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  if (!canCreate) {
    return (
      <div className={styles.stack}>
        <PageHeader title="New project" />
        <p>You don&apos;t have permission to create projects.</p>
      </div>
    );
  }

  async function handleCreate() {
    if (!workspaceId || !name.trim()) return;
    setBusy(true);
    const result = await projectsService.createProject(workspaceId, {
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
      status,
      priority,
      visibility,
      startAt: startAt ? `${startAt}T00:00:00.000Z` : undefined,
      endAt: endAt ? `${endAt}T23:59:59.000Z` : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      toast({ title: "Couldn't create project", description: result.message, tone: "error" });
      return;
    }
    toast({ title: "Project created", tone: "success" });
    router.push(`/projects/${result.data.id}`);
  }

  return (
    <div className={styles.stack}>
      <PageHeader
        title="New project"
        description="Set up project basics, schedule, and visibility before adding tasks."
      />
      <section className={styles.card}>
        <div className={pageStyles.wizardSteps}>
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={`${pageStyles.wizardStep} ${index === step ? pageStyles.wizardStepActive : ""}`}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>

        {step === 0 && (
          <div className={styles.form}>
            <FormField label="Project name" required>
              {(props) => (
                <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} />
              )}
            </FormField>
            <FormField label="Project code" hint="Optional unique code per workspace">
              {(props) => (
                <TextInput {...props} value={code} onChange={(e) => setCode(e.target.value)} />
              )}
            </FormField>
            <FormField label="Description">
              {(props) => (
                <TextArea
                  {...props}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              )}
            </FormField>
            <div className={pageStyles.formGrid}>
              <FormField label="Status">
                {(props) => (
                  <Select
                    {...props}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                  </Select>
                )}
              </FormField>
              <FormField label="Priority">
                {(props) => (
                  <Select
                    {...props}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </Select>
                )}
              </FormField>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className={pageStyles.formGrid}>
            <FormField label="Start date">
              {(props) => (
                <TextInput
                  {...props}
                  type="date"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="End date">
              {(props) => (
                <TextInput
                  {...props}
                  type="date"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              )}
            </FormField>
          </div>
        )}

        {step === 2 && (
          <FormField label="Visibility">
            {(props) => (
              <Select
                {...props}
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "WORKSPACE" | "PRIVATE")
                }
              >
                <option value="WORKSPACE">Workspace — visible to permitted members</option>
                <option value="PRIVATE">Private — project members only</option>
              </Select>
            )}
          </FormField>
        )}

        {step === 3 && (
          <div className={styles.stack}>
            <p><strong>{name}</strong> {code ? `(${code})` : ""}</p>
            <p>Status: {status} · Priority: {priority}</p>
            <p>Visibility: {visibility}</p>
            {(startAt || endAt) && <p>Schedule: {startAt || "—"} → {endAt || "—"}</p>}
          </div>
        )}

        <div className={styles.formActions}>
          {step > 0 && (
            <Button variant="secondary" disabled={busy} onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button disabled={!name.trim()} onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          ) : (
            <Button disabled={busy || !name.trim()} onClick={() => void handleCreate()}>
              Create project
            </Button>
          )}
          <Link href="/projects">Cancel</Link>
        </div>
      </section>
    </div>
  );
}
