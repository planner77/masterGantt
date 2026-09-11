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
  editPassword: string;
}

export interface CreateProjectResponse {
  data: {
    project: ProjectDto;
    permission: "edit";
  };
}

export interface ProjectSnapshotResponse {
  data: {
    project: ProjectDto;
    tasks: ProjectTaskDto[];
    links: ProjectLinkDto[];
    permission: ProjectPermission;
  };
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
