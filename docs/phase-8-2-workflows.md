# Phase 8.2 — Project Workflows, Templates & Hierarchy

Phase 8.2 provides per-project workflows, conditional task transitions, atomic
workflow publishing, versioned V2 templates, durable project cloning,
milestones, and task hierarchy.

All paths below are relative to `/api/v1/workspaces/:workspaceId`. Every
endpoint requires `Authorization: Bearer <access-token>`, an active workspace
membership, and tenant context. Read operations require `projects:read`.
Workflow, milestone, template lifecycle, and editing operations require
`projects:update`; template creation, duplication, cloning, and clone retry
require `projects:create`. Project visibility and project-role checks apply in
addition to workspace permissions. APIs return `401` for missing or invalid
authentication, `403` for insufficient permission or project access, `404`
for resources outside the tenant/project scope, `400` for validation/domain
rules, and `409` for publish, idempotency, or clone-job state conflicts.

## Workflows

`Workflow`, `WorkflowStage`, `WorkflowTransition`, and `ProjectWorkflow` store
the versioned definition and the version applied to a project. New projects
receive a published default workflow. `Task.workflowStageId` is authoritative;
legacy `Task.status` remains synchronized for compatibility with existing
views and reports.

Stage categories are `BACKLOG`, `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`,
`COMPLETED`, and `CANCELLED`.

Workflow builder APIs:

- `GET /projects/:projectId/workflow` — published workflow, current draft, and
  applied version.
- `POST /projects/:projectId/workflow/draft` — return the existing draft or
  clone the published definition into an editable draft (`201`).
- `GET /projects/:projectId/workflow/drafts/:workflowId` — draft stages and
  transitions.
- `GET /projects/:projectId/workflow/drafts/:workflowId/publish-preview` —
  task counts, legacy statuses, and required source-stage mappings.
- `POST /projects/:projectId/workflow/drafts/:workflowId/validate` — validate
  stage and transition invariants.
- `POST /projects/:projectId/workflow/drafts/:workflowId/stages` — add a stage
  (`201`).
- `PATCH /projects/:projectId/workflow/drafts/:workflowId/stages/:stageId` —
  update a stage.
- `DELETE /projects/:projectId/workflow/drafts/:workflowId/stages/:stageId` —
  delete a stage; `moveToStageId` remaps references when required.
- `PUT /projects/:projectId/workflow/drafts/:workflowId/stages/reorder` —
  provide every draft stage ID exactly once.
- `PUT /projects/:projectId/workflow/drafts/:workflowId/transitions` —
  atomically replace transitions.
- `POST /projects/:projectId/workflow/publish` — publish with
  `draftWorkflowId`, `stageMappings`, and `legacyStatusMappings`.

Publish validates the complete draft, requires mappings for every source used
by a task, creates the next immutable published version, migrates tasks and
status history, updates the `ProjectWorkflow` pointer, and removes the draft
in one database transaction. Any failure rolls back all changes.

Task creation selects the project's initial active stage. Task move accepts
`targetStageId` (preferred) or legacy `targetStatus`. A transition must exist,
its optional `requiredPermission` must be present, and every condition must
pass before the move is committed.

### Transition condition DSL

`conditionsJson: {}` is unconditional. Conditional transitions use:

```json
{
  "version": 1,
  "all": [
    { "field": "task.assigneeId", "operator": "isSet" },
    { "field": "task.priority", "operator": "in", "value": ["HIGH", "URGENT"] },
    { "field": "task.checklistComplete", "operator": "eq", "value": true }
  ]
}
```

`all` contains 1–20 clauses. Supported fields/operators are:

- `task.assigneeId`: `isSet` or `isNotSet`
- `task.priority`: `eq` with one priority or `in` with 1–4 priorities
- `task.isBlocked`, `task.checklistComplete`, and
  `task.dependenciesComplete`: `eq` with a boolean

Unknown fields, operators, extra properties, or unsupported DSL versions are
rejected.

## V2 project templates

Template APIs:

- `GET|POST /templates` — list visible workspace/published system templates,
  or create a workspace draft (`201`).
- `GET|PATCH /templates/:templateId` — read a visible template or update an
  owned draft.
- `POST /templates/:templateId/validate` — validate V2 content and return its
  canonical SHA-256 content hash.
- `POST /templates/:templateId/publish` — validate and create the next
  immutable published series version; the previous published version is
  archived.
- `POST|GET /templates/:templateId/versions` — create/return the editable
  version-zero draft (`201`) or list the series.
- `POST /templates/:templateId/archive` — archive an owned template.
- `POST /templates/:templateId/duplicate` — create a workspace draft copy
  (`201`), including from a visible system template.
- `POST /templates/:templateId/clone` — accept an idempotent clone (`202`).
- `GET /templates/clone-jobs/:cloneJobId` — read durable progress/result.
- `POST /templates/clone-jobs/:cloneJobId/retry` — requeue a `FAILED` or
  `DEAD` job.

`contentJson.schemaVersion` is exactly `2`. Content includes project settings,
member placeholders and project roles, workflow stages/transitions and
conditions, tags, custom-field definitions/values, milestones, hierarchical
tasks, checklist items, and finish-to-start dependencies. Stable keys connect
all references. Validation enforces unique keys/names/positions, exactly one
initial and terminal stage, known references, and acyclic task-parent and
dependency graphs.

## Durable cloning

Clone requests require `projectName`, an 8–128 character `idempotencyKey`, and
optional `projectCode`, `startAt`, and member-placeholder bindings. Reusing a
key with the same canonical request returns the existing job/project; reusing
it for different input returns `409`.

Templates with at most 100 tasks are materialized synchronously while still
returning `202` and a completed durable job. Larger templates are processed by
workers. Job states are `PENDING`, `PROCESSING`, `RETRY_WAIT`, `COMPLETED`,
`FAILED`, and `DEAD`. Workers claim jobs with expiring leases, heartbeat
progress, reclaim abandoned leases, exponentially back off transient failures,
and support explicit retry after terminal failure.

Cloning snapshots the template content hash and atomically creates the project,
bound project members, workflow and transitions, tags, custom fields,
milestones, tasks and parent relationships, checklist items, custom values,
task tags, and dependencies. Relative start/due offsets use the workspace
timezone. A project is linked to its source clone job to make materialization
replay-safe.

## Milestones and task hierarchy

Milestone APIs:

- `GET|POST /projects/:projectId/milestones`
- `PUT /projects/:projectId/milestones/reorder`
- `GET|PATCH|DELETE /projects/:projectId/milestones/:milestoneId`

Milestones support ordered positions, planned/in-progress/completed/cancelled
states, optional start/due dates, automatic completion timestamps, creator
summary, and task count.

Task create/update accepts `parentTaskId`, `subtaskPosition`, and
`milestoneId`. Parent and milestone must belong to the same workspace and
project. Hierarchy is cycle-free and limited to five levels. Moving a task to
another project clears hierarchy links that cannot safely cross project
boundaries. Task detail includes parent, ordered subtasks, and milestone
summary.

## UI and migrations

- Project detail includes the **Workflow** panel.
- `/templates` provides template browsing and cloning.
- Migrations:
  `20260720170000_phase82_workflow_data_model`,
  `20260720180000_phase82_templates_and_workflow_project`, and
  `20260721150000_phase83_workflow_template_execution_hardening`.

Known Phase 8.2 API limitations: none.
