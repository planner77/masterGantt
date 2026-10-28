import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  ProjectIssueDto, ProjectIssueInput, ProjectIssueListResponse,
  ProjectIssueMutationResponse, ProjectIssueQuery,
} from "../../contracts/project-issues";
import { PublicApiError } from "../http/api-error-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { AuthorizedEditSession } from "../projects/project-service-core";
import { EditSessionRepository, ProjectRepository } from "../repositories/project-repository-core";

interface IssueRow {
  public_id: string; title: string; description: string; reporter_name: string;
  reporter_resource_public_id: string | null; assignee_name: string;
  assignee_resource_public_id: string | null; occurred_on: string; completed: number;
  completed_on: string | null; related_task_public_id: string | null;
  related_task_text: string; created_at: string; updated_at: string;
}
type Clock = () => Date;
function dto(row: IssueRow): ProjectIssueDto {
  return {
    issueId: row.public_id, title: row.title, description: row.description,
    reporterName: row.reporter_name, reporterResourceId: row.reporter_resource_public_id,
    assigneeName: row.assignee_name, assigneeResourceId: row.assignee_resource_public_id,
    occurredOn: row.occurred_on, completed: row.completed === 1, completedOn: row.completed_on,
    relatedTaskId: row.related_task_public_id, relatedTaskText: row.related_task_text,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function invalid(message = "Issue 입력값을 확인해 주세요."): never {
  throw new PublicApiError(400, "INVALID_ISSUE", message);
}
function textField(value: unknown, maximum: number, required = false): string {
  if (typeof value !== "string") invalid();
  const result = (value as string).trim();
  if (Array.from(result).length > maximum || (required && !result) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) invalid();
  return result;
}
function dateField(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid("실제 존재하는 날짜를 입력해 주세요.");
  return value;
}
function reference(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !isCanonicalUuidV4(value)) invalid("원본 리소스·Task ID를 확인해 주세요.");
  return value;
}
export function projectIssueToday(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const find = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return find("year") + "-" + find("month") + "-" + find("day");
}
export function parseProjectIssueInput(raw: unknown): ProjectIssueInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid();
  const data = raw as Record<string, unknown>;
  const keys = ["title", "description", "reporterName", "reporterResourceId", "assigneeName",
    "assigneeResourceId", "occurredOn", "completed", "completedOn", "relatedTaskId", "relatedTaskText"];
  if (Object.keys(data).length !== keys.length || Object.keys(data).some(key => !keys.includes(key))) invalid();
  if (typeof data.completed !== "boolean") invalid();
  const completedOn = data.completedOn === null ? null : dateField(data.completedOn);
  if (data.completed !== (completedOn !== null)) invalid("완료 여부와 완료일을 함께 지정해 주세요.");
  return {
    title: textField(data.title, 160, true),
    description: textField(data.description, 4000),
    reporterName: textField(data.reporterName, 120),
    reporterResourceId: reference(data.reporterResourceId),
    assigneeName: textField(data.assigneeName, 120),
    assigneeResourceId: reference(data.assigneeResourceId),
    occurredOn: dateField(data.occurredOn),
    completed: data.completed,
    completedOn,
    relatedTaskId: reference(data.relatedTaskId),
    relatedTaskText: textField(data.relatedTaskText, 200),
  };
}
export function parseProjectIssueQuery(params: URLSearchParams): ProjectIssueQuery {
  const allowed = new Set(["q", "status", "page", "limit"]);
  for (const key of params.keys()) if (!allowed.has(key) || params.getAll(key).length !== 1) invalid("검색 조건이 올바르지 않습니다.");
  const q = params.get("q") ?? "", status = params.get("status") ?? "all";
  const p = params.get("page") ?? "1", l = params.get("limit") ?? "20";
  if (Array.from(q).length > 160 || !["all", "open", "completed"].includes(status) ||
    !/^[1-9]\d*$/.test(p) || !["10", "20", "50", "100"].includes(l) ||
    !Number.isSafeInteger(Number(p)) || Number(p) > 100000) invalid("검색 조건이 올바르지 않습니다.");
  return { q: q.trim(), status: status as ProjectIssueQuery["status"],
    page: Number(p), limit: Number(l) as ProjectIssueQuery["limit"] };
}
export class ProjectIssueService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  constructor(private readonly database: Database.Database,
    private readonly options: { clock?: Clock; generateId?: () => string } = {}) {
    this.projects = new ProjectRepository(database);
    this.sessions = new EditSessionRepository(database);
  }
  private findIssue(projectId: number, issueId: string): ProjectIssueDto {
    const row = this.database.prepare("SELECT * FROM project_issues WHERE project_id = ? AND public_id = ?")
      .get(projectId, issueId) as IssueRow | undefined;
    if (!row) throw new PublicApiError(404, "ISSUE_NOT_FOUND", "Issue를 찾을 수 없습니다.");
    return dto(row);
  }
  list(publicId: string, query: ProjectIssueQuery): ProjectIssueListResponse {
    return this.database.transaction(() => {
      const project = this.projects.findByPublicId(publicId);
      if (!project) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
      const summary = this.database.prepare(
        "SELECT COUNT(*) AS total, COALESCE(SUM(completed), 0) AS completed FROM project_issues WHERE project_id = ?"
      ).get(project.id) as { total: number; completed: number };
      const where = ["project_id = @projectId"];
      const params: Record<string, unknown> = { projectId: project.id };
      if (query.status !== "all") where.push("completed = " + (query.status === "completed" ? "1" : "0"));
      if (query.q) { params.q = query.q; where.push("(instr(lower(title),lower(@q)) > 0 OR instr(lower(description),lower(@q)) > 0 OR instr(lower(reporter_name),lower(@q)) > 0 OR instr(lower(assignee_name),lower(@q)) > 0 OR instr(lower(related_task_text),lower(@q)) > 0)"); }
      const predicate = where.join(" AND ");
      const total = (this.database.prepare("SELECT COUNT(*) AS count FROM project_issues WHERE " + predicate)
        .get(params) as { count: number }).count;
      const offset = (query.page - 1) * query.limit;
      const rows = this.database.prepare("SELECT * FROM project_issues WHERE " + predicate +
        " ORDER BY created_at DESC, id DESC LIMIT @limit OFFSET @offset")
        .all({ ...params, limit: query.limit, offset }) as IssueRow[];
      return { data: {
        projectRevision: project.revision, summary, total, page: query.page, limit: query.limit,
        issues: rows.map(dto),
      } };
    }).deferred();
  }
  private current(authorization: AuthorizedEditSession, expectedRevision: number, now: Date) {
    const project = this.projects.findCredentialById(authorization.projectId);
    const session = this.sessions.findById(authorization.sessionId);
    if (!project || !session || project.publicId !== authorization.projectPublicId ||
      project.authVersion !== authorization.projectAuthVersion ||
      session.projectId !== project.id || session.authVersion !== project.authVersion ||
      !session.tokenHash.equals(authorization.tokenHash) || session.revokedAt !== null ||
      !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now.getTime()) {
      throw new PublicApiError(401, "EDIT_SESSION_REQUIRED", "유효한 프로젝트 편집 세션이 필요합니다.");
    }
    if (project.revision !== expectedRevision)
      throw new PublicApiError(412, "REVISION_MISMATCH", "프로젝트가 변경되었습니다. 새로고침해 주세요.");
    return project;
  }
  private resolveInput(projectId: number, input: ProjectIssueInput): ProjectIssueInput {
    const resolvePerson = (resourceId: string | null, typed: string): string => {
      if (!resourceId) return typed;
      const row = this.database.prepare("SELECT name FROM resources WHERE public_id = ?")
        .get(resourceId) as { name: string } | undefined;
      if (!row) invalid("선택한 리소스가 존재하지 않습니다.");
      return row.name;
    };
    let relatedTaskText = input.relatedTaskText;
    if (input.relatedTaskId) {
      const row = this.database.prepare("SELECT name FROM tasks WHERE project_id = ? AND public_id = ?")
        .get(projectId, input.relatedTaskId) as { name: string } | undefined;
      if (!row) invalid("다른 프로젝트의 Task 또는 삭제된 Task는 연결할 수 없습니다.");
      relatedTaskText = row.name;
    }
    return { ...input,
      reporterName: resolvePerson(input.reporterResourceId, input.reporterName),
      assigneeName: resolvePerson(input.assigneeResourceId, input.assigneeName),
      relatedTaskText,
    };
  }
  mutate(authorization: AuthorizedEditSession, expectedRevision: number,
    rawInput: ProjectIssueInput, issueId?: string): ProjectIssueMutationResponse {
    if (issueId && !isCanonicalUuidV4(issueId)) invalid("Issue ID가 올바르지 않습니다.");
    return this.database.transaction(() => {
      const now = (this.options.clock ?? (() => new Date()))();
      const nowText = now.toISOString();
      const project = this.current(authorization, expectedRevision, now);
      const input = this.resolveInput(project.id, rawInput);
      const params = {
        projectId: project.id, ...input,
        title: input.title, description: input.description,
        reporterResourceId: input.reporterResourceId, assigneeResourceId: input.assigneeResourceId,
        relatedTaskId: input.relatedTaskId,
        completed: input.completed ? 1 : 0,
        createdAt: nowText, updatedAt: nowText,
        issueId: issueId ?? (this.options.generateId ?? randomUUID)(),
      };
      if (!isCanonicalUuidV4(params.issueId)) invalid("Issue ID가 올바르지 않습니다.");
      if (issueId) {
        const result = this.database.prepare(
          "UPDATE project_issues SET title=@title, description=@description, reporter_name=@reporterName, reporter_resource_public_id=@reporterResourceId, assignee_name=@assigneeName, assignee_resource_public_id=@assigneeResourceId, occurred_on=@occurredOn, completed=@completed, completed_on=@completedOn, related_task_public_id=@relatedTaskId, related_task_text=@relatedTaskText, updated_at=@updatedAt WHERE public_id=@issueId AND project_id=@projectId"
        ).run(params);
        if (result.changes !== 1) throw new PublicApiError(404, "ISSUE_NOT_FOUND", "Issue를 찾을 수 없습니다.");
      } else {
        this.database.prepare(
          "INSERT INTO project_issues(public_id, project_id, title, description, reporter_name, reporter_resource_public_id, assignee_name, assignee_resource_public_id, occurred_on, completed, completed_on, related_task_public_id, related_task_text, created_at, updated_at) VALUES(@issueId,@projectId,@title,@description,@reporterName,@reporterResourceId,@assigneeName,@assigneeResourceId,@occurredOn,@completed,@completedOn,@relatedTaskId,@relatedTaskText,@createdAt,@updatedAt)"
        ).run(params);
      }
      const updated = this.projects.advanceRevision(project.id, expectedRevision, nowText);
      if (!updated) throw new PublicApiError(412, "REVISION_MISMATCH", "프로젝트가 변경되었습니다.");
      return { data: { projectRevision: updated.revision,
        issue: this.findIssue(project.id, params.issueId) } };
    }).immediate();
  }
}
