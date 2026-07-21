"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge, Button, ErrorState, FormField, LoadingState, TextArea, TextInput, useToast,
} from "@/modules/design-system";
import { PageHeader } from "@/modules/shell";
import * as templatesService from "@/modules/templates/templates.service";
import type { TemplateContentV2, TemplateRecord } from "@/modules/templates/templates.types";
import styles from "../templates.module.css";

export default function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const { selectedWorkspace, permissions } = useAuth();
  const workspaceId = selectedWorkspace?.id ?? null;
  const { toast } = useToast();
  const [template, setTemplate] = useState<TemplateRecord | null>(null);
  const [versions, setVersions] = useState<TemplateRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industryCode, setIndustryCode] = useState("");
  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [validation, setValidation] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setError(null);
    const [detail, history] = await Promise.all([
      templatesService.getTemplate(workspaceId, templateId),
      templatesService.listTemplateVersions(workspaceId, templateId),
    ]);
    if (!detail.ok) return setError(detail.message);
    setTemplate(detail.data);
    setName(detail.data.name);
    setDescription(detail.data.description ?? "");
    setIndustryCode(detail.data.industryCode ?? "");
    setJson(JSON.stringify(detail.data.contentJson, null, 2));
    if (history.ok) setVersions(history.data);
  }, [workspaceId, templateId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);
  const parsedContent = useMemo(() => {
    try { return JSON.parse(json) as TemplateContentV2; } catch { return null; }
  }, [json]);
  const editable = template?.status === "DRAFT" && template.visibility === "WORKSPACE"
    && hasPermission(permissions, "projects:update");
  const canCreate = hasPermission(permissions, "projects:create");

  async function saveAndValidate() {
    if (!workspaceId || !template || !editable) return;
    let content: TemplateContentV2;
    try {
      content = JSON.parse(json) as TemplateContentV2;
      setJsonError(null);
    } catch (caught) {
      setJsonError(caught instanceof Error ? caught.message : "Invalid JSON");
      return;
    }
    setBusy(true);
    const saved = await templatesService.updateTemplate(workspaceId, template.id, {
      name: name.trim(), description: description.trim() || null,
      industryCode: industryCode.trim() || null, contentJson: content,
    });
    if (!saved.ok) {
      setBusy(false);
      return setJsonError(saved.message);
    }
    const checked = await templatesService.validateTemplate(workspaceId, template.id);
    setBusy(false);
    if (!checked.ok) return setJsonError(checked.message);
    setTemplate(saved.data);
    setValidation(`Server validated schema v${checked.data.schemaVersion} · ${checked.data.contentHash}`);
    toast({ title: "Draft saved and validated", tone: "success" });
  }

  async function lifecycle(kind: "publish" | "archive" | "duplicate" | "version") {
    if (!workspaceId || !template) return;
    setBusy(true);
    const result = kind === "publish"
      ? await templatesService.publishTemplate(workspaceId, template.id)
      : kind === "archive"
        ? await templatesService.archiveTemplate(workspaceId, template.id)
        : kind === "duplicate"
          ? await templatesService.duplicateTemplate(workspaceId, template.id)
          : await templatesService.createTemplateVersion(workspaceId, template.id);
    setBusy(false);
    if (!result.ok) return toast({ title: `Couldn't ${kind} template`, description: result.message, tone: "error" });
    window.location.assign(`/templates/${result.data.id}`);
  }

  if (!workspaceId || (!template && !error)) return <LoadingState label="Loading template…" />;
  if (error || !template) return <ErrorState title="Couldn't load template" description={error ?? "Template not found"} onRetry={() => void load()} />;

  return <>
    <PageHeader title={template.name} description={`Template series ${template.seriesId}`} />
    <main className={styles.page}>
      <div className={styles.actions}>
        <Link href="/templates">← All templates</Link>
        <Badge tone="neutral">{template.status}</Badge>
        <Badge tone={template.visibility === "SYSTEM" ? "primary" : "neutral"}>{template.visibility}</Badge>
        {editable && <Button loading={busy} onClick={() => void saveAndValidate()}>Save & validate</Button>}
        {editable && <Button variant="secondary" disabled={busy} onClick={() => void lifecycle("publish")}>Publish</Button>}
        {template.status === "PUBLISHED" && template.visibility !== "SYSTEM" && <Button variant="secondary" disabled={busy} onClick={() => void lifecycle("version")}>Create new version</Button>}
        {template.visibility !== "SYSTEM" && template.status !== "ARCHIVED" && <Button variant="secondary" disabled={busy} onClick={() => void lifecycle("archive")}>Archive</Button>}
        {canCreate && <Button variant="secondary" disabled={busy} onClick={() => void lifecycle("duplicate")}>Duplicate</Button>}
      </div>
      {!editable && <p role="note" className={styles.validation}>Published, archived, and system templates are immutable. Create a new version or duplicate this template to edit it.</p>}
      <div className={styles.detailGrid}>
        <section className={`${styles.panel} ${styles.form}`} aria-label="Template editor">
          <FormField label="Name" required>{(props) => <TextInput {...props} disabled={!editable} value={name} onChange={(e) => setName(e.target.value)} />}</FormField>
          <FormField label="Description">{(props) => <TextArea {...props} disabled={!editable} value={description} onChange={(e) => setDescription(e.target.value)} />}</FormField>
          <FormField label="Industry code">{(props) => <TextInput {...props} disabled={!editable} value={industryCode} onChange={(e) => setIndustryCode(e.target.value)} />}</FormField>
          <FormField label="Template content (JSON)" error={jsonError} hint="Saving sends the entire document through server validation.">
            {(props) => <TextArea {...props} className={styles.editor} disabled={!editable} value={json} onChange={(e) => { setJson(e.target.value); setValidation(null); }} spellCheck={false} />}
          </FormField>
          {validation && <p role="status" className={styles.validation}>{validation}</p>}
        </section>
        <aside className={styles.page}>
          <section className={styles.panel}>
            <h2>Content preview</h2>
            {!parsedContent ? <p>Fix the JSON to restore the preview.</p> : <>
              <Preview title="Workflow stages" values={parsedContent.workflow?.stages?.map((stage) => `${stage.name} · ${stage.category}`) ?? []} />
              <Preview title="Milestones" values={parsedContent.milestones?.map((item) => item.name) ?? []} />
              <Preview title="Tasks" values={parsedContent.tasks?.map((item) => `${item.title} · ${item.stageKey}`) ?? []} />
              <Preview title="Tags" values={parsedContent.tags?.map((item) => item.name) ?? []} />
              <Preview title="Custom fields" values={parsedContent.customFields?.map((item) => `${item.name} · ${item.fieldType}`) ?? []} />
            </>}
          </section>
          <section className={styles.panel}>
            <h2>Version history</h2>
            <ul className={styles.versionList}>{versions.map((version) => <li key={version.id}>
              <Link href={`/templates/${version.id}`}>{version.version ? `Version ${version.version}` : "Working draft"}</Link>
              {" · "}{version.status}{version.publishedAt ? ` · ${new Date(version.publishedAt).toLocaleDateString()}` : ""}
            </li>)}</ul>
          </section>
        </aside>
      </div>
    </main>
  </>;
}

function Preview({ title, values }: { title: string; values: string[] }) {
  return <div className={styles.previewGroup}><h3>{title} ({values.length})</h3>
    {values.length ? <ul className={styles.previewList}>{values.slice(0, 12).map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul> : <p>None</p>}
    {values.length > 12 && <p>and {values.length - 12} more</p>}
  </div>;
}
