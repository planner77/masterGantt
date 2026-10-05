import type { ProjectLogisticsDto } from "./logistics";
import type { ProjectMasterItemDto } from "./project-master";
import type { ProjectAssignmentDto } from "./resources";

export type ProjectStatus = "planned" | "in_progress" | "completed";
export type TaskStatus = "not_started" | "in_progress" | "completed";

export interface ProjectHolidayDto {
  date: string;
  name: string | null;
}

export interface ProjectCalendarExceptionDto extends ProjectHolidayDto {
  dayType: "NON_WORKING" | "WORKING";
  /** Deterministic display projection of every meaningful persisted name for this effective date. */
  names?: string[];
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
  businessUnit?: ProjectMasterItemDto | null;
  product?: ProjectMasterItemDto | null;
  siteEntity?: ProjectMasterItemDto | null;
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
  businessUnit?: ProjectMasterItemDto | null;
  product?: ProjectMasterItemDto | null;
  siteEntity?: ProjectMasterItemDto | null;
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
  start: string | null;
  end: string | null;
  duration: number | null;
  progress: number | null;
  /** Task-level execution status; distinct from ProjectStatus. */
  status?: TaskStatus;
  parentExternalId: string | null;
  siblingOrder: number;
  baselineStart?: string | null;
  baselineDuration?: number | null;
  baselineEnd?: string | null;
}

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export interface ProjectLinkDto {
  id: string;
  predecessorExternalId: string;
  successorExternalId: string;
  type: DependencyType;
  lag: number;
}

export type ProjectPermission = "readonly" | "edit";

export interface CreateProjectRequest {
  name: string;
  description: string;
  ownerName: string;
  editPassword: string;
  /** Omission remains compatible with older clients and creates a planned project. */
  status?: ProjectStatus;
  businessUnitId?: string | null;
  productId?: string | null;
  siteEntityId?: string | null;
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
    assignments?: ProjectAssignmentDto[];
    logistics?: ProjectLogisticsDto;
    permission: "edit";
    operation: {
      kind: "projectCopy";
      sourcePublicId: string;
      sourceRevision: number;
      counts: {
        tasks: number;
        links: number;
        holidays: number;
        assignments?: number;
        processes?: number;
        equipment?: number;
        systems?: number;
      };
    };
    warnings: string[];
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
  businessUnitId?: string | null;
  productId?: string | null;
  siteEntityId?: string | null;
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
      changedFields: ("name" | "description" | "status" | "businessUnitId" | "productId" | "siteEntityId")[];
    };
  };
}

interface CreateTaskCommon {
  externalId?: string;
  parentTaskId?: string;
  convertParentToSummary?: true;
  name: string;
  description?: string | null;
  url?: string | null;
  parentExternalId?: null;
}

export type CreateTaskRequest = CreateTaskCommon & (
  | { type: "task" | "milestone"; scheduleMode?: "auto" | "manual";
      start: string; end?: string; duration: number; progress: number; status?: TaskStatus }
  | { type: "summary"; scheduleMode?: "auto";
      start?: null; end?: null; duration?: null; progress?: null }
);

export interface UpdateTaskRequest {
  name?: string;
  description?: string | null;
  url?: string | null;
  scheduleMode?: "auto" | "manual";
  start?: string;
  end?: string;
  duration?: number;
  progress?: number;
  status?: TaskStatus;
  baselineStart?: string | null;
  baselineDuration?: number | null;
  baselineEnd?: string | null;
  baseline?: {
    start: string;
    duration: number;
  } | null;
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

export type TaskHierarchyCreateSeed = Omit<CreateTaskRequest, "externalId" | "parentTaskId" | "convertParentToSummary" | "parentExternalId"> & (
  | { type: "task" | "milestone"; scheduleMode?: "auto" | "manual";
      start: string; end?: string; duration: number; progress: number }
  | { type: "summary"; scheduleMode?: "auto";
      start?: null; end?: null; duration?: null; progress?: null }
);

/** Explicit Copy sources are bounded independently of descendants/project size. */
export const MAX_TASK_COPY_SOURCES = 500;

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
      kind: "reparent";
      taskId: string;
      anchorTaskId: string;
      placement: TaskHierarchyPlacement;
    }
  | ({
      kind: "copy";
      anchorTaskId: string;
      placement: TaskHierarchyPlacement;
    } & (
      | { taskIds: readonly string[]; taskId?: never }
      | { taskId: string; taskIds?: never }
    ));

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
  type?: DependencyType;
  lag?: number;
}

export interface UpdateLinkRequest {
  type?: DependencyType;
  lag?: number;
}

export type LinkMutationKind = "linkCreate" | "linkUpdate" | "linkDelete";

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
      updatedLinkId?: string;
    };
  };
}
