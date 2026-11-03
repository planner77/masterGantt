import type { IssueStatusFilter } from "../../contracts/project-issues";

export type ProjectIssueDefaultStatusFilterResolution = Readonly<{
  status: IssueStatusFilter;
  invalid: boolean;
}>;

/** The initial UI filter is operational configuration, never an authorization rule. */
export function resolveProjectIssueDefaultStatusFilter(
  rawValue: string | undefined,
): ProjectIssueDefaultStatusFilterResolution {
  const value = rawValue?.trim() ?? "";
  if (value === "") return { status: "all", invalid: false };
  if (value === "all" || value === "open" || value === "registered" ||
      value === "in_progress" || value === "completed") {
    return { status: value, invalid: false };
  }
  // No raw configuration text is returned: it could contain secrets.
  return { status: "all", invalid: true };
}
