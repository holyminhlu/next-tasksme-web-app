"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Pagination.module.css";

export type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  "aria-label"?: string;
};

/** Returns the page numbers to display, with null marking ellipsis gaps. */
export function paginationRange(
  page: number,
  pageCount: number,
): Array<number | null> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const middle = [page - 1, page, page + 1].filter(
    (candidate) => candidate > 1 && candidate < pageCount,
  );

  const range: Array<number | null> = [1];

  if ((middle[0] ?? pageCount) > 2) {
    range.push(null);
  }

  range.push(...middle);

  if ((middle[middle.length - 1] ?? 1) < pageCount - 1) {
    range.push(null);
  }

  range.push(pageCount);
  return range;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  "aria-label": ariaLabel = "Pagination",
}: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label={ariaLabel} className={styles.pagination}>
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} aria-hidden />
      </button>
      {paginationRange(page, pageCount).map((value, index) =>
        value === null ? (
          <span key={`gap-${index}`} className={styles.ellipsis} aria-hidden>
            …
          </span>
        ) : (
          <button
            key={value}
            type="button"
            className={`${styles.pageButton} ${value === page ? styles.pageActive : ""}`.trim()}
            aria-current={value === page ? "page" : undefined}
            aria-label={`Page ${value}`}
            onClick={() => onPageChange(value)}
          >
            {value}
          </button>
        ),
      )}
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
      >
        <ChevronRight size={16} aria-hidden />
      </button>
    </nav>
  );
}
