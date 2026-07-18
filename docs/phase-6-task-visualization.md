# Phase 6 — Task Visualization, Saved Views & Data Export

## Scope (MVP)

- Shared filter contract across List, Board, Calendar, and Timeline
- URL-synced unsaved view state (`view`, filters, calendar/timeline options)
- Kanban board with fixed statuses + `rank` ordering and `PATCH .../move`
- Calendar (month/week) and Timeline (not Full Gantt) range queries
- Private Saved Views with backend Zod validation
- Synchronous CSV/XLSX export with row limit, formula sanitization, and audit

Out of scope: custom workflows, dependency Full Gantt, shared/pin views, async ExportJob/S3, Calendar/Timeline drag-resize, PDF.

## Data model

- `Task.rank` — gap-based string ranks scoped by `(workspaceId, projectId, status)`
- `SavedView` — private per `(workspaceId, ownerUserId, name)` with JSON config + `configVersion`

## Key APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/tasks/board` | Column by `status`, ordered by `rank` |
| PATCH | `/tasks/:taskId/move` | `{ targetStatus, beforeTaskId?, afterTaskId?, version }` |
| GET | `/tasks/calendar` | `from`/`to` YMD + IANA `timezone` |
| GET | `/tasks/timeline` | Range + `groupBy=project\|assignee` |
| CRUD | `/saved-views` | Owner-private only |
| POST | `/tasks/export` | Streams CSV/XLSX; max 5000 rows; audits `tasks.exported` |

All list-like endpoints reuse `buildTaskListWhere` (visibility + filters + overdue aligned to Phase 4 day boundaries).

## Permissions

- Board/calendar/timeline/export/saved-views read/apply: `tasks:read`
- Move: `tasks:update` + member mutate ACL
- Export does not bypass private-project or member visibility

## Frontend URL keys

- `view=list|board|calendar|timeline`
- Existing filter keys from Phase 5
- `calMode=month|week`, `tlZoom=day|week|month`, `groupBy=project|assignee`
