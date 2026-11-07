import type Database from "better-sqlite3";
import type { ScheduleViewSourceResponse } from "../../contracts/schedule-views";
import { RESOURCE_DASHBOARD_LIMITS } from "../../contracts/resource-dashboard";
import { TaskTargetResolutionError } from "../../domain/logistics/task-target-bindings";
import { PublicApiError } from "../http/api-error-core";
import { LogisticsCompatibilityError } from "../logistics/task-logistics-compatibility-core";
import { ProjectRepository } from "../repositories/project-repository-core";
import { ScheduleViewSourceInvalidError, ScheduleViewSourceRepository } from "../repositories/schedule-view-source-repository-core";
import { isCanonicalUuidV4 } from "./project-contract";
import { ProjectService, type ProjectServiceOptions } from "./project-service-core";

export class ScheduleViewSourceService {
  constructor(private readonly database: Database.Database, private readonly options: Pick<ProjectServiceOptions, "clock"> = {}) {}

  get(publicId: string, rawToken?: string): ScheduleViewSourceResponse {
    try {
      return this.database.transaction(() => {
        if (!isCanonicalUuidV4(publicId)) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
        const access = new ProjectService(this.database, this.options).projectReadAccess(publicId, rawToken);
        if (access === "notFound") throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
        if (access !== "allowed") throw new PublicApiError(401, "PROJECT_LOCKED", "A valid session for this private project is required.");
        const project = new ProjectRepository(this.database).findByPublicId(publicId);
        if (!project) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
        const source = new ScheduleViewSourceRepository(this.database).read(project.id);
        const response: ScheduleViewSourceResponse = { data: { schema: "schedule-view-source/1", projectPublicId: publicId, projectRevision: project.revision, ...source } };
        if (Buffer.byteLength(JSON.stringify(response), "utf8") > RESOURCE_DASHBOARD_LIMITS.reportBytes) {
          throw new PublicApiError(422, "SCHEDULE_VIEW_SOURCE_LIMIT_EXCEEDED", "일정 View 조회 한도를 초과했습니다. 프로젝트의 연결 범위를 확인해 주세요.");
        }
        return response;
      }).deferred();
    } catch (error) {
      if (error instanceof LogisticsCompatibilityError || error instanceof TaskTargetResolutionError) {
        throw new PublicApiError(409, "LOGISTICS_SOURCE_INVALID", "기존 물류 연결 원본의 참조를 확인해 주세요. 원본 자료는 보존됩니다.");
      }
      if (error instanceof ScheduleViewSourceInvalidError) {
        throw new PublicApiError(409, "SCHEDULE_VIEW_SOURCE_INVALID", "일정 View 원본의 참조를 확인해 주세요. 원본 자료는 보존됩니다.");
      }
      throw error;
    }
  }
}
