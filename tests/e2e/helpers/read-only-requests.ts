/** WBS view report/details/scope are read-only POST queries, not mutations.
 * Only the exact public query endpoint is excluded from write-zero observers.
 */
export function isWbsViewReadQuery(request: { method(): string; url(): string }): boolean {
  return request.method() === "POST" &&
    /^\/api\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/resource-dashboard\/views$/.test(new URL(request.url()).pathname);
}
