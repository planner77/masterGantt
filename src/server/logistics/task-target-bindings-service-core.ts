import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { TaskTargetBindingDto, TaskTargetBindingInput } from "../../contracts/task-target-bindings";
import { resolveTaskTargetBindings, TaskTargetResolutionError, type TaskTargetResolutionInput } from "../../domain/logistics/task-target-bindings";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { AuthorizedEditSession } from "../projects/project-service-core";
import { EditSessionRepository, ProjectRepository } from "../repositories/project-repository-core";
import { TaskTargetBindingRepository, loadTaskTargetBindingSnapshot } from "../repositories/task-target-binding-repository-core";
import { LogisticsTargetError } from "./logistics-targets-service-core";

const resolve = (taskId: string, snapshot: TaskTargetResolutionInput) => {
  try { return resolveTaskTargetBindings(taskId,snapshot); }
  catch (error) { if (error instanceof TaskTargetResolutionError) throw new LogisticsTargetError(400,error.code); throw error; }
};
const invalid = (code = "INVALID_TARGET_BINDING_REQUEST"): never => { throw new LogisticsTargetError(400, code); };
const object = (value: unknown, keys: string[]): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !keys.includes(key))) return invalid();
  return row;
};
const uuid = (value: unknown): string => typeof value === "string" && isCanonicalUuidV4(value) ? value : invalid();

/** Do not turn a grandfathered inactive reference into a new assignment. */
function unchangedInactiveReference(previous: TaskTargetBindingDto | undefined, next: TaskTargetBindingDto): boolean {
  if (!previous || previous.scope !== next.scope || previous.selection !== next.selection ||
      previous.memberIds.length !== next.memberIds.length ||
      previous.memberIds.some((id, index) => id !== next.memberIds[index])) return false;
  // Omitted coverage and an explicit null both mean unspecified; a changed
  // quantity on an inactive reference is not a passive retention.
  return previous.memberIds.every(id =>
    (previous.coverageByMember?.find(row => row.memberId === id)?.coverage ?? null) ===
    (next.coverageByMember?.find(row => row.memberId === id)?.coverage ?? null));
}
export function parseTaskTargetBindings(raw: unknown): TaskTargetBindingInput[] {
  const root = object(raw, ["bindings"]);
  if (!Array.isArray(root.bindings) || root.bindings.length > 100) return invalid();
  const result = root.bindings.map(value => {
    const row = object(value, ["id", "targetId", "scope", "selection", "memberIds", "coverageByMember"]);
    const scope = row.scope ?? "self";
    if (scope !== "self" && scope !== "subtree") return invalid();
    if (row.selection !== "whole" && row.selection !== "subset") return invalid();
    if (!Array.isArray(row.memberIds) || row.memberIds.length > 100) return invalid();
    const memberIds = row.memberIds.map(uuid).sort();
    if (new Set(memberIds).size !== memberIds.length) return invalid("TARGET_BINDING_MEMBER_DUPLICATE");
    if (row.selection === "whole" && memberIds.length) return invalid("WHOLE_MEMBERS_MUST_BE_EMPTY");
    if (row.selection === "subset" && !memberIds.length) return invalid("EMPTY_SUBSET");
    const coverageInput = row.coverageByMember ?? [];
    if (!Array.isArray(coverageInput) || coverageInput.length > 100) return invalid();
    const coverageByMember = coverageInput.map(value => {
      const coverage = object(value, ["memberId", "coverage"]);
      if (coverage.coverage !== null && (!Number.isSafeInteger(coverage.coverage) || (coverage.coverage as number) < 1)) return invalid("INVALID_TARGET_COVERAGE");
      const memberId = uuid(coverage.memberId);
      if (!memberIds.includes(memberId)) return invalid("TARGET_COVERAGE_MEMBER_NOT_SELECTED");
      return { memberId, coverage: coverage.coverage as number | null };
    }).sort((a,b) => a.memberId.localeCompare(b.memberId));
    if (new Set(coverageByMember.map(c => c.memberId)).size !== coverageByMember.length) return invalid("TARGET_BINDING_MEMBER_DUPLICATE");
    return { ...(row.id === undefined ? {} : { id: uuid(row.id) }), targetId: uuid(row.targetId), scope,
      selection: row.selection, memberIds, coverageByMember } satisfies TaskTargetBindingInput;
  });
  if (new Set(result.map(b => b.targetId)).size !== result.length) return invalid("TARGET_BINDING_DUPLICATE");
  return result;
}

