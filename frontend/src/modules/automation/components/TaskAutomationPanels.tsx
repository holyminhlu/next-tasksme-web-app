"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import {
  Badge,
  Button,
  Checkbox,
  Collapsible,
  FormField,
  Select,
  TextInput,
  useToast,
} from "@/modules/design-system";
import { useShell } from "@/modules/shell/ShellProvider";
import type { TaskRecord } from "@/modules/tasks/tasks.types";
import * as automation from "../automation.service";
import {
  RISK_LEVEL_LABELS,
  RISK_LEVEL_TONES,
  RISK_LEVELS,
  SLA_STATUS_LABELS,
  SLA_STATUS_TONES,
  WEEKDAY_OPTIONS,
  formatCountdown,
  isoToLocalDateTime,
  localDateTimeToIso,
} from "../automation.helpers";
import type {
  AutomationRunRecord,
  RecurrenceFrequency,
  RecurrenceOverlapPolicy,
  RiskLevel,
  TaskRecurrenceRecord,
  TaskRiskRecord,
  TaskSlaInstanceRecord,
} from "../automation.types";
import styles from "./task-automation.module.css";

type Props = {
  task: TaskRecord;
  onTaskUpdated?: (task: TaskRecord) => void;
};

const FREQUENCIES: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];
const OVERLAP_POLICIES: RecurrenceOverlapPolicy[] = [
  "CREATE_ANYWAY",
  "SKIP_IF_OPEN",
  "CREATE_AND_NOTIFY",
];

