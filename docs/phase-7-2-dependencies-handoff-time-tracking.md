# Phase 7.2 — Dependencies, Handoff & Time Tracking

## Scope

Phase 7.2 adds directed `FINISH_TO_START` task dependencies, policy-aware
completion, idempotent handoff, server-persisted timers, manual time logs, and
task status history.

## Dependency behavior

- A dependency is stored as `predecessorTaskId → successorTaskId`.
- Self-dependencies, duplicates, cross-workspace links, inaccessible tasks, and
  cycles are rejected by the backend.
- An unfinished predecessor blocks a successor with a dependency-specific
  `BLOCKED` state.
- The default workspace completion policy is `WARN_ONLY`.
- `BLOCK_WITH_OVERRIDE` requires `task_dependency.override` and an override
  reason. The override is persisted and written to the audit log.

When a predecessor reaches `DONE`, the backend checks every predecessor of each
successor in the same transaction. A dependency-blocked successor returns to
`TODO` only after all predecessors are `DONE`; it never moves automatically to
`IN_PROGRESS`. Notification dedupe keys prevent repeated handoff notifications.

## Time tracking

- Running timers are database records with `endedAt = null`.
- A partial unique index enforces one running timer per user per workspace.
- Manual and edited logs reject negative intervals and overlap with any existing
  log for that user.
- Team totals require `time_log.view_all`; management of another user's logs
  requires `time_log.manage_all`.

## Stage history

Every task status mutation through Task Core, board movement, dependency block,
dependency release, and handoff writes `TaskStatusHistory`. Each transition
stores the duration in the previous status. The history API returns per-status
totals, lead time, and basic cycle time.

## API

- `GET|POST /api/v1/workspaces/:workspaceId/tasks/:taskId/dependencies`
- `DELETE /api/v1/workspaces/:workspaceId/tasks/:taskId/dependencies/:dependencyId`
- `GET|POST /api/v1/workspaces/:workspaceId/tasks/:taskId/time-logs`
- `PATCH|DELETE /api/v1/workspaces/:workspaceId/tasks/:taskId/time-logs/:timeLogId`
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/time-logs/timer/start`
- `POST /api/v1/workspaces/:workspaceId/tasks/:taskId/time-logs/timer/stop`
- `GET /api/v1/workspaces/:workspaceId/timers/running`
- `GET /api/v1/workspaces/:workspaceId/tasks/:taskId/status-history`

OpenAPI version: `7.2.0`.
