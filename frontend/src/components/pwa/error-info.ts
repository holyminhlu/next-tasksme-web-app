export type ErrorReference = {
  /** Next.js server error digest, when available. */
  digest?: string;
  /** Backend request ID (from the API error envelope), when available. */
  requestId?: string;
};

/**
 * Extracts safe, non-sensitive reference identifiers from an unknown error.
 * Raw error messages are intentionally never surfaced to the user.
 */
export function getErrorReference(error: unknown): ErrorReference {
  const reference: ErrorReference = {};

  if (typeof error === "object" && error !== null) {
    const candidate = error as { digest?: unknown; requestId?: unknown };

    if (typeof candidate.digest === "string" && candidate.digest.length > 0) {
      reference.digest = candidate.digest;
    }

    if (
      typeof candidate.requestId === "string" &&
      candidate.requestId.length > 0
    ) {
      reference.requestId = candidate.requestId;
    }
  }

  return reference;
}

/** Human-readable reference line for support, or null when nothing useful. */
export function formatErrorReference(reference: ErrorReference): string | null {
  if (reference.requestId) {
    return `Request ID: ${reference.requestId}`;
  }
  if (reference.digest) {
    return `Error reference: ${reference.digest}`;
  }
  return null;
}
