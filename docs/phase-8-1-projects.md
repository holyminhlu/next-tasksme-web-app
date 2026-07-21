# Phase 8.1 — Project lifecycle & membership

## Scope delivered

- Project lifecycle schema upgrade with status, priority, manager, schedule, completion policy, and archival fields.
- Full project API for CRUD, archive/unarchive, soft-delete/restore, membership add/update/remove/replace, visibility, and eligible assignees.
- Project access enforcement integrated with task flows and private-project visibility.
- Lifecycle guardrails for completion (open tasks, running timers, blocked dependencies) with override support.
- Activity + audit records for status transitions, plus `PROJECT_STATUS_CHANGED` notifications.
- Workspace notification preference now supports `projectStatusChanged` toggle.
- Frontend projects list supports search, status/manager/member/date filters, active/archived/trash scopes, and pagination.
- Frontend project details include settings editing, member role management, and project activity feed wiring.

## Important behavior

- Soft-deleted projects are excluded by default and can be queried via `includeDeleted`/`deletedOnly`.
- Archived scope and trash scope are independent:
  - archived scope filters by `status = ARCHIVED`
  - trash scope filters by `deletedAt IS NOT NULL`
- Status-change notification is sent to manager (fallback creator) only when `projectStatusChanged` preference is enabled.

## API/OpenAPI

- OpenAPI version updated to `8.1.0`.
- Project endpoint docs now include:
  - `PATCH /projects/{projectId}`
  - `POST /projects/{projectId}/archive`
  - `POST /projects/{projectId}/unarchive`
  - `DELETE /projects/{projectId}`
  - `POST /projects/{projectId}/restore`
  - `POST /projects/{projectId}/members`
  - `PATCH /projects/{projectId}/members/{memberUserId}`
  - `DELETE /projects/{projectId}/members/{memberUserId}`

## Migration

- `20260720150000_phase81_project_lifecycle`
- `20260720160000_phase81_project_status_notification_pref`
