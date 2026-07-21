"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { hasPermission, useAuth, type WorkspaceMemberSummary } from "@/modules/auth";
import {
  Badge, Button, Dialog, EmptyState, ErrorState, FormField, LoadingState,
  Pagination, Select, TextInput, useToast,
} from "@/modules/design-system";
import { PageHeader } from "@/modules/shell";
import { listMembers } from "@/modules/workspaces/members.service";
import {
  cloneJobDisposition, clonePollDelay, getOrCreateIdempotencyKey,
} from "@/modules/templates/templates.helpers";
import * as templatesService from "@/modules/templates/templates.service";
import type {
  CloneJobRecord, TemplateRecord, TemplateStatus, TemplateVisibility,
} from "@/modules/templates/templates.types";
import styles from "./templates.module.css";

const ACTIVE_JOB_KEY = "templates:active-clone-job";

export default function TemplatesPage() {
  const { selectedWorkspace, permissions } = useAuth();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;
  const canCreate = hasPermission(permissions, "projects:create");
  const canUpdate = hasPermission(permissions, "projects:update");
  const [items, setItems] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | TemplateStatus>("");
  const [visibility, setVisibility] = useState<"" | TemplateVisibility>("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [cloneTemplate, setCloneTemplate] = useState<TemplateRecord | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [startAt, setStartAt] = useState("");
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [job, setJob] = useState<CloneJobRecord | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pollAttempt = useRef(0);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    const result = await templatesService.listTemplates(workspaceId, {
      search: search.trim() || undefined, status: status || undefined,
      visibility: visibility || undefined, page, pageSize: 12,
    });
    setLoading(false);
    if (!result.ok) return setError(result.message);
    setItems(result.data.items);
    setPageCount(result.data.totalPages);
  }, [workspaceId, search, status, visibility, page]);

  useEffect(() => { const id = window.setTimeout(() => void load(), 250); return () => clearTimeout(id); }, [load]);
  useEffect(() => {
    const id = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(id);
  }, [search, status, visibility]);
  useEffect(() => {
    if (!workspaceId) return;
    void listMembers(workspaceId).then((result) => {
      if (result.success) setMembers(result.data.filter((member) => member.status === "ACTIVE"));
    });
  }, [workspaceId]);

  const poll = useCallback(async function pollCloneJob(id: string) {
    if (!workspaceId) return;
    const result = await templatesService.getCloneJob(workspaceId, id);
    if (!result.ok) {
      timer.current = window.setTimeout(
        () => void pollCloneJob(id),
        clonePollDelay(++pollAttempt.current, document.hidden),
      );
      return;
    }
    setJob(result.data);
    const disposition = cloneJobDisposition(result.data.status);
    if (disposition === "poll") {
      timer.current = window.setTimeout(
        () => void pollCloneJob(id),
        clonePollDelay(pollAttempt.current++, document.hidden),
      );
    } else {
      sessionStorage.removeItem(ACTIVE_JOB_KEY);
      if (disposition !== "retryable") {
        sessionStorage.removeItem(`template-clone-key:${result.data.templateId}`);
      }
      setBusyId(null);
      if (disposition === "completed" && result.data.projectId) window.location.assign(`/projects/${result.data.projectId}`);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const id = sessionStorage.getItem(ACTIVE_JOB_KEY);
    if (id) void poll(id);
    return () => { if (timer.current !== null) clearTimeout(timer.current); };
  }, [workspaceId, poll]);

  function openClone(template: TemplateRecord) {
    setCloneTemplate(template);
    setProjectName(template.name);
    setProjectCode("");
    setStartAt("");
    setBindings({});
    setJob(null);
    getOrCreateIdempotencyKey(sessionStorage, template.id, () => crypto.randomUUID());
  }

  async function startClone() {
    if (!workspaceId || !cloneTemplate || !projectName.trim()) return;
    const missing = cloneTemplate.contentJson.memberPlaceholders.find((p) => p.required && !bindings[p.key]);
    if (missing) return toast({ title: `Choose a member for ${missing.name}`, tone: "error" });
    setBusyId(cloneTemplate.id);
    const result = await templatesService.cloneTemplate(workspaceId, cloneTemplate.id, {
      projectName: projectName.trim(),
      projectCode: projectCode.trim() || undefined,
      startAt: startAt ? new Date(`${startAt}T00:00:00`).toISOString() : undefined,
      memberBindings: bindings,
      idempotencyKey: getOrCreateIdempotencyKey(sessionStorage, cloneTemplate.id, () => crypto.randomUUID()),
    });
    if (!result.ok) {
      setBusyId(null);
      return toast({ title: "Couldn't create project", description: result.message, tone: "error" });
    }
    sessionStorage.setItem(ACTIVE_JOB_KEY, result.data.cloneJobId);
    pollAttempt.current = 0;
    void poll(result.data.cloneJobId);
  }

  async function action(template: TemplateRecord, kind: "publish" | "archive" | "duplicate") {
    if (!workspaceId) return;
    setBusyId(template.id);
    const result = kind === "publish"
      ? await templatesService.publishTemplate(workspaceId, template.id)
      : kind === "archive"
        ? await templatesService.archiveTemplate(workspaceId, template.id)
        : await templatesService.duplicateTemplate(workspaceId, template.id);
    setBusyId(null);
    if (!result.ok) return toast({ title: `Couldn't ${kind} template`, description: result.message, tone: "error" });
    if (kind === "duplicate") window.location.assign(`/templates/${result.data.id}`);
    else void load();
  }

  if (!workspaceId) return <LoadingState label="Loading workspace…" />;
  return <>
    <PageHeader title="Project templates" description="Manage reusable, versioned project structures." />
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <TextInput aria-label="Search templates" placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as "" | TemplateStatus)}>
          <option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option>
        </Select>
        <Select aria-label="Filter by visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as "" | TemplateVisibility)}>
          <option value="">All visibility</option><option value="WORKSPACE">Workspace</option><option value="SYSTEM">System</option>
        </Select>
        {canCreate && <Button onClick={async () => {
          const result = await templatesService.createTemplate(workspaceId, { name: "Untitled template" });
          if (result.ok) window.location.assign(`/templates/${result.data.id}`);
          else toast({ title: "Couldn't create template", description: result.message, tone: "error" });
        }}>New template</Button>}
      </div>
      {job && <section className={styles.job} role="status" aria-live="polite">
        <div><strong>Project creation: {job.status.replace("_", " ").toLowerCase()}</strong><span>{job.progress}%</span></div>
        <progress value={job.progress} max={100}>{job.progress}%</progress>
        {job.errorMessage && <p>{job.errorMessage}</p>}
        {cloneJobDisposition(job.status) === "retryable" && <Button variant="secondary" onClick={async () => {
          const result = await templatesService.retryCloneJob(workspaceId, job.id);
          if (result.ok) { sessionStorage.setItem(ACTIVE_JOB_KEY, job.id); setJob(result.data); void poll(job.id); }
        }}>Retry clone</Button>}
      </section>}
      {loading ? <LoadingState label="Loading templates…" /> : error
        ? <ErrorState title="Couldn't load templates" description={error} onRetry={() => void load()} />
        : items.length === 0 ? <EmptyState title="No templates found" description="Change your filters or create a draft template." />
        : <div className={styles.grid}>{items.map((template) => <article className={styles.card} key={template.id}>
          <div className={styles.cardHeader}><Link href={`/templates/${template.id}`}><strong>{template.name}</strong></Link><Badge tone={template.visibility === "SYSTEM" ? "primary" : "neutral"}>{template.visibility}</Badge></div>
          <p>{template.description || "No description"}</p>
          <div className={styles.meta}><Badge tone="neutral">{template.status}</Badge><span>{template.version ? `Version ${template.version}` : "Working draft"}</span></div>
          <div className={styles.actions}>
            {canCreate && template.status === "PUBLISHED" && <Button onClick={() => openClone(template)}>Use template</Button>}
            {canCreate && <Button variant="secondary" disabled={busyId === template.id} onClick={() => void action(template, "duplicate")}>Duplicate</Button>}
            {canUpdate && template.status === "DRAFT" && template.visibility !== "SYSTEM" && <Button variant="secondary" onClick={() => void action(template, "publish")}>Publish</Button>}
            {canUpdate && template.status !== "ARCHIVED" && template.visibility !== "SYSTEM" && <Button variant="secondary" onClick={() => void action(template, "archive")}>Archive</Button>}
          </div>
        </article>)}</div>}
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} aria-label="Template pages" />
    </main>
    <Dialog open={Boolean(cloneTemplate)} onClose={() => !busyId && setCloneTemplate(null)} title={`Use ${cloneTemplate?.name ?? "template"}`} description="Create a project from this published snapshot." footer={<><Button variant="secondary" onClick={() => setCloneTemplate(null)}>Cancel</Button><Button loading={Boolean(busyId)} onClick={() => void startClone()}>Create project</Button></>}>
      <div className={styles.form}>
        <FormField label="Project name" required>{(props) => <TextInput {...props} value={projectName} onChange={(e) => setProjectName(e.target.value)} />}</FormField>
        <FormField label="Project code" hint="Optional; letters, numbers, hyphens and underscores.">{(props) => <TextInput {...props} value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />}</FormField>
        <FormField label="Start date">{(props) => <TextInput {...props} type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />}</FormField>
        {cloneTemplate?.contentJson.memberPlaceholders.map((placeholder) => <FormField key={placeholder.key} label={placeholder.name} required={placeholder.required} hint={placeholder.projectRole.replaceAll("_", " ").toLowerCase()}>{(props) => <Select {...props} value={bindings[placeholder.key] ?? ""} onChange={(e) => setBindings((old) => ({ ...old, [placeholder.key]: e.target.value }))}><option value="">Unassigned</option>{members.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.fullName || member.user.email}</option>)}</Select>}</FormField>)}
      </div>
    </Dialog>
  </>;
}
