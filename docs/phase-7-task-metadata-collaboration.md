# Phase 7.1 — Task Metadata & Collaboration

## Scope

Turn Task Detail into a workspace for checklist, tags, custom fields, comments (Socket.IO), and attachments (local/MinIO/S3).

**Checklist ≠ Subtask.** Checklist items are steps on a task. Subtasks (tasks with `parentTaskId`) are out of scope for 7.1.

## Data model

- `ChecklistItem` — task-scoped, integer `position`, completion metadata
- `Tag` + `TaskTag` — workspace-scoped; deleting a tag only removes join rows
- `CustomFieldDefinition` + `TaskCustomFieldValue` — definition/value separated; typed `valueJson`
- `Comment` (+ `CommentMention`) — soft delete, replies, mentions
- `Attachment` — metadata only; bytes in object storage

## Permissions

| Area | Keys |
|------|------|
| Checklist | `checklist.manage` |
| Tags | `tag.view`, `tag.create`, `tag.update`, `tag.delete`, `task.tag.manage` |
| Custom fields | `custom_field.view`, `custom_field.configure`, `custom_field.value.update` |
| Comments | `comment.view`, `comment.create`, `comment.update_own`, `comment.delete_own`, `comment.moderate` |
| Attachments | `attachment.view`, `attachment.upload`, `attachment.delete_own`, `attachment.manage` |

Existing workspaces receive keys via migration backfill; new workspaces via `ROLE_PERMISSION_MAP`.

## APIs

All under `/api/v1/workspaces/:workspaceId`:

- `.../tasks/:taskId/checklist-items` (+ `/:itemId`, `/reorder`)
- `.../tags`, `.../tasks/:taskId/tags`
- `.../custom-fields`, `.../tasks/:taskId/custom-field-values`
- `.../tasks/:taskId/comments`
- `.../tasks/:taskId/attachments` (+ `/:id/download`)

List filter: `tagIds` (multi) on task list/board/calendar/timeline/export shared filter contract.

## Realtime

Socket.IO attaches to the HTTP server (`/socket.io`):

1. Client authenticates with access token
2. `task:join` re-checks membership + task visibility
3. Comment service writes DB first, then emits `comment:created|updated|deleted`

## Attachments

- `STORAGE_DRIVER=local` (default/test) or `s3` (MinIO/AWS)
- MIME allowlist + `ATTACHMENT_MAX_BYTES`
- Download returns a **short-lived signed URL** (never a permanent public object URL)
- Local compose helper: `docker-compose.minio.yml`

## Frontend

`TaskDetailDialog` hosts collapsible sections: Checklist, Tags, Custom fields, Attachments, Comments (+ existing Activity). My Tasks filter bar supports tag filter via URL `tagId`.

## Definition of Done checklist

- [x] Checklist CRUD, completion, reorder
- [x] Checklist vs Subtask documented
- [x] Tags workspace-scoped; delete tag keeps tasks
- [x] Custom field definition/value separated + type validation
- [x] Comments persisted before WebSocket emit
- [x] Socket room checks task access
- [x] Mentions limited to users who can view the task
- [x] Comment sanitize
- [x] Attachment size/MIME limits; signed download; tenant isolation
