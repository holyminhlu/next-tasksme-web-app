# Phase 7.3 — Recurring Tasks, Risk & SLA Automation

## Scope

Phase 7.3 adds timezone-aware recurring task generation, explainable rule-based
risk, optional SLA with business calendars, and a dedicated PostgreSQL-backed
worker. API replicas do not run cron loops.

## Recurrence

- Frequencies: `DAILY`, `WEEKLY`, `MONTHLY` with interval, weekdays, day-of-month,
  IANA timezone, start/end, and preview of next runs.
- Overlap policies: `CREATE_ANYWAY`, `SKIP_IF_OPEN`, `CREATE_AND_NOTIFY`.
- Pause/resume toggles `isActive` and recomputes `nextRunAt`.
- Each occurrence is unique on `(recurrenceId, scheduledAt)`.
- Worker claims due rows with `FOR UPDATE SKIP LOCKED` plus advisory locks.
- Invalid project/assignee on the template are dropped safely by the task factory.

## Risk

- Manual risk level plus rule-based score/reasons.
- Default weights: overdue +40, blocked >3 days +25, late/incomplete dependency
  +20, unassigned +15.
- Responses always include `riskLevel`, `riskScore`, `riskReasons`, and
  `calculatedAt` — never a score without reasons.
- Workspace-scoped rules; recalculation is scheduled via `riskRecalculateAt`.

## SLA

- Gated by the optional `sla` workspace module (off by default for Personal).
- Policies use target/warning minutes and optional Business Calendar
  (working hours + holidays + timezone).
- Instance states: `ACTIVE`, `PAUSED`, `MET`, `BREACHED`, `CANCELLED`.
- Warning and breach notifications use dedupe keys and
  `warningSentAt` / `breachNotifiedAt` so they are sent once.

## Worker

- Entry: `npm run worker` / `node dist/src/worker.js`.
- Polls indexed fields only: `nextRunAt`, `riskRecalculateAt`, SLA
  `warningAt`/`dueAt`, and automation `nextRetryAt`.
- Failed automation runs support retry with `automation.retry` and audit logging.

## Permissions

`recurrence.*`, `risk.*`, `sla.*`, `automation.*` — see backend
`ROLE_PERMISSION_MAP` and frontend mirrors.

## Frontend

- Task Detail: `TaskAutomationPanels` for recurrence, risk/SLA, and task-level
  automation history.
- Settings → Automation for risk rules, calendars/policies, and workspace runs.
