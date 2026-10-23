import type { ResourceDashboardDto } from "../../contracts/resource-dashboard";

/** A canonical row survives a new read receipt. Its detail still validates that receipt separately. */
export function resourceSummaryRowIdentity(
  report: Pick<ResourceDashboardDto, "projectPublicId">,
  queryKey: string,
  parent: string,
  kind: "group" | "resource",
  id: string | null,
): string {
  return JSON.stringify([report.projectPublicId, queryKey, parent, kind, id]);
}
