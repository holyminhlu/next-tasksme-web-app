import type { CSSProperties } from "react";
import styles from "./Skeleton.module.css";

export type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({
  width = "100%",
  height = 16,
  circle = false,
  className = "",
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={`${styles.skeleton} ${circle ? styles.circle : ""} ${className}`.trim()}
      style={{ width, height, ...style }}
    />
  );
}
