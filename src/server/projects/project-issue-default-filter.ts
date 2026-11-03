import "server-only";

import type { IssueStatusFilter } from "../../contracts/project-issues";
import { getServerLogger } from "../logging/logger";
import { resolveProjectIssueDefaultStatusFilter } from "./project-issue-default-filter-core";

let loggedInvalidConfiguration = false;

/** Read at request/runtime, not during Next.js image build. */
export function getProjectIssueDefaultStatusFilter(): IssueStatusFilter {
  const resolved = resolveProjectIssueDefaultStatusFilter(process.env.PROJECT_ISSUE_DEFAULT_STATUS_FILTER);
  if (resolved.invalid && !loggedInvalidConfiguration) {
    loggedInvalidConfiguration = true;
    getServerLogger().warn("project_issue_default_status_filter_invalid", {
      configurationKey: "PROJECT_ISSUE_DEFAULT_STATUS_FILTER",
      fallbackStatus: resolved.status,
    });
  }
  return resolved.status;
}
