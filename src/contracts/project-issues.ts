/** Project Issues are separate from WBS Tasks and GitHub development issues (#838-#840). */
export type ProjectIssueStatus = "registered" | "in_progress" | "completed";
export type IssueStatusFilter = "all" | "open" | ProjectIssueStatus;
export type IssuePageSize = 10 | 20 | 50 | 100;

export type IssueCredentialState = "unconfigured" | "protected";

export interface ProjectIssueDto {
  credentialState: IssueCredentialState;
  status: ProjectIssueStatus;
  issueId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  reporterName: string;
  reporterResourceId: string | null;
  assigneeName: string;
  assigneeResourceId: string | null;
  occurredOn: string;
  completed: boolean;
  completedOn: string | null;
  relatedTaskId: string | null;
  relatedTaskText: string;
}

export interface ProjectIssueInput {
  /** Optional only for legacy callers of the completed boolean API. */
  status?: ProjectIssueStatus;
  title: string;
  description: string;
  reporterName: string;
  reporterResourceId: string | null;
  assigneeName: string;
  assigneeResourceId: string | null;
  occurredOn: string;
  completed: boolean;
  completedOn: string | null;
  relatedTaskId: string | null;
  relatedTaskText: string;
}

export interface ProjectIssueQuery {
  q: string;
  status: IssueStatusFilter;
  page: number;
  limit: IssuePageSize;
}

export interface ProjectIssueListResponse {
  data: {
    projectRevision: number;
    summary: { total: number; completed: number; inProgress: number; registered: number };
    total: number;
    page: number;
    limit: IssuePageSize;
    issues: ProjectIssueDto[];
  };
}
export interface ProjectIssueMutationResponse {
  data: { projectRevision: number; issue: ProjectIssueDto };
}
