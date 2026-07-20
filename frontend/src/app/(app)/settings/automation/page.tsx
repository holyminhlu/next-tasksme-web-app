"use client";

import { useCallback, useEffect, useState } from "react";
import { hasPermission, useAuth } from "@/modules/auth";
import * as automation from "@/modules/automation/automation.service";
import type {
  AutomationRunRecord,
  BusinessCalendarRecord,
  RiskRuleRecord,
  SlaPolicyRecord,
} from "@/modules/automation/automation.types";
import {
  Button,
  ForbiddenState,
  FormField,
  LoadingState,
  Select,
  TextInput,
  useToast,
} from "@/modules/design-system";
import { useShell } from "@/modules/shell";
import styles from "../../app-pages.module.css";

const DEFAULT_WEIGHTS = {
  overdue: 40,
  blockedOverDays: 25,
  dependencyLate: 20,
  unassigned: 15,
};

const DEFAULT_THRESHOLDS = {
  medium: 25,
  high: 50,
  critical: 75,
};

function emptyRule(workspaceId: string): RiskRuleRecord {
  return {
    id: "",
    workspaceId,
    name: "Default",
    weights: DEFAULT_WEIGHTS,
    thresholds: DEFAULT_THRESHOLDS,
    isActive: true,
  };
}

export default function AutomationSettingsPage() {
  const { permissions, selectedWorkspace } = useAuth();
  const { navContext } = useShell();
  const { toast } = useToast();
  const workspaceId = selectedWorkspace?.id;
  const slaEnabled = navContext.enabledModuleKeys?.includes("sla") ?? false;
  const canView = hasPermission(permissions, "automation.view");
  const canConfigureRisk = hasPermission(permissions, "risk.configure");
  const canConfigureSla =
    hasPermission(permissions, "sla.configure") && slaEnabled;
  const canRetry = hasPermission(permissions, "automation.retry");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riskRule, setRiskRule] = useState<RiskRuleRecord | null>(null);
  const [calendars, setCalendars] = useState<BusinessCalendarRecord[]>([]);
  const [policies, setPolicies] = useState<SlaPolicyRecord[]>([]);
  const [runs, setRuns] = useState<AutomationRunRecord[]>([]);
  const [calendarName, setCalendarName] = useState("Default business hours");
  const [calendarTz, setCalendarTz] = useState("UTC");
  const [policyName, setPolicyName] = useState("Urgent SLA");
  const [targetMinutes, setTargetMinutes] = useState(480);
  const [warningMinutes, setWarningMinutes] = useState(60);
  const [policyCalendarId, setPolicyCalendarId] = useState("");
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");

  const load = useCallback(async () => {
    if (!workspaceId || !canView) return;
    setLoading(true);
    setError(null);
    const [ruleResult, runsResult] = await Promise.all([
      automation.getRiskRule(workspaceId),
      automation.listAutomationRuns(workspaceId, { pageSize: 30 }),
    ]);
    if (ruleResult.ok) setRiskRule(ruleResult.data);
    else setError(ruleResult.message);
    if (runsResult.ok) setRuns(runsResult.data.items);
    if (slaEnabled) {
      const [calResult, policyResult] = await Promise.all([
        automation.listBusinessCalendars(workspaceId),
        automation.listSlaPolicies(workspaceId),
      ]);
      if (calResult.ok) {
        setCalendars(calResult.data);
        if (calResult.data[0]) {
          setPolicyCalendarId(calResult.data[0].id);
          setSelectedCalendarId(calResult.data[0].id);
        }
      }
      if (policyResult.ok) setPolicies(policyResult.data);
    }
    setLoading(false);
  }, [workspaceId, canView, slaEnabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveRiskRule() {
    if (!workspaceId || !canConfigureRisk) return;
    const draft = riskRule ?? emptyRule(workspaceId);
    setBusy(true);
    const result = await automation.upsertRiskRule(workspaceId, {
      name: draft.name,
      weights: draft.weights,
      thresholds: draft.thresholds,
      isActive: true,
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't save risk rules",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setRiskRule(result.data);
    toast({ title: "Risk rules saved", tone: "success" });
  }

  async function createCalendar() {
    if (!workspaceId || !canConfigureSla) return;
    setBusy(true);
    const result = await automation.createBusinessCalendar(workspaceId, {
      name: calendarName,
      timezone: calendarTz,
      isDefault: calendars.length === 0,
      workingHours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        dayOfWeek,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
      })),
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't create calendar",
        description: result.message,
        tone: "error",
      });
      return;
    }
    toast({ title: "Business calendar created", tone: "success" });
    await load();
  }

  async function addHoliday() {
    if (!workspaceId || !canConfigureSla || !selectedCalendarId || !holidayDate || !holidayName) {
      return;
    }
    const calendar = calendars.find((item) => item.id === selectedCalendarId);
    if (!calendar) return;
    setBusy(true);
    const result = await automation.updateBusinessCalendar(workspaceId, selectedCalendarId, {
      holidays: [
        ...calendar.holidays,
        { date: holidayDate, name: holidayName, isWorking: false },
      ],
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't add holiday",
        description: result.message,
        tone: "error",
      });
      return;
    }
    setHolidayDate("");
    setHolidayName("");
    toast({ title: "Holiday added", tone: "success" });
    await load();
  }

  async function removeHoliday(calendarId: string, date: string) {
    if (!workspaceId || !canConfigureSla) return;
    const calendar = calendars.find((item) => item.id === calendarId);
    if (!calendar) return;
    setBusy(true);
    const result = await automation.updateBusinessCalendar(workspaceId, calendarId, {
      holidays: calendar.holidays.filter((holiday) => holiday.date !== date),
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't remove holiday",
        description: result.message,
        tone: "error",
      });
      return;
    }
    toast({ title: "Holiday removed", tone: "success" });
    await load();
  }

  async function createPolicy() {
    if (!workspaceId || !canConfigureSla) return;
    setBusy(true);
    const result = await automation.createSlaPolicy(workspaceId, {
      name: policyName,
      targetDurationMinutes: targetMinutes,
      warningBeforeMinutes: warningMinutes,
      businessCalendarId: policyCalendarId || null,
      applicableConditions: { priorities: ["URGENT", "HIGH"] },
    });
    setBusy(false);
    if (!result.ok) {
      toast({
        title: "Couldn't create SLA policy",
        description: result.message,
        tone: "error",
      });
      return;
    }
    toast({ title: "SLA policy created", tone: "success" });
    await load();
  }

  async function retryRun(run: AutomationRunRecord) {
    if (!workspaceId || !canRetry) return;
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
    toast({ title: "Job queued for retry", tone: "success" });
    await load();
  }

  if (!canView) {
    return (
      <ForbiddenState description="You need automation.view permission to open automation settings." />
    );
  }

  if (loading) return <LoadingState label="Loading automation settings…" />;

  const draft = riskRule ?? (workspaceId ? emptyRule(workspaceId) : null);
  const weights = draft?.weights ?? DEFAULT_WEIGHTS;
  const thresholds = draft?.thresholds ?? DEFAULT_THRESHOLDS;

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Risk rules</h2>
        <p className={styles.cardDescription}>
          Rule-based scores explain overdue, blocked, dependency, and unassigned
          risk. Manual risk on a task can still override the calculated level.
        </p>
        {error && (
          <p className={styles.errorBanner} role="alert">
            {error}
          </p>
        )}
        <div className={styles.form}>
          <div className={styles.grid}>
            <FormField label="Overdue weight">
              {(props) => (
                <TextInput
                  {...props}
                  type="number"
                  value={String(weights.overdue)}
                  disabled={!canConfigureRisk}
                  onChange={(event) =>
                    setRiskRule({
                      ...(draft as RiskRuleRecord),
                      weights: {
                        ...weights,
                        overdue: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              )}
            </FormField>
            <FormField label="Blocked weight">
              {(props) => (
                <TextInput
                  {...props}
                  type="number"
                  value={String(weights.blockedOverDays)}
                  disabled={!canConfigureRisk}
                  onChange={(event) =>
                    setRiskRule({
                      ...(draft as RiskRuleRecord),
                      weights: {
                        ...weights,
                        blockedOverDays: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              )}
            </FormField>
            <FormField label="Medium threshold">
              {(props) => (
                <TextInput
                  {...props}
                  type="number"
                  value={String(thresholds.medium)}
                  disabled={!canConfigureRisk}
                  onChange={(event) =>
                    setRiskRule({
                      ...(draft as RiskRuleRecord),
                      thresholds: {
                        ...thresholds,
                        medium: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              )}
            </FormField>
            <FormField label="Critical threshold">
              {(props) => (
                <TextInput
                  {...props}
                  type="number"
                  value={String(thresholds.critical)}
                  disabled={!canConfigureRisk}
                  onChange={(event) =>
                    setRiskRule({
                      ...(draft as RiskRuleRecord),
                      thresholds: {
                        ...thresholds,
                        critical: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              )}
            </FormField>
          </div>
          {canConfigureRisk && (
            <div className={styles.formActions}>
              <Button disabled={busy} onClick={() => void saveRiskRule()}>
                Save risk rules
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>SLA</h2>
        {!slaEnabled ? (
          <p className={styles.muted}>
            Enable the SLA module in Settings → Modules to configure business
            calendars and policies. Personal workspaces are not required to use
            SLA.
          </p>
        ) : (
          <div className={styles.stack}>
            <div>
              <h3 className={styles.cardTitle}>Business calendars</h3>
              {calendars.map((calendar) => (
                <div key={calendar.id}>
                  <p className={styles.muted}>
                    {calendar.name} · {calendar.timezone}
                    {calendar.isDefault ? " (default)" : ""}
                  </p>
                  {calendar.holidays.length > 0 && (
                    <ul className={styles.muted}>
                      {calendar.holidays.map((holiday) => (
                        <li key={`${calendar.id}-${holiday.date}`}>
                          {holiday.date}: {holiday.name}
                          {canConfigureSla && (
                            <>
                              {" "}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  void removeHoliday(calendar.id, holiday.date)
                                }
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {calendars.length === 0 && (
                <p className={styles.muted}>No calendars yet.</p>
              )}
              {canConfigureSla && (
                <div className={styles.form}>
                  <FormField label="Calendar name">
                    {(props) => (
                      <TextInput
                        {...props}
                        value={calendarName}
                        onChange={(event) => setCalendarName(event.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="Timezone">
                    {(props) => (
                      <TextInput
                        {...props}
                        value={calendarTz}
                        onChange={(event) => setCalendarTz(event.target.value)}
                      />
                    )}
                  </FormField>
                  <div className={styles.formActions}>
                    <Button disabled={busy} onClick={() => void createCalendar()}>
                      Create Mon–Fri 09:00–17:00 calendar
                    </Button>
                  </div>
                  {calendars.length > 0 && (
                    <>
                      <FormField label="Calendar for holidays">
                        {(props) => (
                          <Select
                            {...props}
                            value={selectedCalendarId}
                            onChange={(event) =>
                              setSelectedCalendarId(event.target.value)
                            }
                          >
                            {calendars.map((calendar) => (
                              <option key={calendar.id} value={calendar.id}>
                                {calendar.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                      <FormField label="Holiday date">
                        {(props) => (
                          <TextInput
                            {...props}
                            type="date"
                            value={holidayDate}
                            onChange={(event) => setHolidayDate(event.target.value)}
                          />
                        )}
                      </FormField>
                      <FormField label="Holiday name">
                        {(props) => (
                          <TextInput
                            {...props}
                            value={holidayName}
                            onChange={(event) => setHolidayName(event.target.value)}
                          />
                        )}
                      </FormField>
                      <div className={styles.formActions}>
                        <Button disabled={busy} onClick={() => void addHoliday()}>
                          Add holiday
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <h3 className={styles.cardTitle}>SLA policies</h3>
              {policies.map((policy) => (
                <p key={policy.id} className={styles.muted}>
                  {policy.name}: warn {policy.warningBeforeMinutes}m / due{" "}
                  {policy.targetDurationMinutes}m
                </p>
              ))}
              {policies.length === 0 && (
                <p className={styles.muted}>No policies yet.</p>
              )}
              {canConfigureSla && (
                <div className={styles.form}>
                  <FormField label="Policy name">
                    {(props) => (
                      <TextInput
                        {...props}
                        value={policyName}
                        onChange={(event) => setPolicyName(event.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="Target minutes">
                    {(props) => (
                      <TextInput
                        {...props}
                        type="number"
                        value={String(targetMinutes)}
                        onChange={(event) =>
                          setTargetMinutes(Number(event.target.value) || 0)
                        }
                      />
                    )}
                  </FormField>
                  <FormField label="Warning before minutes">
                    {(props) => (
                      <TextInput
                        {...props}
                        type="number"
                        value={String(warningMinutes)}
                        onChange={(event) =>
                          setWarningMinutes(Number(event.target.value) || 0)
                        }
                      />
                    )}
                  </FormField>
                  <FormField label="Calendar">
                    {(props) => (
                      <Select
                        {...props}
                        value={policyCalendarId}
                        onChange={(event) =>
                          setPolicyCalendarId(event.target.value)
                        }
                      >
                        <option value="">Elapsed time only</option>
                        {calendars.map((calendar) => (
                          <option key={calendar.id} value={calendar.id}>
                            {calendar.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  <div className={styles.formActions}>
                    <Button disabled={busy} onClick={() => void createPolicy()}>
                      Create policy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Automation history</h2>
        <p className={styles.cardDescription}>
          Recurrence generation, risk recalculation, and SLA warning/breach jobs.
        </p>
        {runs.length === 0 && (
          <p className={styles.muted}>No automation runs yet.</p>
        )}
        {runs.map((run) => (
          <div key={run.id} className={`${styles.row} ${styles.spaceBetween}`}>
            <span className={styles.muted}>
              {run.jobType} · {run.status}
              {run.errorMessage ? ` · ${run.errorMessage}` : ""}
            </span>
            {canRetry &&
              (run.status === "FAILED" || run.status === "DEAD") && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void retryRun(run)}
                >
                  Retry
                </Button>
              )}
          </div>
        ))}
      </section>
    </div>
  );
}
