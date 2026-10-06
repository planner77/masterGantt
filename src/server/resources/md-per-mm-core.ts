/** An omitted query uses the deployment setting; explicit null never acquires a fallback. */
export function resolveMdPerMm(query: number | null | undefined, environmentValue?: string): number | null {
  if (query !== undefined) return typeof query === "number" && Number.isFinite(query) && query > 0 ? query : null;
  if (environmentValue === undefined || environmentValue.trim() === "") return null;
  const parsed = Number(environmentValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function mdPerMmSource(query: number | null | undefined, environmentValue?: string): "query" | "environment" | "unset" {
  return query !== undefined ? "query" : resolveMdPerMm(undefined, environmentValue) === null ? "unset" : "environment";
}
