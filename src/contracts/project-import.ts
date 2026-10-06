import type { ProjectCalendarDto, ProjectSnapshotResponse, TaskStatus } from "./projects";

export interface ImportDiagnosticDto {
  code: string;
  path: string;
  message: string;
  externalId?: string;
}

export interface ImportPreviewScheduleDto {
  requestedStart: string | null;
  start: string | null;
  end: string | null;
  duration: number | null;
  progress: number | null;
  status: TaskStatus | null;
  baselineStart: string | null;
  baselineDuration: number | null;
  baselineEnd: string | null;
}

/** Preview identities are batch external IDs, never newly issued target Task UUIDs. */
export interface ImportPreviewTaskDto extends ImportPreviewScheduleDto {
  externalId: string;
  sourceTaskId: string | null;
  name: string;
  type: "task" | "summary" | "milestone";
  parentExternalId: string | null;
  description: string | null;
  url: string | null;
  scheduleMode: "auto" | "manual";
  membership: {
    explicitMilestoneExternalId: string | null;
    effectiveMilestoneExternalId: string | null;
    inheritedFromExternalId: string | null;
  };
}

export interface ImportPreviewChangeDto {
  externalId: string;
  before: ImportPreviewScheduleDto;
  after: ImportPreviewScheduleDto;
  reasonCodes: string[];
}

export interface ProjectImportPreviewDto {
  schemaVersion: "1.0" | "1.1";
  projectPublicId: string;
  baseRevision: number;
  /** SHA256 binds original file bytes, target publicId and baseRevision; this is not authorization. */
  previewDigest: string;
  canCommit: boolean;
  sourceProject: { name: string; description: string };
  summary: { taskCreates: number; linkCreates: number; explicitMembershipCreates: number };
  normalizedTasks: ImportPreviewTaskDto[];
  changedTasks: ImportPreviewChangeDto[];
  warnings: ImportDiagnosticDto[];
  targetCalendar: ProjectCalendarDto;
}

export interface ProjectImportPreviewResponse { data: ProjectImportPreviewDto }
export type ProjectImportCommitResponse = ProjectSnapshotResponse;

export const IMPORT_PREVIEW_DIGEST_HEADER = "X-Import-Preview-Digest";
