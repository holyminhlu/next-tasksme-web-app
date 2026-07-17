import type { ReactNode, TableHTMLAttributes } from "react";
import styles from "./Table.module.css";

export type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  /** Accessible summary of the table contents. */
  "aria-label": string;
  containerClassName?: string;
  children: ReactNode;
};

/**
 * Semantic table with horizontal scroll on small screens. Consumers provide
 * plain thead/tbody/tr/th/td elements; styling is applied via the wrapper.
 */
export function Table({
  containerClassName = "",
  className = "",
  children,
  ...rest
}: TableProps) {
  return (
    <div className={`${styles.container} ${containerClassName}`.trim()}>
      <table className={`${styles.table} ${className}`.trim()} {...rest}>
        {children}
      </table>
    </div>
  );
}
