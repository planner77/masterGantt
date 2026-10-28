/** Project Issues are separate from WBS Tasks and GitHub development issues (#838-#840). */
export type IssueStatusFilter = "all" | "open" | "completed";
export type IssuePageSize = 10 | 20 | 50 | 100;

export interface ProjectIssueDto {
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
    summary: { total: number; completed: number };
    total: number;
    page: number;
    limit: IssuePageSize;
    issues: ProjectIssueDto[];
  };
}
export interface ProjectIssueMutationResponse {
  data: { projectRevision: number; issue: ProjectIssueDto };
}
