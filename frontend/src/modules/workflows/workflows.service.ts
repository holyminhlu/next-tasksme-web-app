import { del, get, patch, post, put } from "@/lib/api/client";
import { MAPPING_ERROR, toServiceResult, type ServiceResult } from "@/lib/api/service";
import type {
  CreateWorkflowStageInput,
  ProjectWorkflowState,
  PublishPreview,
  PublishWorkflowInput,
  UpdateWorkflowStageInput,
  WorkflowConditions,
  WorkflowRecord,
  WorkflowStageRecord,
  WorkflowTransitionInput,
  WorkflowTransitionRecord,
  WorkflowValidationIssue,
  WorkflowValidationResult,
} from "./workflows.types";

function requireMapped<T>(result: ServiceResult<T | null>): ServiceResult<T> {
  if (result.ok && result.data === null) return MAPPING_ERROR;
  return result as ServiceResult<T>;
}

function ws(workspaceId: string, projectId: string, suffix = "") {
  return `/workspaces/${workspaceId}/projects/${projectId}/workflow${suffix}`;
}

function mapStage(raw: unknown): WorkflowStageRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string") return null;
  return {
    id: item.id,
    workflowId: String(item.workflowId ?? ""),
    name: String(item.name ?? ""),
    category: item.category as WorkflowStageRecord["category"],
    color: typeof item.color === "string" ? item.color : null,
    position: Number(item.position ?? 0),
    isInitial: Boolean(item.isInitial),
    isTerminal: Boolean(item.isTerminal),
    isActive: item.isActive !== false,
  };
}

function mapConditions(raw: unknown): WorkflowConditions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as WorkflowConditions;
}

function mapTransition(raw: unknown): WorkflowTransitionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.fromStageId !== "string" ||
    typeof item.toStageId !== "string"
  ) {
    return null;
  }
  return {
    id: item.id,
    workflowId: String(item.workflowId ?? ""),
    fromStageId: item.fromStageId,
    toStageId: item.toStageId,
    requiredPermission:
      typeof item.requiredPermission === "string" ? item.requiredPermission : null,
    conditionsJson: mapConditions(item.conditionsJson),
  };
}

function mapWorkflow(raw: unknown): WorkflowRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string") return null;
  const stages = Array.isArray(item.stages)
    ? item.stages.map(mapStage).filter(Boolean)
    : [];
  const transitions = Array.isArray(item.transitions)
    ? item.transitions.map(mapTransition).filter(Boolean)
    : [];
  return {
    id: item.id,
    familyId: String(item.familyId ?? ""),
    workspaceId: String(item.workspaceId ?? ""),
    sourceProjectId:
      typeof item.sourceProjectId === "string" ? item.sourceProjectId : null,
    name: String(item.name ?? ""),
    version: Number(item.version ?? 0),
    status: item.status as WorkflowRecord["status"],
    stages: stages as WorkflowStageRecord[],
    transitions: transitions as WorkflowTransitionRecord[],
  };
}

function mapPreview(raw: unknown): PublishPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const currentStages = Array.isArray(item.currentStages) ? item.currentStages : [];
  const requiredStageMappings = Array.isArray(item.requiredStageMappings)
    ? item.requiredStageMappings
    : currentStages.filter(
        (stage) =>
          stage &&
          typeof stage === "object" &&
          Number((stage as Record<string, unknown>).taskCount ?? 0) > 0,
      );
  return {
    taskCount: Number(item.taskCount ?? 0),
    currentStages: currentStages as PublishPreview["currentStages"],
    requiredStageMappings:
      requiredStageMappings as PublishPreview["requiredStageMappings"],
    legacyStatusCounts: Array.isArray(item.legacyStatusCounts)
      ? (item.legacyStatusCounts as PublishPreview["legacyStatusCounts"])
      : [],
    requiresMapping: Boolean(item.requiresMapping),
  };
}

function mapState(raw: unknown): ProjectWorkflowState | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  return {
    published: item.published ? mapWorkflow(item.published) : null,
    draft: item.draft ? mapWorkflow(item.draft) : null,
    appliedVersion:
      typeof item.appliedVersion === "number" ? item.appliedVersion : null,
  };
}

export async function getProjectWorkflow(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<ProjectWorkflowState>> {
  return requireMapped(
    toServiceResult(await get<unknown>(ws(workspaceId, projectId)), mapState),
  );
}

export async function createWorkflowDraft(
  workspaceId: string,
  projectId: string,
): Promise<ServiceResult<WorkflowRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, projectId, "/draft"), {}),
      mapWorkflow,
    ),
  );
}

export async function getWorkflowDraft(
  workspaceId: string,
  projectId: string,
  workflowId: string,
): Promise<ServiceResult<WorkflowRecord>> {
  return requireMapped(
    toServiceResult(
      await get<unknown>(ws(workspaceId, projectId, `/drafts/${workflowId}`)),
      mapWorkflow,
    ),
  );
}

