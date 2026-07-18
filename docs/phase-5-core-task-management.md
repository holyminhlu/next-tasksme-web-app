# Phase 5 — Core Task Management & Assignment

Phase 5 is an additive backend release. It preserves `dueDate` and Smart Capture while adding task numbering, private projects, assignment controls, concurrency, lifecycle operations, notifications, and richer task queries.

## Data model

- `Project.visibility`: `WORKSPACE` (default) or `PRIVATE`.
- `ProjectMember`: membership for private projects; a private project's creator is always inserted.
- `Task.taskNumber`: concurrency-safe, workspace-scoped integer generated through `WorkspaceTaskCounter`.
- `Task.startAt`, `completedById`, `version`, `archivedAt`.
- Statuses: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`, `DONE`, `CANCELLED`.
- Open statuses: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `BLOCKED`.
- `isBlocked` is synchronized with `status === BLOCKED`.
- `Notification` and `NotificationPreference` persist assignment notifications. The default `taskAssigned` preference is enabled.

Private project tasks are visible only to project members, except workspace owners/admins acting as administrators. Managers do not bypass private membership. Assignees of private project tasks must be project members.

Task numbers have no database sequence/default. Every persisted task path, including onboarding, allocates an explicit workspace-scoped number by atomically incrementing `WorkspaceTaskCounter`.

## Task endpoints

All paths are under `/api/v1/workspaces/{workspaceId}`.

- `GET /tasks`: paginated list.
- `POST /tasks`: create.
- `GET /tasks/{taskId}`: detail.
- `PATCH /tasks/{taskId}`: update; body requires `version`.
- `DELETE /tasks/{taskId}?version={version}`: soft delete.
- `PATCH /tasks/{taskId}/status`: `{ status, version }`.
- `PATCH /tasks/{taskId}/assignee`: `{ assigneeId, version }`.
- `POST /tasks/{taskId}/archive`: `{ version }`.
- `POST /tasks/{taskId}/unarchive`: `{ version }`.
- `POST /tasks/{taskId}/restore`: `{ version }`.
- `GET /tasks/{taskId}/activity`: task activity history.
- `POST /tasks/bulk-update`: `{ items: [{ taskId, version, changes }] }`.
- `POST /tasks/bulk-delete`: `{ items: [{ taskId, version }] }`.

A stale version returns HTTP `409` with code `CONFLICT`. Bulk operations return an outcome for every item and apply the same visibility, permission, project membership, assignment, and version checks as single-item operations.

List filters include repeated `projectId`, `status`, and `priority` values; `assigneeId`, `creatorId`, `deadlineFrom`, `deadlineTo`, `overdue`, `unassigned`, `archived`, and `deleted`. Search matches case-insensitive title or exact numeric `taskNumber`. Supported sort fields are `taskNumber`, `title`, `status`, `priority`, `startAt`, `dueDate`, `createdAt`, and `updatedAt`; direction is `asc` or `desc`. Page size is capped at 100. Archived and deleted tasks are excluded by default. Deleted listing is owner/admin only.

`dueDate` must be greater than or equal to `startAt` when both are present. Past dates are accepted.

## Assignment and notifications

Owners, admins, and managers may assign to other eligible workspace members. Members may self-assign but cannot assign another user. Assignment rules are enforced in the task service.

`tasks:assign` is granted to all system roles so assignment routes can consistently require it. `PATCH /tasks/{taskId}/assignee` requires `tasks:assign`; generic and bulk updates require `tasks:update` and still run the same service-level assignment checks.

Changing to a non-null assignee different from the acting user creates one `TASK_ASSIGNED` notification if the recipient's `taskAssigned` preference is enabled. An unchanged assignee does not create another notification. Dedupe keys are unique.

- `GET /notifications`: list the current user's workspace notifications.
- `PATCH /notifications/{notificationId}/read`: mark the current user's notification read.
- `GET /notifications/preferences`: return the current user's workspace preference; missing rows resolve to `{ taskAssigned: true }`.
- `PATCH /notifications/preferences`: replace the supported preference with `{ taskAssigned: boolean }`.

Preference and notification operations are scoped by both workspace and current user. Assignment notification creation checks the preference and uses a unique assignment/version dedupe key.

## Project membership and assignees

Project list and detail responses include `visibility`, `createdById`, `creator`, `memberIds`, and member summaries (`id`, `fullName`, `email`, `role`, `roleName`, `status`) when the caller can access the project.

- `GET /projects/{projectId}`: accessible project detail.
- `GET /projects/{projectId}/members`: project member summaries.
- `PUT /projects/{projectId}/members`: replace membership with `{ memberIds: string[] }`.
- `PATCH /projects/{projectId}/visibility`: `{ visibility: "WORKSPACE" | "PRIVATE" }`.
- `GET /projects/{projectId}/eligible-assignees?search=`: active eligible assignees; private projects return only active project members.

Workspace owners/admins or the project creator may replace membership and change visibility. Submitted IDs must be active members of the same workspace. A private project's creator is mandatory and cannot be removed. Managers have no private-project visibility bypass.

## Activity

Task activity actions are:

`task.created`, `task.updated`, `task.status_changed`, `task.assigned`, `task.completed`, `task.archived`, `task.unarchived`, `task.deleted`, and `task.restored`.

The dashboard and activity feed retain Phase 4 tenant scoping, now exclude archived/deleted tasks by default, recognize all Phase 5 open statuses, and enforce private-project visibility.
