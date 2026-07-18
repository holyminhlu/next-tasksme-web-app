export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

/**
 * Serializes params into a query string, skipping empty values. Returns an
 * empty string when nothing is set, so it can be appended to a path directly.
 */
export function buildQueryString(params: QueryParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    search.set(key, String(value));
  }

  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}