export { loadTaskTargetBindingSnapshot } from "../repositories/task-target-binding-repository-core";

export class TaskTargetBindingService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly bindings: TaskTargetBindingRepository;
  constructor(private readonly db: Database.Database, private readonly options: {clock?:()=>Date;generatePublicId?:()=>string} = {}) {
    this.projects = new ProjectRepository(db); this.sessions = new EditSessionRepository(db); this.bindings = new TaskTargetBindingRepository(db);
  }
  private check(auth: AuthorizedEditSession, revision: number, now: Date) {
    const project = this.projects.findCredentialById(auth.projectId), session = this.sessions.findById(auth.sessionId);
    if (!project || !session || project.publicId!==auth.projectPublicId || session.projectId!==project.id || project.authVersion!==auth.projectAuthVersion || session.authVersion!==project.authVersion || !session.tokenHash.equals(auth.tokenHash) || session.revokedAt!==null || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt)<=now.getTime()) throw new LogisticsTargetError(401,"EDIT_SESSION_REQUIRED");
    if (project.revision!==revision) throw new LogisticsTargetError(412,"REVISION_MISMATCH");
  }
  get(projectPublicId: string, taskId: string) {
    return this.db.transaction(() => {
      const project = this.projects.findByPublicId(uuid(projectPublicId));
      if (!project) throw new LogisticsTargetError(404,"PROJECT_NOT_FOUND");
      const snapshot = loadTaskTargetBindingSnapshot(this.db,project.id);
      if (!snapshot.tasks.some(t => t.id===uuid(taskId))) throw new LogisticsTargetError(404,"TASK_NOT_FOUND");
      const effective = resolve(taskId,snapshot);
      return {projectRevision:project.revision,taskId,bindings:effective.bindings,effective};
    }).deferred();
  }
  replace(auth: AuthorizedEditSession, expectedRevision: number, taskId: string, raw: unknown) {
    const input = parseTaskTargetBindings(raw), now = (this.options.clock ?? (()=>new Date()))();
    return this.db.transaction(() => {
      this.check(auth,expectedRevision,now);
      const task = this.bindings.findTask(auth.projectId,uuid(taskId));
      if (!task) throw new LogisticsTargetError(404,"TASK_NOT_FOUND");
      if (task.type==="milestone" && input.length) return invalid("TARGET_BINDING_MILESTONE_FORBIDDEN");
      const old = loadTaskTargetBindingSnapshot(this.db,auth.projectId);
      const previous = old.bindings.filter(b => b.taskId===taskId);
      const bindings: TaskTargetBindingDto[] = input.map(b => {
        const existing = previous.find(p => p.targetId===b.targetId);
        if (b.id && b.id!==existing?.id) return invalid("TARGET_BINDING_ID_MISMATCH");
        return {...b,id:existing?.id ?? uuid((this.options.generatePublicId??randomUUID)()),taskId};
      });
      const candidate = {...old,bindings:[...old.bindings.filter(b=>b.taskId!==taskId),...bindings]};
      resolve(taskId,candidate);
      for (const b of bindings) {
        const target = this.bindings.findTarget(auth.projectId,b.targetId);
        if (!target) return invalid("TARGET_NOT_FOUND");
        const retained = unchangedInactiveReference(previous.find(p => p.targetId === b.targetId), b);
        if (!target.active && !retained) throw new LogisticsTargetError(409,"TARGET_INACTIVE");
        const selected = candidate.targets.find(t=>t.id===b.targetId)?.members.filter(m=>b.selection==="whole" || b.memberIds.includes(m.id))??[];
        for (const m of selected) if (m.active===false && !retained) throw new LogisticsTargetError(409,"TARGET_MEMBER_INACTIVE");
      }
      const text = now.toISOString();
      this.bindings.replace(auth.projectId,task.id,bindings,text);
      if (!this.projects.advanceRevision(auth.projectId,expectedRevision,text)) throw new LogisticsTargetError(412,"REVISION_MISMATCH");
      return {data:this.get(auth.projectPublicId,taskId)};
    }).immediate();
  }
}
