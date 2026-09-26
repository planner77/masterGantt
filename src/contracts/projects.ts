import type { ProjectLogisticsDto } from "./logistics";
import type { ProjectAssignmentDto } from "./resources";

export type ProjectStatus = "planned" | "in_progress" | "completed";

export interface ProjectHolidayDto {
  date: string;
  name: string | null;
}

export interface ProjectCalendarExceptionDto extends ProjectHolidayDto {
  dayType: "NON_WORKING" | "WORKING";
}

export interface ProjectCalendarDto {
  timezone: "Asia/Seoul";
  weekendDays: [6, 0];
  holidays: ProjectHolidayDto[];
  /** Canonical snapshots include this; optional keeps older fixtures source-compatible. */
  exceptions?: ProjectCalendarExceptionDto[];
}

export interface ProjectDto {
  publicId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  /** Canonical API responses include this field; null represents a pre-Issue-54 project. */
  ownerName?: string | null;
  revision: number;
  calendar: ProjectCalendarDto;
}

export interface ProjectListItemDto {
  publicId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  /** Canonical API responses include this field; null represents a pre-Issue-54 project. */
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  data: {
    projects: ProjectListItemDto[];
  };
}

export interface ProjectTaskDto {
  taskId: string;
  externalId: string;
  name: string;
  /** Present on canonical API snapshots; optional keeps older fixtures/source adapters compatible. */
  description?: string | null;
  /** Present on canonical API snapshots; only http(s) values are persisted. */
  url?: string | null;
  type: "task" | "summary" | "milestone";
  scheduleMode: "auto" | "manual";
  requestedStart: string | null;
  start: string;
  end: string;
  duration: number;
  progress: number;
  parentExternalId: string | null;
  siblingOrder: number;
}

export interface ProjectLinkDto {
  id: string;
  predecessorExternalId: string;
  successorExternalId: string;
  type: "FS";
  lag: 0;
}

export type ProjectPermission = "readonly" | "edit";

export interface CreateProjectRequest {
  name: string;
  description: string;
  ownerName: string;
  editPassword: string;
  /** Omission remains compatible with older clients and creates a planned project. */
  status?: ProjectStatus;
}

export interface CreateProjectResponse {
  data: {
    project: ProjectDto;
    permission: "edit";
  };
}

export interface CopyProjectRequest {
  name: string;
  description: string;
  /** Required by the HTTP contract; optional only to keep focused legacy service fixtures source-compatible. */
  ownerName?: string;
  editPassword: string;
  resetProgress?: boolean;
}

export interface CopyProjectResponse {
  data: {
    project: ProjectDto;
    tasks: ProjectTaskDto[];
    links: ProjectLinkDto[];
    permission: "edit";
    operation: {
      kind: "projectCopy";
      sourcePublicId: string;
      sourceRevision: number;
      counts: {
        tasks: number;
        links: number;
        holidays: number;
      };
    };
    warnings: [];
  };
}

export interface ProjectSnapshotResponse {
  data: {
    project: ProjectDto;
    tasks: ProjectTaskDto[];
    links: ProjectLinkDto[];
    /** Added by the canonical server adapter; optional for legacy fixtures and focused service tests. */
    assignments?: ProjectAssignmentDto[];
    /** Added by canonical logistics server adapter; optional for legacy fixtures. */
    logistics?: ProjectLogisticsDto;
    permission: ProjectPermission;
  };
}

export interface UnlockProjectRequest {
  editPassword: string;
}

export interface CurrentEditSessionResponse {
  data:
    | { permission: "edit"; expiresAt: string }
    | { permission: "readonly" };
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export interface ProjectMetadataMutationResponse {
  data: {
    project: ProjectDto;
    tasks: ProjectTaskDto[];
    links: ProjectLinkDto[];
    assignments?: ProjectAssignmentDto[];
    logistics?: ProjectLogisticsDto;
    warnings: [];
    operation: {
      kind: "projectMetadata";
      changedFields: ("name" | "description" | "status")[];
    };
  };
}

export interface CreateTaskRequest {
  externalId?: string;
  parentTaskId?: string;
  convertParentToSummary?: true;
  name: string;
  description?: string | null;
  url?: string | null;
  type: "task" | "milestone";
  scheduleMode?: "auto" | "manual";
  start: string;
  end?: string;
  duration: number;
  progress: number;
  parentExternalId?: null;
}

export interface UpdateTaskRequest {
  name?: string;
  description?: string | null;
  url?: string | null;
  scheduleMode?: "auto" | "manual";
  start?: string;
  end?: string;
  duration?: number;
  progress?: number;
}

export type TaskHierarchyPlacement = "before" | "after" | "child";
export type TaskHierarchyCommandKind =
  | "create"
  | "convert"
  | "move"
  | "indent"
  | "outdent"
  | "reparent"
  | "copy";

export interface TaskHierarchyCreateSeed {
  name: string;
  description?: string | null;
  url?: string | null;
  type: "task" | "milestone";
  scheduleMode?: "auto" | "manual";
  start: string;
  end?: string;
  duration: number;
  progress: number;
}

export type TaskHierarchyCommandRequest =
  | {
      kind: "create";
      anchorTaskId: string;
      placement: TaskHierarchyPlacement;
      task: TaskHierarchyCreateSeed;
    }
  | {
      kind: "convert";
      taskId: string;
      targetType: "task" | "summary" | "milestone";
    }
  | {
      kind: "move";
      taskId: string;
      direction: "up" | "down";
    }
  | {
      kind: "indent" | "outdent";
      taskId: string;
    }
  | {
      kind: "reparent" | "copy";
      taskId: string;
      anchorTaskId: string;
      placement: TaskHierarchyPlacement;
    };

export interface ScheduleWarningDto {
  code: "NON_WORKING_START_SHIFTED";
  path: "start";
  requestedStart: string;
  start: string;
}

export type TaskMutationKind = "taskCreate" | "taskUpdate" | "taskDelete" | "taskHierarchy";

export interface TaskMutationResponse {
  data: {
    project: ProjectDto;
    tasks: ProjectTaskDto[];
    links: ProjectLinkDto[];
    assignments?: ProjectAssignmentDto[];
    logistics?: ProjectLogisticsDto;
    warnings: ScheduleWarningDto[];
    operation: {
      kind: TaskMutationKind;
      /** Present for atomic context-menu hierarchy commands. */
      command?: TaskHierarchyCommandKind;
      changedTaskExternalIds: string[];
      deletedTaskExternalIds: string[];
      deletedLinkIds: string[];
    };
  };
}

export interface ChangeEditPasswordRequest {
  newEditPassword: string;
}

export interface ApiErrorDetail {
  path?: string;
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details: ApiErrorDetail[];
    requestId: string;
  };
}


export interface CreateLinkRequest {
  predecessorExternalId: string;
  successorExternalId: string;
  type: "FS";
  lag: 0;
}

export type LinkMutationKind = "linkCreate" | "linkDelete";

export interface LinkMutationResponse {
  data: {
    project: ProjectDto;
    tasks: ProjectTaskDto[];
    links: ProjectLinkDto[];
    assignments?: ProjectAssignmentDto[];
    logistics?: ProjectLogisticsDto;
    warnings: ScheduleWarningDto[];
    operation: {
      kind: LinkMutationKind;
      changedTaskExternalIds: string[];
      deletedLinkIds: string[];
    };
  };
}
