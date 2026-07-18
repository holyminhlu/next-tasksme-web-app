const RANK_GAP = 1000;
const RANK_PAD = 16;

export function formatRank(value: number): string {
  const safe = Math.max(1, Math.floor(value));
  return String(safe).padStart(RANK_PAD, "0");
}

export function parseRank(rank: string | null | undefined): number {
  if (!rank) return 0;
  const parsed = Number(rank);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function initialRank(index: number): string {
  return formatRank((index + 1) * RANK_GAP);
}

export function nextRankAfter(lastRank: string | null | undefined): string {
  if (!lastRank) return formatRank(RANK_GAP);
  return formatRank(parseRank(lastRank) + RANK_GAP);
}

/**
 * Computes a rank strictly between `before` and `after`.
 * Returns null when the gap is exhausted and the column should be rebalanced.
 */
export function rankBetween(
  before: string | null | undefined,
  after: string | null | undefined,
): string | null {
  if (!before && !after) {
    return formatRank(RANK_GAP);
  }

  if (!before && after) {
    const afterValue = parseRank(after);
    if (afterValue <= 1) return null;
    return formatRank(Math.floor(afterValue / 2));
  }

  if (before && !after) {
    return formatRank(parseRank(before) + RANK_GAP);
  }

  const left = parseRank(before);
  const right = parseRank(after);
  if (right - left <= 1) return null;
  return formatRank(Math.floor((left + right) / 2));
}

export function rebalanceRanks(count: number): string[] {
  return Array.from({ length: count }, (_, index) => initialRank(index));
}