export async function getPublishPreview(
  workspaceId: string,
  projectId: string,
  workflowId: string,
): Promise<ServiceResult<PublishPreview>> {
  return requireMapped(
    toServiceResult(
      await get<unknown>(ws(workspaceId, projectId, `/drafts/${workflowId}/publish-preview`)),
      mapPreview,
    ),
  );
}

export async function publishWorkflow(
  workspaceId: string,
  projectId: string,
  input: PublishWorkflowInput,
): Promise<ServiceResult<{ workflowId: string; workflowVersion: number; movedTasks: number }>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, projectId, "/publish"), input),
      (data) =>
        data && typeof data === "object"
          ? {
              workflowId: String((data as Record<string, unknown>).workflowId ?? ""),
              workflowVersion: Number((data as Record<string, unknown>).workflowVersion ?? 0),
              movedTasks: Number((data as Record<string, unknown>).movedTasks ?? 0),
            }
          : null,
    ),
  );
}

export async function addStage(
  workspaceId: string,
  projectId: string,
  workflowId: string,
  input: CreateWorkflowStageInput,
): Promise<ServiceResult<WorkflowStageRecord>> {
  return requireMapped(
    toServiceResult(
      await post<unknown>(ws(workspaceId, projectId, `/drafts/${workflowId}/stages`), input),
      mapStage,
    ),
  );
}

export async function updateStage(
  workspaceId: string,
  projectId: string,
  workflowId: string,
  stageId: string,
  input: UpdateWorkflowStageInput,
): Promise<ServiceResult<WorkflowStageRecord>> {
  return requireMapped(
    toServiceResult(
      await patch<unknown>(
        ws(workspaceId, projectId, `/drafts/${workflowId}/stages/${stageId}`),
        input,
      ),
      mapStage,
    ),
  );
}

export async function deleteStage(
  workspaceId: string,
  projectId: string,
  workflowId: string,
  stageId: string,
  moveToStageId?: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  void moveToStageId;
  return requireMapped(
    toServiceResult(
      await del<unknown>(ws(workspaceId, projectId, `/drafts/${workflowId}/stages/${stageId}`)),
      (data) => ({ deleted: Boolean((data as { deleted?: boolean })?.deleted) }),
    ),
  );
}

export async function reorderStages(
  workspaceId: string,
  projectId: string,
  workflowId: string,
  stageIds: string[],
): Promise<ServiceResult<WorkflowRecord>> {
  return requireMapped(
    toServiceResult(
      await put<unknown>(
        ws(workspaceId, projectId, `/drafts/${workflowId}/stages/reorder`),
        { stageIds },
      ),
      mapWorkflow,
    ),
  );
}

export async function saveTransitions(
  workspaceId: string,
  projectId: string,
  workflowId: string,
  transitions: WorkflowTransitionInput[],
): Promise<ServiceResult<WorkflowRecord>> {
  return requireMapped(
    toServiceResult(
      await put<unknown>(
        ws(workspaceId, projectId, `/drafts/${workflowId}/transitions`),
        { transitions },
      ),
      mapWorkflow,
    ),
  );
}

function validationIssues(details: unknown, fallback: string): WorkflowValidationIssue[] {
  if (!details || typeof details !== "object") return [{ message: fallback }];
  const value = details as Record<string, unknown>;
  const metadata =
    value.metadata && typeof value.metadata === "object"
      ? (value.metadata as Record<string, unknown>)
      : {};
  const rawIssues = Array.isArray(metadata.issues) ? metadata.issues : [];
  if (rawIssues.length > 0) {
    return rawIssues.map((issue) => {
      const record =
        issue && typeof issue === "object" ? (issue as Record<string, unknown>) : {};
      return {
        message: String(record.message ?? fallback),
        path: Array.isArray(record.path)
          ? (record.path as Array<string | number>)
          : undefined,
      };
    });
  }
  return [
    {
      message: fallback,
      field: typeof value.field === "string" ? value.field : undefined,
    },
  ];
}

export async function validateWorkflowDraft(
  workspaceId: string,
  projectId: string,
  workflowId: string,
): Promise<ServiceResult<WorkflowValidationResult>> {
  const envelope = await post<{ valid: true }>(
    ws(workspaceId, projectId, `/drafts/${workflowId}/validate`),
    {},
  );
  if (envelope.success) {
    return { ok: true, data: { valid: true, issues: [] } };
  }
  if (envelope.error.code === "VALIDATION_ERROR") {
    return {
      ok: true,
      data: {
        valid: false,
        issues: validationIssues(envelope.error.details, envelope.error.message),
      },
    };
  }
  return {
    ok: false,
    code: envelope.error.code,
    message: envelope.error.message,
  };
}