export function TaskAutomationPanels({ task }: Props) {
  const { selectedWorkspace, permissions } = useAuth();
  const { navContext } = useShell();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id ?? null;
  const slaEnabled = navContext.enabledModuleKeys?.includes("sla") ?? false;

  const canViewRecurrence = hasPermission(permissions, "recurrence.view");
  const canManageRecurrence = hasPermission(permissions, "recurrence.manage");
  const canViewRisk = hasPermission(permissions, "risk.view");
  const canUpdateRisk = hasPermission(permissions, "risk.update");
  const canViewSla = hasPermission(permissions, "sla.view") && slaEnabled;
  const canOverrideSla = hasPermission(permissions, "sla.override") && slaEnabled;
  const canViewAutomation = hasPermission(permissions, "automation.view");
  const canRetry = hasPermission(permissions, "automation.retry");

  const [recurrence, setRecurrence] = useState<TaskRecurrenceRecord | null>(
    null,
  );
  const [risk, setRisk] = useState<TaskRiskRecord | null>(null);
  const [slaInstances, setSlaInstances] = useState<TaskSlaInstanceRecord[]>(
    [],
  );
  const [runs, setRuns] = useState<AutomationRunRecord[]>([]);
  const [previewRuns, setPreviewRuns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("WEEKLY");
  const [interval, setInterval] = useState(1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [overlapPolicy, setOverlapPolicy] =
    useState<RecurrenceOverlapPolicy>("SKIP_IF_OPEN");
  const [manualRisk, setManualRisk] = useState<string>("");

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    const jobs: Promise<void>[] = [];
    if (canViewRecurrence) {
      jobs.push(
        automation.getRecurrence(workspaceId, task.id).then((result) => {
          if (!result.ok) return;
          setRecurrence(result.data);
          if (result.data) {
            setEnabled(true);
            setFrequency(result.data.frequency);
            setInterval(result.data.interval);
            setDaysOfWeek(result.data.daysOfWeek);
            setDayOfMonth(result.data.dayOfMonth ?? 1);
            setTimezone(result.data.timezone);
            setStartAt(isoToLocalDateTime(result.data.startAt));
            setEndAt(isoToLocalDateTime(result.data.endAt));
            setOverlapPolicy(result.data.overlapPolicy);
          } else {
            setEnabled(false);
          }
        }),
      );
    }
    if (canViewRisk) {
      jobs.push(
        automation.getTaskRisk(workspaceId, task.id).then((result) => {
          if (result.ok) {
            setRisk(result.data);
            setManualRisk(result.data.manualRiskLevel ?? "");
          }
        }),
      );
    }
    if (canViewSla) {
      jobs.push(
        automation.listTaskSla(workspaceId, task.id).then((result) => {
          if (result.ok) setSlaInstances(result.data);
        }),
      );
    }
    if (canViewAutomation) {
      jobs.push(
        automation
          .listAutomationRuns(workspaceId, { taskId: task.id, pageSize: 20 })
          .then((result) => {
            if (result.ok) setRuns(result.data.items);
          }),
      );
    }
    await Promise.all(jobs);
  }, [
    workspaceId,
    task.id,
    canViewRecurrence,
    canViewRisk,
    canViewSla,
    canViewAutomation,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const recurrenceInput = useMemo(
    () => ({
      frequency,
      interval,
      daysOfWeek: frequency === "WEEKLY" ? daysOfWeek : [],
      dayOfMonth: frequency === "MONTHLY" ? dayOfMonth : null,
      timezone,
      startAt: localDateTimeToIso(startAt),
      endAt: endAt ? localDateTimeToIso(endAt) : null,
      overlapPolicy,
      isActive: true,
    }),
    [
      frequency,
      interval,
      daysOfWeek,
      dayOfMonth,
      timezone,
      startAt,
      endAt,
      overlapPolicy,
    ],
  );

  async function handleSaveRecurrence() {
    if (!workspaceId || !canManageRecurrence || !startAt) return;
    setBusy(true);
    const result = await automation.upsertRecurrence(
      workspaceId,
      task.id,
      recurrenceInput,
    );
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't save recurrence",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setRecurrence(result.data);
    setEnabled(true);
    toast({ title: "Recurrence saved", tone: "success" });
    await reload();
  }

  async function handlePreview() {
    if (!workspaceId || !startAt) return;
    setBusy(true);
    const result = await automation.previewRecurrence(
      workspaceId,
      task.id,
      recurrenceInput,
    );
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't preview schedule",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setPreviewRuns(result.data.nextRuns);
  }

  async function handlePauseResume(pause: boolean) {
    if (!workspaceId) return;
    setBusy(true);
    const result = pause
      ? await automation.pauseRecurrence(workspaceId, task.id)
      : await automation.resumeRecurrence(workspaceId, task.id);
    setBusy(false);
    if (!result.ok) {
      toast({
        title: pause ? "Couldn't pause" : "Couldn't resume",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setRecurrence(result.data);
  }

  async function handleDisableRecurrence() {
    if (!workspaceId) return;
    setBusy(true);
    const result = await automation.deleteRecurrence(workspaceId, task.id);
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't remove recurrence",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setRecurrence(null);
    setEnabled(false);
    setPreviewRuns([]);
  }

  async function handleSaveManualRisk() {
    if (!workspaceId || !canUpdateRisk) return;
    setBusy(true);
    const result = await automation.updateManualRisk(
      workspaceId,
      task.id,
      manualRisk || null,
    );
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't update risk",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setRisk(result.data);
  }

  async function handleSlaPauseResume(
    instance: TaskSlaInstanceRecord,
    pause: boolean,
  ) {
    if (!workspaceId) return;
    setBusy(true);
    const result = pause
      ? await automation.pauseSlaInstance(workspaceId, task.id, instance.id)
      : await automation.resumeSlaInstance(workspaceId, task.id, instance.id);
    setBusy(false);
    if (!result.ok) {
      toast({
        title: pause ? "Couldn't pause SLA" : "Couldn't resume SLA",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setSlaInstances((prev) =>
      prev.map((row) => (row.id === result.data.id ? result.data : row)),
    );
  }

  async function handleRetry(run: AutomationRunRecord) {
    if (!workspaceId) return;
    setBusy(true);
    const result = await automation.retryAutomationRun(workspaceId, run.id);
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't retry job",
        description: result.message,
        tone: "error",
      });
      return;
    }
    await reload();
  }

  function toggleWeekday(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  if (
    !canViewRecurrence &&
    !canViewRisk &&
    !canViewSla &&
    !canViewAutomation
  ) {
    return null;
  }

  return (
    <div className={styles.stack}>
      {canViewRecurrence && (
        <Collapsible
          title="Recurrence"
          badge={
            recurrence?.isActive ? (
              <Badge tone="primary">Active</Badge>
            ) : recurrence ? (
              <Badge tone="warning">Paused</Badge>
            ) : undefined
          }
          defaultOpen={Boolean(recurrence)}
        >
          <div className={styles.stack}>
            {recurrence?.nextRunAt && (
              <p className={styles.muted}>
                Next run: {new Date(recurrence.nextRunAt).toLocaleString()}
              </p>
            )}
            {canManageRecurrence ? (
              <div className={styles.composer}>
                <Checkbox
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  label="Enable recurring task"
                />
                {enabled && (
                  <>
                    <div className={styles.grid2}>
                      <FormField label="Frequency">
                        {(props) => (
                          <Select
                            {...props}
                            value={frequency}
                            onChange={(event) =>
                              setFrequency(
                                event.target.value as RecurrenceFrequency,
                              )
                            }
                          >
                            {FREQUENCIES.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                      <FormField label="Interval">
                        {(props) => (
                          <TextInput
                            {...props}
                            type="number"
                            min={1}
                            value={String(interval)}
                            onChange={(event) =>
                              setInterval(Number(event.target.value) || 1)
                            }
                          />
                        )}
                      </FormField>
                      <FormField label="Timezone">
                        {(props) => (
                          <TextInput
                            {...props}
                            value={timezone}
                            onChange={(event) =>
                              setTimezone(event.target.value)
                            }
                          />
                        )}
                      </FormField>
                      <FormField label="Overlap policy">
                        {(props) => (
                          <Select
                            {...props}
                            value={overlapPolicy}
                            onChange={(event) =>
                              setOverlapPolicy(
                                event.target
                                  .value as RecurrenceOverlapPolicy,
                              )
                            }
                          >
                            {OVERLAP_POLICIES.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                      <FormField label="Starts">
                        {(props) => (
                          <TextInput
                            {...props}
                            type="datetime-local"
                            value={startAt}
                            onChange={(event) =>
                              setStartAt(event.target.value)
                            }
                          />
                        )}
                      </FormField>
                      <FormField label="Ends (optional)">
                        {(props) => (
                          <TextInput
                            {...props}
                            type="datetime-local"
                            value={endAt}
                            onChange={(event) => setEndAt(event.target.value)}
                          />
                        )}
                      </FormField>
                    </div>
                    {frequency === "WEEKLY" && (
                      <div className={styles.weekdayGrid}>
                        {WEEKDAY_OPTIONS.map((day) => (
                          <Button
                            key={day.value}
                            size="sm"
                            variant={
                              daysOfWeek.includes(day.value)
                                ? "primary"
                                : "ghost"
                            }
                            onClick={() => toggleWeekday(day.value)}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                    )}
                    {frequency === "MONTHLY" && (
                      <FormField label="Day of month">
                        {(props) => (
                          <TextInput
                            {...props}
                            type="number"
                            min={1}
                            max={31}
                            value={String(dayOfMonth)}
                            onChange={(event) =>
                              setDayOfMonth(Number(event.target.value) || 1)
                            }
                          />
                        )}
                      </FormField>
                    )}
                    <div className={styles.row}>
                      <Button
                        size="sm"
                        disabled={busy || !startAt}
                        onClick={() => void handleSaveRecurrence()}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || !startAt}
                        onClick={() => void handlePreview()}
                      >
                        Preview next runs
                      </Button>
                      {recurrence?.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void handlePauseResume(true)}
                        >
                          Pause
                        </Button>
                      )}
                      {recurrence && !recurrence.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void handlePauseResume(false)}
                        >
                          Resume
                        </Button>
                      )}
                      {recurrence && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void handleDisableRecurrence()}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    {previewRuns.length > 0 && (
                      <ul className={styles.reasons}>
                        {previewRuns.map((run) => (
                          <li key={run}>
                            {new Date(run).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className={styles.muted}>
                {recurrence
                  ? `${recurrence.frequency} every ${recurrence.interval} · ${recurrence.timezone}`
                  : "No recurrence configured."}
              </p>
            )}
          </div>
        </Collapsible>
      )}

      {(canViewRisk || canViewSla) && (
        <Collapsible title="Risk & SLA" defaultOpen>
          <div className={styles.stack}>
            {canViewRisk && (
              <>
                <div className={styles.row}>
                  {risk?.riskLevel ? (
                    <Badge tone={RISK_LEVEL_TONES[risk.riskLevel]}>
                      Risk: {RISK_LEVEL_LABELS[risk.riskLevel]}
                      {risk.riskScore != null ? ` (${risk.riskScore})` : ""}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">No risk score yet</Badge>
                  )}
                </div>
                {risk?.riskReasons?.length ? (
                  <div>
                    <strong>High risk because:</strong>
                    <ul className={styles.reasons}>
                      {risk.riskReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className={styles.muted}>No active risk reasons.</p>
                )}
                {canUpdateRisk && (
                  <div className={styles.row}>
                    <FormField label="Manual risk">
                      {(props) => (
                        <Select
                          {...props}
                          value={manualRisk}
                          onChange={(event) =>
                            setManualRisk(event.target.value)
                          }
                        >
                          <option value="">Rule-based only</option>
                          {RISK_LEVELS.map((level) => (
                            <option key={level} value={level}>
                              {RISK_LEVEL_LABELS[level]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </FormField>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleSaveManualRisk()}
                    >
                      Save risk
                    </Button>
                  </div>
                )}
              </>
            )}

            {canViewSla && (
              <div className={styles.list}>
                <strong>SLA</strong>
                {slaInstances.length === 0 && (
                  <p className={styles.muted}>No SLA policy applies.</p>
                )}
                {slaInstances.map((instance) => (
                  <div key={instance.id} className={styles.composer}>
                    <div className={styles.row}>
                      <Badge tone={SLA_STATUS_TONES[instance.status]}>
                        {SLA_STATUS_LABELS[instance.status]}
                      </Badge>
                      <span className={styles.grow}>{instance.policyName}</span>
                    </div>
                    <div className={styles.muted}>
                      Remaining: {formatCountdown(instance.remainingSeconds)} ·
                      Due {new Date(instance.dueAt).toLocaleString()}
                    </div>
                    {instance.status === "ACTIVE" &&
                      instance.warningAt &&
                      !instance.warningSentAt && (
                        <p className={styles.warning}>
                          Warning at{" "}
                          {new Date(instance.warningAt).toLocaleString()}
                        </p>
                      )}
                    {instance.status === "BREACHED" && (
                      <p className={styles.warning}>SLA breached</p>
                    )}
                    {canOverrideSla && instance.status === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void handleSlaPauseResume(instance, true)
                        }
                      >
                        Pause SLA
                      </Button>
                    )}
                    {canOverrideSla && instance.status === "PAUSED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void handleSlaPauseResume(instance, false)
                        }
                      >
                        Resume SLA
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!slaEnabled && canViewRisk && (
              <p className={styles.muted}>
                SLA module is not enabled for this workspace.
              </p>
            )}
          </div>
        </Collapsible>
      )}

      {canViewAutomation && (
        <Collapsible title="Automation history" defaultOpen={false}>
          <div className={styles.list}>
            {runs.length === 0 && (
              <p className={styles.muted}>No automation runs yet.</p>
            )}
            {runs.map((run) => (
              <div key={run.id} className={styles.historyRow}>
                <div className={styles.grow}>
                  <strong>
                    {run.jobType} · {run.status}
                  </strong>
                  <div className={styles.muted}>
                    {new Date(run.createdAt).toLocaleString()}
                    {run.errorMessage ? ` · ${run.errorMessage}` : ""}
                  </div>
                </div>
                {canRetry &&
                  (run.status === "FAILED" || run.status === "DEAD") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void handleRetry(run)}
                    >
                      Retry
                    </Button>
                  )}
              </div>
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  );
}

// silence unused RiskLevel import usage for type-only consumers
export type { RiskLevel };
