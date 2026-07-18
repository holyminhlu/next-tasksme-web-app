"use client";

/**
 * Lightweight, dependency-free charts (CSS/HTML/SVG). Every chart renders a
 * visually hidden text summary so screen reader users get the same data, and
 * uses native title tooltips for point details.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Charts.module.css";

/** Chart palette cycled across series (all resolve via design tokens). */
const PALETTE = [
  "var(--ds-color-primary)",
  "var(--ds-color-success)",
  "var(--ds-color-warning)",
  "var(--ds-color-danger)",
  "var(--ds-color-text-subtle)",
];

export function chartColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export type ChartDatum = {
  key: string;
  label: string;
  value: number;
  color?: string;
  href?: string;
  /** Tooltip / sr text; defaults to "label: value". */
  detail?: string;
};

function SrSummary({ summary }: { summary: string }) {
  return <p className={styles.srOnly}>{summary}</p>;
}

export function ChartEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.chartEmpty}>{children}</p>;
}

// ---------------------------------------------------------------------------
// Donut
// ---------------------------------------------------------------------------

export function DonutChart({
  data,
  centerLabel,
  summary,
  size = 132,
}: {
  data: ChartDatum[];
  centerLabel: string;
  summary: string;
  size?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  const segments = data.reduce<
    Array<ChartDatum & { color: string; dash: number; offset: number }>
  >((accumulated, item, index) => {
    const fraction = total > 0 ? item.value / total : 0;
    const previous = accumulated[accumulated.length - 1];
    const offset = previous ? previous.offset + previous.dash : 0;

    accumulated.push({
      ...item,
      color: item.color ?? chartColor(index),
      dash: fraction * circumference,
      offset,
    });

    return accumulated;
  }, []);

  return (
    <div className={styles.donutWrap}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={summary}
        className={styles.donutSvg}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--ds-color-surface-sunken)"
          strokeWidth={14}
        />
        {segments.map(
          (segment) =>
            segment.dash > 0 && (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={14}
                strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
                strokeDashoffset={-segment.offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>
                  {segment.detail ?? `${segment.label}: ${segment.value}`}
                </title>
              </circle>
            ),
        )}
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className={styles.donutCenterValue}
        >
          {total}
        </text>
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          className={styles.donutCenterLabel}
        >
          {centerLabel}
        </text>
      </svg>
      <ul className={styles.legend} aria-hidden={false}>
        {segments.map((segment) => {
          const content = (
            <>
              <span
                className={styles.legendSwatch}
                style={{ background: segment.color }}
                aria-hidden
              />
              <span className={styles.legendLabel}>{segment.label}</span>
              <span className={styles.legendValue}>{segment.value}</span>
            </>
          );

          return (
            <li key={segment.key}>
              {segment.href ? (
                <Link
                  href={segment.href}
                  className={styles.legendItem}
                  data-link="true"
                  title={segment.detail ?? `${segment.label}: ${segment.value}`}
                >
                  {content}
                </Link>
              ) : (
                <span className={styles.legendItem}>{content}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bars
// ---------------------------------------------------------------------------

export function BarChart({
  data,
  summary,
  color = "var(--ds-color-danger)",
}: {
  data: ChartDatum[];
  summary: string;
  color?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div>
      <SrSummary summary={summary} />
      <ul className={styles.barList} aria-hidden>
        {data.map((item) => {
          const width = `${Math.max((item.value / max) * 100, 2)}%`;
          const rowContent = (
            <>
              <span className={styles.barLabel}>{item.label}</span>
              <span className={styles.barTrack}>
                <span
                  className={styles.barFill}
                  style={{ width, background: item.color ?? color }}
                />
              </span>
              <span className={styles.barValue}>{item.value}</span>
            </>
          );

          return (
            <li key={item.key}>
              {item.href ? (
                <Link
                  href={item.href}
                  className={styles.barRow}
                  data-link="true"
                  title={item.detail ?? `${item.label}: ${item.value}`}
                  tabIndex={-1}
                >
                  {rowContent}
                </Link>
              ) : (
                <span
                  className={styles.barRow}
                  title={item.detail ?? `${item.label}: ${item.value}`}
                >
                  {rowContent}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line / trend
// ---------------------------------------------------------------------------

export function LineChart({
  points,
  summary,
  height = 120,
  formatLabel,
}: {
  points: Array<{ key: string; label: string; value: number }>;
  summary: string;
  height?: number;
  formatLabel?: (label: string, index: number) => string;
}) {
  const width = 320;
  const paddingX = 8;
  const paddingTop = 10;
  const paddingBottom = 22;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;
  const max = Math.max(...points.map((point) => point.value), 1);

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? paddingX + innerWidth / 2
        : paddingX + (index / (points.length - 1)) * innerWidth;
    const y = paddingTop + innerHeight - (point.value / max) * innerHeight;
    return { ...point, x, y };
  });

  const path = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x},${coord.y}`)
    .join(" ");

  const areaPath = `${path} L${coords[coords.length - 1]?.x ?? paddingX},${paddingTop + innerHeight} L${coords[0]?.x ?? paddingX},${paddingTop + innerHeight} Z`;

  // Show at most ~5 x-axis labels to avoid crowding.
  const labelStep = Math.max(1, Math.ceil(points.length / 5));

  return (
    <div className={styles.lineWrap}>
      <SrSummary summary={summary} />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.lineSvg}
        aria-hidden
      >
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1={paddingX}
            x2={width - paddingX}
            y1={paddingTop + innerHeight * (1 - fraction)}
            y2={paddingTop + innerHeight * (1 - fraction)}
            className={styles.lineGrid}
          />
        ))}
        {coords.length > 1 && <path d={areaPath} className={styles.lineArea} />}
        {coords.length > 1 && <path d={path} className={styles.lineStroke} />}
        {coords.map((coord, index) => (
          <g key={coord.key}>
            <circle cx={coord.x} cy={coord.y} r={3.2} className={styles.lineDot}>
              <title>{`${coord.label}: ${coord.value}`}</title>
            </circle>
            {index % labelStep === 0 && (
              <text
                x={coord.x}
                y={height - 6}
                textAnchor="middle"
                className={styles.lineAxisLabel}
              >
                {formatLabel ? formatLabel(coord.label, index) : coord.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
