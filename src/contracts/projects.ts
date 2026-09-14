export interface ProjectHolidayDto {
  date: string;
  name: string | null;
}

export interface ProjectCalendarDto {
  timezone: "Asia/Seoul";
  weekendDays: [6, 0];
  holidays: ProjectHolidayDto[];
}

export interface ProjectDto {
  publicId: string;
  name: string;
  description: string;
  revision: number;
  calendar: ProjectCalendarDto;
}

export interface ProjectListItemDto {
  publicId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse { data: { projects: ProjectListItemDto[] } }

export interface ProjectTaskDto {
  taskId: string;
  externalId: string;
  name: string;
  type: "task" | "summary" | "milestone";
  scheduleMode: "auto" | "manual";
  requestedStart: string | null;
  start: string;
  end: string;
  duration: number;
  progress: number;
  description: string | null;
  url: string | null;
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
export interface CreateProjectRequest { name: string; description: string; editPassword: string }
export interface CreateProjectResponse { data: { project: ProjectDto; permission: "edit" } }
export interface CopyProjectRequest { name: string; description?: string; editPassword: string }
export interface CopyProjectResponse { data: { project: ProjectDto; permission: "edit" } }
export interface ProjectSnapshotResponse { data: { project: ProjectDto; tasks: ProjectTaskDto[]; links: ProjectLinkDto[]; permission: ProjectPermission } }
export interface UnlockProjectRequest { editPassword: string }
export interface CurrentEditSessionResponse { data: { permission: "edit"; expiresAt: string } | { permission: "readonly" } }
export interface UpdateProjectRequest { name?: string; description?: string }
export interface ProjectMetadataMutationResponse {
  data: { project: ProjectDto; tasks: ProjectTaskDto[]; links: ProjectLinkDto[]; warnings: []; operation: { kind: "projectMetadata"; changedFields: ("name" | "description")[] } }
}
export interface CreateTaskRequest {
  externalId?: string; parentTaskId?: string; convertParentToSummary?: true; name: string; type: "task" | "milestone";
  scheduleMode?: "auto" | "manual"; start: string; end?: string; duration: number; progress: number; parentExternalId?: null;
  description?: string | null; url?: string | null;
}
export interface UpdateTaskRequest {
  name?: string; scheduleMode?: "auto" | "manual"; start?: string; end?: string; duration?: number; progress?: number;
  description?: string | null; url?: string | null;
}
export interface ScheduleWarningDto { code: "NON_WORKING_START_SHIFTED"; path: "start"; requestedStart: string; start: string }
export type TaskMutationKind = "taskCreate" | "taskUpdate" | "taskDelete";
export interface TaskMutationResponse {
  data: { project: ProjectDto; tasks: ProjectTaskDto[]; links: ProjectLinkDto[]; warnings: ScheduleWarningDto[]; operation: { kind: TaskMutationKind; changedTaskExternalIds: string[]; deletedTaskExternalIds: string[]; deletedLinkIds: string[] } }
}
export interface ChangeEditPasswordRequest { newEditPassword: string }
export interface ApiErrorDetail { path?: string; code: string; message: string }
export interface ApiErrorResponse { error: { code: string; message: string; details: ApiErrorDetail[]; requestId: string } }
