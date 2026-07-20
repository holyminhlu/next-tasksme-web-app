export type RiskWeights = {
  overdue: number;
  blockedOverThreeDays: number;
  dependencyLateOrIncomplete: number;
  unassigned: number;
};

export type RiskThresholds = {
  medium: number;
  high: number;
  critical: number;
};

export type RiskTaskInput = {
  dueDate?: Date | string | null;
  status?: string;
  isBlocked?: boolean;
  blockedSince?: Date | string | null;
  updatedAt?: Date | string | null;
  assigneeId?: string | null;
  dependencies?: Array<{
    status?: string;
    dueDate?: Date | string | null;
  }>;
};

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  overdue: 40,
  blockedOverThreeDays: 25,
  dependencyLateOrIncomplete: 20,
  unassigned: 15,
};

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  medium: 20,
  high: 40,
  critical: 70,
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function configuredNumber(
  source: Record<string, unknown>,
  keys: string[],
  fallback: number,
): number {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return fallback;
}

export function calculateTaskRisk(
  task: RiskTaskInput,
  configuration: { weights?: unknown; thresholds?: unknown } = {},
  now = new Date(),
): {
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number;
  reasons: string[];
  calculatedAt: Date;
} {
  const customWeights = record(configuration.weights);
  const customThresholds = record(configuration.thresholds);
  const weights: RiskWeights = {
    overdue: configuredNumber(customWeights, ["overdue"], DEFAULT_RISK_WEIGHTS.overdue),
    blockedOverThreeDays: configuredNumber(
      customWeights,
      ["blockedOverThreeDays", "blockedOverDays", "blocked", "blocked3d"],
      DEFAULT_RISK_WEIGHTS.blockedOverThreeDays,
    ),
    dependencyLateOrIncomplete: configuredNumber(
      customWeights,
      [
        "dependencyLateOrIncomplete",
        "dependencyLate",
        "dependency",
        "dependencyIncomplete",
      ],
      DEFAULT_RISK_WEIGHTS.dependencyLateOrIncomplete,
    ),
    unassigned: configuredNumber(customWeights, ["unassigned"], DEFAULT_RISK_WEIGHTS.unassigned),
  };
  const thresholds: RiskThresholds = {
    medium: configuredNumber(customThresholds, ["medium", "MEDIUM"], DEFAULT_RISK_THRESHOLDS.medium),
    high: configuredNumber(customThresholds, ["high", "HIGH"], DEFAULT_RISK_THRESHOLDS.high),
    critical: configuredNumber(
      customThresholds,
      ["critical", "CRITICAL"],
      DEFAULT_RISK_THRESHOLDS.critical,
    ),
  };

  let score = 0;
  const reasons: string[] = [];
  const terminal = task.status === "DONE" || task.status === "CANCELLED";
  if (!terminal && task.dueDate && new Date(task.dueDate) < now) {
    score += weights.overdue;
    reasons.push(`Task is overdue (+${weights.overdue})`);
  }
  const blockedSince = task.blockedSince ?? task.updatedAt;
  if (
    !terminal &&
    (task.isBlocked || task.status === "BLOCKED") &&
    blockedSince &&
    now.getTime() - new Date(blockedSince).getTime() > 3 * 24 * 60 * 60 * 1000
  ) {
    score += weights.blockedOverThreeDays;
    reasons.push(`Task has been blocked for more than 3 days (+${weights.blockedOverThreeDays})`);
  }
  const riskyDependency = (task.dependencies ?? []).some(
    (dependency) =>
      dependency.status !== "DONE" ||
      (dependency.dueDate !== null &&
        dependency.dueDate !== undefined &&
        new Date(dependency.dueDate) < now),
  );
  if (!terminal && riskyDependency) {
    score += weights.dependencyLateOrIncomplete;
    reasons.push(`A dependency is late or incomplete (+${weights.dependencyLateOrIncomplete})`);
  }
  if (!terminal && !task.assigneeId) {
    score += weights.unassigned;
    reasons.push(`Task has no assignee (+${weights.unassigned})`);
  }

  const level =
    score >= thresholds.critical
      ? "CRITICAL"
      : score >= thresholds.high
        ? "HIGH"
        : score >= thresholds.medium
          ? "MEDIUM"
          : "LOW";
  if (reasons.length === 0) reasons.push("No active risk factors detected");
  return { level, score, reasons, calculatedAt: now };
}

export const calculateRisk = calculateTaskRisk;
