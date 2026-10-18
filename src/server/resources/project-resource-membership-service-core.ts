import type Database from "better-sqlite3";
import type { ProjectResourceMembershipQuery, ProjectResourceMembershipResponse } from "../../contracts/project-resource-memberships";
import { PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { AuthorizedEditSession } from "../projects/project-service-core";
import { ProjectRepository, EditSessionRepository } from "../repositories/project-repository-core";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { MEMBERSHIP_LIMITS, ProjectResourceMembershipRepository } from "../repositories/project-resource-membership-repository-core";
function assertResponseBudget(response: ProjectResourceMembershipResponse): void {
  if (Buffer.byteLength(JSON.stringify(response), "utf8") > MEMBERSHIP_LIMITS.responseBytes) {
    throw new PublicApiError(422, "RESOURCE_MEMBERSHIP_LIMIT_EXCEEDED", "리소스 조회 응답 한도를 초과했습니다. 조회 범위를 줄여 주세요.");
  }
}
export class ProjectResourceMembershipService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly catalog: ResourceCatalogRepository;
  private readonly memberships: ProjectResourceMembershipRepository;
  constructor(private readonly database: Database.Database, private readonly options: {
    clock?: () => Date;
  } = {}) {
    this.projects = new ProjectRepository(database);
    this.sessions = new EditSessionRepository(database);
    this.catalog = new ResourceCatalogRepository(database);
    this.memberships = new ProjectResourceMembershipRepository(database);
  }
  private read(publicId: string, query: ProjectResourceMembershipQuery): ProjectResourceMembershipResponse {
    const project = this.projects.findByPublicId(publicId);
    if (!project)
      throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    const response = {
      data: {
        projectRevision: project.revision,
        catalogRevision: this.catalog.getRevision(),
        ...this.memberships.list(project.id, query),
      },
    };
    assertResponseBudget(response);
    return response;
  }
  get(publicId: string, query: ProjectResourceMembershipQuery = {}): ProjectResourceMembershipResponse {
    return this.database.transaction(() => this.read(publicId, query)).deferred();
  }
  mutate(authorization: AuthorizedEditSession, expectedRevision: number, resourceId: string, registered: boolean, catalogRevision?: number): ProjectResourceMembershipResponse {
    if (!isCanonicalUuidV4(resourceId) || (registered && (!Number.isSafeInteger(catalogRevision) || (catalogRevision ?? 0) < 1))) {
      throw new PublicApiError(400, "INVALID_REQUEST", "리소스 등록 요청을 확인해 주세요.");
    }
    return this.database.transaction(() => {
      const now = (this.options.clock ?? (() => new Date()))();
      const project = this.projects.findCredentialById(authorization.projectId);
      const session = this.sessions.findById(authorization.sessionId);
      const expiry = session ? Date.parse(session.expiresAt) : NaN;
      if (!project || !session || project.publicId !== authorization.projectPublicId ||
        project.authVersion !== authorization.projectAuthVersion || session.projectId !== project.id ||
        session.authVersion !== project.authVersion || session.revokedAt !== null ||
        !session.tokenHash.equals(authorization.tokenHash) || !Number.isFinite(expiry) || expiry <= now.getTime()) {
        throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "유효한 프로젝트 편집 세션이 필요합니다.");
      }
      if (project.revision !== expectedRevision) {
        throw new PublicApiError(412, "REVISION_MISMATCH", "프로젝트가 변경되었습니다. 새로고침해 주세요.");
      }
      if (registered && this.catalog.getRevision() !== catalogRevision) {
        throw new PublicApiError(412, "CATALOG_REVISION_MISMATCH", "리소스 기준정보가 변경되었습니다. 새로고침해 주세요.");
      }
      const resource = this.catalog.findResourceByPublicId(resourceId);
      if (!resource)
        throw new PublicApiError(404, "RESOURCE_NOT_FOUND", "리소스를 찾을 수 없습니다.");
      if (registered && !resource.active) {
        throw new PublicApiError(409, "RESOURCE_INACTIVE", "비활성 리소스는 새로 등록할 수 없습니다.");
      }
      if (!registered && this.memberships.inUse(project.id, resource.id)) {
        throw new PublicApiError(409, "PROJECT_RESOURCE_IN_USE", "작업 배정 또는 책임·설비·시스템 담당 역할을 먼저 정리해 주세요. 기존 배정은 삭제되지 않았습니다.");
      }
      const changed = registered
        ? this.memberships.register(project.id, resource.id, now.toISOString())
        : this.memberships.unregister(project.id, resource.id);
      if (changed && !this.projects.advanceRevision(project.id, expectedRevision, now.toISOString())) {
        throw new PublicApiError(412, "REVISION_MISMATCH", "프로젝트가 변경되었습니다.");
      }
      // Build and budget the canonical response before COMMIT: any failure rolls both writes back.
      const response = this.read(project.publicId, {});
      response.data.operation = { kind: "resourceMembership", resourceId, registered, changed };
      assertResponseBudget(response);
      return response;
    }).immediate();
  }
}
