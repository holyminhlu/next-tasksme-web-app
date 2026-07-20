import type { RiskLevel, SlaInstanceStatus } from "./automation.types";

export const RISK_LEVELS: RiskLevel[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const RISK_LEVEL_TONES: Record<
  RiskLevel,
  "success" | "primary" | "warning" | "danger" | "neutral"
> = {
  LOW: "success",
  MEDIUM: "primary",
  HIGH: "warning",
  CRITICAL: "danger",
};

export const SLA_STATUS_LABELS: Record<SlaInstanceStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  MET: "Met",
  BREACHED: "Breached",
  CANCELLED: "Cancelled",
};

export const SLA_STATUS_TONES: Record<
  SlaInstanceStatus,
  "success" | "primary" | "warning" | "danger" | "neutral"
> = {
  ACTIVE: "primary",
  PAUSED: "warning",
  MET: "success",
  BREACHED: "danger",
  CANCELLED: "neutral",
};

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function formatCountdown(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const abs = Math.abs(seconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const prefix = seconds < 0 ? "-" : "";
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${prefix}${days}d ${remHours}h`;
  }
  if (hours > 0) return `${prefix}${hours}h ${minutes}m`;
  return `${prefix}${minutes}m`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function isoToLocalDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function localDateTimeToIso(value: string): string {
  return value ? new Date(value).toISOString() : "";
}
