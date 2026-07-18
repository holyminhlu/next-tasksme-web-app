# Phase 4 dashboard metric contract

All dashboard queries require an authenticated, active workspace membership and
are scoped by `workspaceId`. API clients never aggregate dashboard totals from
raw task lists.

## Visibility scope

- `owner`, `admin`, and `manager`: workspace scope when the role includes
  `tasks:read`.
- `member`: only tasks where the current user is `assigneeId` or
  `createdById`.
- `My Work`: always tasks whose `assigneeId` is the current user, regardless of
  role.
- Project and member filters are validated against the current workspace.
  Member filters are unavailable outside workspace scope.
- Soft-deleted tasks/projects and `CANCELLED` tasks are excluded from work
  metrics unless an endpoint explicitly requests cancelled records.

## Date and timezone rules

- `from` and `to` are inclusive local calendar dates in the requested IANA
  timezone.
- `today` is calculated in that timezone, not in the server timezone.
- A task is **Due Today** when it is open and its due date falls between the
  local start and end of today.
- A task is **Overdue** when it is open, has a due date, and that due date is
  earlier than the local start of today.
- A task without a due date is never overdue.
- Relative dates parsed by Smart Capture use the request's `referenceDate`,
  locale, and timezone. Preview responses return an absolute ISO timestamp.

## Stats

- **My Open Tasks**: `TODO` or `IN_PROGRESS` tasks assigned to the current
  user.
- **Open Tasks** in workspace scope: all visible `TODO` or `IN_PROGRESS` tasks.
- **Due Today**: visible open tasks due today.
- **Overdue**: visible open tasks overdue by the rule above.
- **Completed**: visible `DONE` tasks whose `completedAt` falls inside the
  selected range (falls back to `updatedAt` only when `completedAt` is null).
- **Active Projects**: non-deleted projects with status `ACTIVE`.
- **Unassigned Tasks**: workspace-scope open tasks with no `assigneeId`.
- **Blocked Tasks**: visible open tasks with `isBlocked = true`.

The same visibility, status, date, and timezone predicates are reused by stats,
charts, and drill-down lists.

## Activity stream

`ActivityEvent` is a product-facing stream and is separate from `AuditLog`.
Only normalized, non-sensitive resource events are eligible. Every event is
workspace-scoped. Member visibility is limited to events they performed or
events for resources assigned to/created by them.

## Smart Capture

`POST .../tasks/parse` is read-only. It may use deterministic rules and an
optional language model, but model output never supplies database IDs.
Projects and assignees are resolved against the current workspace by the
server, with ambiguous matches returned as candidates. A task is persisted
only after an explicit `POST .../tasks` confirmation and normal permission and
validation checks.
