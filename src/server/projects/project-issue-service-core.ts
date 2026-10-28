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
import {
  hashEditPassword, verifyEditPassword, type PasswordHashRecord, type PersistedPasswordRecord,
} from "../security/password-core";

interface IssueRow {
  id: number; public_id: string; title: string; description: string; reporter_name: string;
  reporter_resource_public_id: string | null; assignee_name: string;
  assignee_resource_public_id: string | null; occurred_on: string; completed: number;
  completed_on: string | null; related_task_public_id: string | null;
  related_task_text: string; created_at: string; updated_at: string;
  lifecycle_state: "ACTIVE" | "DELETED"; deleted_at: string | null;
  credential_state: "UNSET" | "ACTIVE"; credential_version: number;
  password_kdf: string | null; password_salt: Buffer | null; password_hash: Buffer | null;
  scrypt_n: number | null; scrypt_r: number | null; scrypt_p: number | null;
  scrypt_key_length: number | null;
}
type Clock = () => Date;
const missingMessage = "Issue를 찾을 수 없습니다.";
const invalidPasswordMessage = "Issue 비밀번호를 확인해 주세요.";

function dto(row: IssueRow): ProjectIssueDto {
  return {
    issueId: row.public_id, title: row.title, description: row.description,
    credentialState: row.credential_state === "ACTIVE" ? "protected" : "unconfigured",
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
function objectBody(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) invalid();
  return raw as Record<string, unknown>;
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
  const data = objectBody(raw);
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
function passwordField(raw: unknown): string {
  if (typeof raw !== "string" || Array.from(raw).length < 8 ||
    Array.from(raw).length > 128 || Buffer.byteLength(raw, "utf8") > 512 ||
    /[\u0000-\u001f\u007f]/.test(raw)) {
    invalid("비밀번호는 제어문자 없이 8~128자로 입력해 주세요.");
  }
  return raw;
}
function passwordConfirmation(password: string, confirmation: unknown): void {
  if (typeof confirmation !== "string" || confirmation !== password)
    invalid("비밀번호 확인이 일치하지 않습니다.");
}
export function parseIssueCreateRequest(raw: unknown): { input: ProjectIssueInput; password: string } {
  const { issuePassword, confirmIssuePassword, ...fields } = objectBody(raw);
  const input = parseProjectIssueInput(fields);
  const password = passwordField(issuePassword);
  passwordConfirmation(password, confirmIssuePassword);
  return { input, password };
}
export function parseIssueUpdateRequest(raw: unknown): { input: ProjectIssueInput; password: string } {
  const { issuePassword, ...fields } = objectBody(raw);
  return { input: parseProjectIssueInput(fields), password: passwordField(issuePassword) };
}
export function parseIssueDeleteRequest(raw: unknown): { password: string } {
  const data = objectBody(raw);
  if (Object.keys(data).length !== 1) invalid();
  return { password: passwordField(data.issuePassword) };
}
export function parseIssueCredentialRequest(raw: unknown): {
  operation: "initialize" | "reset"; projectPassword: string; newPassword: string;
} {
  const data = objectBody(raw);
  if (Object.keys(data).length !== 4 ||
    !Object.keys(data).every(key => ["operation", "projectPassword", "newPassword", "confirmPassword"].includes(key)) ||
    (data.operation !== "initialize" && data.operation !== "reset"))
    invalid();
  const newPassword = passwordField(data.newPassword);
  passwordConfirmation(newPassword, data.confirmPassword);
  return { operation: data.operation, projectPassword: passwordField(data.projectPassword), newPassword };
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
function persistedIssueCredential(row: IssueRow | undefined): PersistedPasswordRecord | undefined {
  if (!row || row.credential_state !== "ACTIVE") return undefined;
  return {
    algorithm: row.password_kdf ?? "", salt: row.password_salt as Buffer,
    hash: row.password_hash as Buffer, n: row.scrypt_n ?? 0, r: row.scrypt_r ?? 0,
    p: row.scrypt_p ?? 0, keyLength: row.scrypt_key_length ?? 0,
  };
}
function sameCredential(a: IssueRow, b: IssueRow): boolean {
  return a.credential_state === "ACTIVE" && b.credential_state === "ACTIVE" &&
    a.credential_version === b.credential_version &&
    Buffer.isBuffer(a.password_hash) && Buffer.isBuffer(b.password_hash) &&
    Buffer.isBuffer(a.password_salt) && Buffer.isBuffer(b.password_salt) &&
    a.password_hash.equals(b.password_hash) && a.password_salt.equals(b.password_salt);
}
function passwordSql(hash: PasswordHashRecord) {
  return {
    passwordKdf: hash.algorithm, passwordSalt: hash.salt, passwordHash: hash.hash,
    scryptN: hash.n, scryptR: hash.r, scryptP: hash.p, scryptKeyLength: hash.keyLength,
  };
}
export class ProjectIssueService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  constructor(private readonly database: Database.Database,
    private readonly options: {
      clock?: Clock; generateId?: () => string;
      hashPassword?: (value: string) => Promise<PasswordHashRecord>;
      verifyPassword?: (value: string, stored: PersistedPasswordRecord | undefined) => Promise<boolean>;
      verifyProjectPassword?: (value: string, stored: PersistedPasswordRecord | undefined) => Promise<boolean>;
    } = {}) {
    this.projects = new ProjectRepository(database);
    this.sessions = new EditSessionRepository(database);
  }
  private findIssue(projectId: number, issueId: string): IssueRow {
    const row = this.database.prepare(
      "SELECT * FROM project_issues WHERE project_id = ? AND public_id = ? AND lifecycle_state = 'ACTIVE'"
    ).get(projectId, issueId) as IssueRow | undefined;
    if (!row) throw new PublicApiError(404, "ISSUE_NOT_FOUND", missingMessage);
    return row;
  }
  list(publicId: string, query: ProjectIssueQuery): ProjectIssueListResponse {
    return this.database.transaction(() => {
      const project = this.projects.findByPublicId(publicId);
      if (!project) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
      const summary = this.database.prepare(
        "SELECT COUNT(*) AS total, COALESCE(SUM(completed), 0) AS completed FROM project_issues WHERE project_id = ? AND lifecycle_state = 'ACTIVE'"
      ).get(project.id) as { total: number; completed: number };
      const where = ["project_id = @projectId", "lifecycle_state = 'ACTIVE'"];
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
  private currentReadProject(publicId: string, revision: number) {
    const project = this.projects.findByPublicId(publicId);
    if (!project) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    if (project.revision !== revision)
      throw new PublicApiError(412, "REVISION_MISMATCH", "프로젝트가 변경되었습니다. 새로고침해 주세요.");
    return project;
  }
  private resolveInput(projectId: number, input: ProjectIssueInput): ProjectIssueInput {
    const resolvePerson = (resourceId: string | null, typed: string): string => {
      if (!resourceId) return typed;
      // Only project-visible resources (not the entire global catalog) can be referenced.
      const row = this.database.prepare(`
        SELECT r.name FROM resources r WHERE r.public_id = ? AND (
          EXISTS(SELECT 1 FROM project_resource_memberships m WHERE m.project_id = ? AND m.resource_id = r.id)
          OR EXISTS(SELECT 1 FROM task_assignments a WHERE a.project_id = ? AND a.resource_id = r.id)
          OR EXISTS(SELECT 1 FROM project_equipment_resource_roles e WHERE e.project_id = ? AND e.resource_id = r.id)
          OR EXISTS(SELECT 1 FROM project_system_resource_roles s WHERE s.project_id = ? AND s.resource_id = r.id)
        )
      `).get(resourceId, projectId, projectId, projectId, projectId) as { name: string } | undefined;
      if (!row) invalid("선택한 리소스는 현재 프로젝트에서 사용할 수 없습니다.");
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
  private issueParams(projectId: number, input: ProjectIssueInput, issueId: string, nowText: string) {
    return {
      projectId, ...input, completed: input.completed ? 1 : 0,
      issueId, createdAt: nowText, updatedAt: nowText,
    };
  }
  private advance(projectId: number, expectedRevision: number, nowText: string): number {
    const updated = this.projects.advanceRevision(projectId, expectedRevision, nowText);
    if (!updated) throw new PublicApiError(412, "REVISION_MISMATCH", "프로젝트가 변경되었습니다.");
    return updated.revision;
  }
  async create(authorization: AuthorizedEditSession, expectedRevision: number,
    rawInput: ProjectIssueInput, password: string): Promise<ProjectIssueMutationResponse> {
    const hashed = await (this.options.hashPassword ?? hashEditPassword)(password);
    return this.database.transaction(() => {
      const now = (this.options.clock ?? (() => new Date()))();
      const nowText = now.toISOString();
      const project = this.current(authorization, expectedRevision, now);
      const input = this.resolveInput(project.id, rawInput);
      const issueId = (this.options.generateId ?? randomUUID)();
      if (!isCanonicalUuidV4(issueId)) invalid("Issue ID가 올바르지 않습니다.");
      const params = { ...this.issueParams(project.id, input, issueId, nowText), ...passwordSql(hashed) };
      this.database.prepare(
        "INSERT INTO project_issues(public_id, project_id, title, description, reporter_name, reporter_resource_public_id, assignee_name, assignee_resource_public_id, occurred_on, completed, completed_on, related_task_public_id, related_task_text, created_at, updated_at, credential_state, credential_version, password_kdf, password_salt, password_hash, scrypt_n, scrypt_r, scrypt_p, scrypt_key_length) VALUES(@issueId,@projectId,@title,@description,@reporterName,@reporterResourceId,@assigneeName,@assigneeResourceId,@occurredOn,@completed,@completedOn,@relatedTaskId,@relatedTaskText,@createdAt,@updatedAt,'ACTIVE',1,@passwordKdf,@passwordSalt,@passwordHash,@scryptN,@scryptR,@scryptP,@scryptKeyLength)"
      ).run(params);
      return { data: { projectRevision: this.advance(project.id, expectedRevision, nowText),
        issue: dto(this.findIssue(project.id, issueId)) } };
    }).immediate();
  }
  private async requireIssuePassword(publicId: string, issueId: string, password: string): Promise<IssueRow> {
    const project = this.projects.findByPublicId(publicId);
    if (!project) throw new PublicApiError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    const row = this.findIssue(project.id, issueId);
    if (row.credential_state !== "ACTIVE")
      throw new PublicApiError(409, "ISSUE_PASSWORD_NOT_SET", "기존 Issue는 프로젝트 편집 권한으로 비밀번호를 최초 설정해야 합니다.");
    const valid = await (this.options.verifyPassword ?? verifyEditPassword)(password, persistedIssueCredential(row));
    if (!valid) throw new PublicApiError(401, "ISSUE_PASSWORD_INVALID", invalidPasswordMessage);
    return row;
  }
  private requireUnchangedIssue(projectId: number, issueId: string, original: IssueRow): IssueRow {
    const current = this.findIssue(projectId, issueId);
    if (!sameCredential(original, current))
      throw new PublicApiError(401, "ISSUE_PASSWORD_INVALID", invalidPasswordMessage);
    return current;
  }
  async update(publicId: string, issueId: string, expectedRevision: number,
    rawInput: ProjectIssueInput, password: string): Promise<ProjectIssueMutationResponse> {
    const initial = await this.requireIssuePassword(publicId, issueId, password);
    return this.database.transaction(() => {
      const nowText = (this.options.clock ?? (() => new Date()))().toISOString();
      const project = this.currentReadProject(publicId, expectedRevision);
      this.requireUnchangedIssue(project.id, issueId, initial);
      const input = this.resolveInput(project.id, rawInput);
      const params = this.issueParams(project.id, input, issueId, nowText);
      const result = this.database.prepare(
        "UPDATE project_issues SET title=@title, description=@description, reporter_name=@reporterName, reporter_resource_public_id=@reporterResourceId, assignee_name=@assigneeName, assignee_resource_public_id=@assigneeResourceId, occurred_on=@occurredOn, completed=@completed, completed_on=@completedOn, related_task_public_id=@relatedTaskId, related_task_text=@relatedTaskText, updated_at=@updatedAt WHERE public_id=@issueId AND project_id=@projectId AND lifecycle_state='ACTIVE'"
      ).run(params);
      if (result.changes !== 1) throw new PublicApiError(404, "ISSUE_NOT_FOUND", missingMessage);
      return { data: { projectRevision: this.advance(project.id, expectedRevision, nowText),
        issue: dto(this.findIssue(project.id, issueId)) } };
    }).immediate();
  }
  async softDelete(publicId: string, issueId: string, expectedRevision: number,
    password: string): Promise<{ data: { projectRevision: number; deleted: true } }> {
    const initial = await this.requireIssuePassword(publicId, issueId, password);
    return this.database.transaction(() => {
      const nowText = (this.options.clock ?? (() => new Date()))().toISOString();
      const project = this.currentReadProject(publicId, expectedRevision);
      this.requireUnchangedIssue(project.id, issueId, initial);
      const result = this.database.prepare(
        "UPDATE project_issues SET lifecycle_state='DELETED', deleted_at=?, updated_at=? WHERE project_id=? AND public_id=? AND lifecycle_state='ACTIVE'"
      ).run(nowText, nowText, project.id, issueId);
      if (result.changes !== 1) throw new PublicApiError(404, "ISSUE_NOT_FOUND", missingMessage);
      return { data: { projectRevision: this.advance(project.id, expectedRevision, nowText), deleted: true as const } };
    }).immediate();
  }
  /** Explicit manager recovery. Project edit session + current project password are both required. */
  async manageCredential(authorization: AuthorizedEditSession, issueId: string,
    expectedRevision: number, operation: "initialize" | "reset", projectPassword: string,
    newPassword: string, requestId: string): Promise<ProjectIssueMutationResponse> {
    const before = this.projects.findCredentialById(authorization.projectId);
    const record = before && {
      algorithm: before.passwordKdf, salt: before.passwordSalt, hash: before.passwordHash,
      n: before.scryptN, r: before.scryptR, p: before.scryptP, keyLength: before.scryptKeyLength,
    };
    const verified = await (this.options.verifyProjectPassword ?? verifyEditPassword)(projectPassword, record);
    if (!verified || !before)
      throw new PublicApiError(401, "ISSUE_MANAGER_PASSWORD_INVALID", "프로젝트 비밀번호를 확인해 주세요.");
    const hash = await (this.options.hashPassword ?? hashEditPassword)(newPassword);
    return this.database.transaction(() => {
      const now = (this.options.clock ?? (() => new Date()))();
      const nowText = now.toISOString();
      const project = this.current(authorization, expectedRevision, now);
      if (project.authVersion !== before.authVersion ||
        !project.passwordHash.equals(before.passwordHash) || !project.passwordSalt.equals(before.passwordSalt))
        throw new PublicApiError(401, "ISSUE_MANAGER_PASSWORD_INVALID", "프로젝트 비밀번호를 확인해 주세요.");
      const issue = this.findIssue(project.id, issueId);
      if ((operation === "initialize" && issue.credential_state !== "UNSET") ||
        (operation === "reset" && issue.credential_state !== "ACTIVE"))
        throw new PublicApiError(409, "ISSUE_CREDENTIAL_STATE_CONFLICT", "비밀번호 상태가 변경되었습니다. 새로고침해 주세요.");
      this.database.prepare(
        "UPDATE project_issues SET credential_state='ACTIVE', credential_version=credential_version+1, password_kdf=@passwordKdf, password_salt=@passwordSalt, password_hash=@passwordHash, scrypt_n=@scryptN, scrypt_r=@scryptR, scrypt_p=@scryptP, scrypt_key_length=@scryptKeyLength, updated_at=@updatedAt WHERE id=@issueRowId"
      ).run({ issueRowId: issue.id, updatedAt: nowText, ...passwordSql(hash) });
      this.database.prepare(
        "INSERT INTO project_issue_credential_audit(project_id, issue_id, action, edit_session_id, request_id, created_at) VALUES(?, ?, ?, ?, ?, ?)"
      ).run(project.id, issue.id, operation === "initialize" ? "INITIALIZE" : "RESET",
        authorization.sessionId, requestId, nowText);
      return { data: { projectRevision: this.advance(project.id, expectedRevision, nowText),
        issue: dto(this.findIssue(project.id, issueId)) } };
    }).immediate();
  }
}
