import { createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { AuthorizedEditSession } from "../projects/project-service-core";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import { EditSessionRepository, ProjectRepository } from "../repositories/project-repository-core";
import { compareTaskTargetImpact, TaskTargetResolutionError, type TaskTargetResolutionInput } from "../../domain/logistics/task-target-bindings";
import { loadBoundedTaskLogisticsSnapshot, LogisticsCompatibilityError } from "./task-logistics-compatibility-core";
import { LogisticsTargetError } from "./logistics-targets-service-core";
import type { TaskTargetBindingDto } from "../../contracts/task-target-bindings";
import { RESOURCE_TARGET_LIMITS } from "../../contracts/resource-dashboard";

/**
 * Issue #792: bounded authoring of an EXISTING legacy source's scope.
 *
 * This is deliberately not a general Target writer or a flattening migration.
 * The original binding row and its UUID, selected members, coverage, dynamic
 * whole rule, archive context, timestamps (except updated_at), and all other
 * project rows survive. Inherited sources are never directly editable here.
 */
type Scope = "self" | "subtree";
type Input = { sourceId: string; scope: Scope; sourceFingerprint: string; impactToken?: string; confirmImpact?: true };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const invalid = (code: string): never => { throw new LogisticsTargetError(422, code); };
const missing = (code: string): never => { throw new LogisticsTargetError(404, code); };
function parse(raw: unknown, apply: boolean): Input {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid("INVALID_LEGACY_SOURCE_PATCH");
  const row = raw as Record<string, unknown>;
  const allowed = apply ? ["sourceId", "scope", "sourceFingerprint", "impactToken", "confirmImpact"]
    : ["sourceId", "scope", "sourceFingerprint"];
  if (Object.keys(row).some(key => !allowed.includes(key)) ||
      typeof row.sourceId !== "string" || !isCanonicalUuidV4(row.sourceId) ||
      (row.scope !== "self" && row.scope !== "subtree") ||
      typeof row.sourceFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(row.sourceFingerprint)) {
    return invalid("INVALID_LEGACY_SOURCE_PATCH");
  }
  if (apply && (row.confirmImpact !== true || typeof row.impactToken !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.impactToken))) return invalid("LEGACY_SOURCE_CONFIRMATION_REQUIRED");
  return { sourceId: row.sourceId, scope: row.scope, sourceFingerprint: row.sourceFingerprint,
    ...(apply ? { confirmImpact: true as const, impactToken: row.impactToken as string } : {}) };
}
function load(db: Database.Database, projectId: number): TaskTargetResolutionInput {
  try { return loadBoundedTaskLogisticsSnapshot(db, projectId); }
  catch (error) {
    if (error instanceof LogisticsCompatibilityError || error instanceof TaskTargetResolutionError)
      throw new LogisticsTargetError(409, "LEGACY_SOURCE_INTEGRITY_BLOCKED");
    throw error;
  }
}
/** Guard proposed subtree expansion *before* running the all-Task resolver.
 * The original source is already bounded by loadBoundedTaskLogisticsSnapshot,
 * but the proposed scope can increase inherited paths by thousands. */
function ensureProposedPathBudget(snapshot: TaskTargetResolutionInput): void {
  const byTask = new Map(snapshot.tasks.map(t => [t.id, t]));
  const descendants = new Map<string, number>();
  for (const task of snapshot.tasks) {
    let current: typeof task | undefined = task;
    const visited = new Set<string>();
    while (current) {
      if (visited.has(current.id)) throw new LogisticsTargetError(409, "LEGACY_SOURCE_INTEGRITY_BLOCKED");
      visited.add(current.id);
      descendants.set(current.id, (descendants.get(current.id) ?? 0) + 1);
      current = current.parentId === null ? undefined : byTask.get(current.parentId);
    }
  }
  const targets = new Map(snapshot.targets.map(t => [t.id, t]));
  let paths = 0;
  for (const binding of snapshot.bindings) {
    const target = targets.get(binding.targetId);
    if (!target) throw new LogisticsTargetError(409, "LEGACY_SOURCE_INTEGRITY_BLOCKED");
    const selected = binding.selection === "whole" ? target.members.length : binding.memberIds.length;
    paths += target.members.length + binding.memberIds.length * (binding.coverageByMember?.length ?? 0) +
      (1 + selected) * (binding.scope === "subtree" ? descendants.get(binding.taskId) ?? 0 : 1);
    if (paths > RESOURCE_TARGET_LIMITS.provenancePaths)
      throw new LogisticsTargetError(422, "LOGISTICS_SOURCE_LIMIT_EXCEEDED");
  }
  for (const source of snapshot.legacy) {
    paths += source.scope === "subtree" ? descendants.get(source.taskId) ?? 0 : 1;
    if (paths > RESOURCE_TARGET_LIMITS.provenancePaths)
      throw new LogisticsTargetError(422, "LOGISTICS_SOURCE_LIMIT_EXCEEDED");
  }
}
function sourceFingerprint(revision: number, source: TaskTargetBindingDto, snapshot: TaskTargetResolutionInput) {
  return digest({ revision, source, members: snapshot.targets.find(t => t.id === source.targetId)?.members ?? null });
}
export class LegacyBindingScopeService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  constructor(private readonly db: Database.Database, private readonly clock: () => Date = () => new Date()) {
    this.projects = new ProjectRepository(db);
    this.sessions = new EditSessionRepository(db);
  }

  private check(auth: AuthorizedEditSession, revision: number, now: Date) {
    const project = this.projects.findCredentialById(auth.projectId);
    const session = this.sessions.findById(auth.sessionId);
    if (!project || !session || project.publicId !== auth.projectPublicId ||
        session.projectId !== project.id || session.authVersion !== project.authVersion ||
        auth.projectAuthVersion !== project.authVersion || !session.tokenHash.equals(auth.tokenHash) ||
        session.revokedAt !== null || !Number.isFinite(Date.parse(session.expiresAt)) ||
        Date.parse(session.expiresAt) <= now.getTime())
      throw new LogisticsTargetError(401, "EDIT_SESSION_REQUIRED");
    if (project.revision !== revision) throw new LogisticsTargetError(412, "REVISION_MISMATCH");
  }

  get(projectPublicId: string, taskPublicId: string) {
    if (!isCanonicalUuidV4(projectPublicId) || !isCanonicalUuidV4(taskPublicId)) return missing("TASK_NOT_FOUND");
    return this.db.transaction(() => {
      const project = this.projects.findByPublicId(projectPublicId);
      if (!project) return missing("PROJECT_NOT_FOUND");
      const snapshot = load(this.db, project.id);
      const task = snapshot.tasks.find(t => t.id === taskPublicId);
      if (!task) return missing("TASK_NOT_FOUND");
      return { projectRevision: project.revision, taskId: taskPublicId, sourceBindings: snapshot.bindings
        .filter(b => b.taskId === taskPublicId).map(b => ({
          sourceId: b.id, sourceTaskId: b.taskId, scope: b.scope, selection: b.selection,
          memberCount: b.selection === "whole"
            ? snapshot.targets.find(t => t.id === b.targetId)?.members.length ?? 0 : b.memberIds.length,
          sourceFingerprint: sourceFingerprint(project.revision, b, snapshot),
          canEditScope: task.type === "summary",
        })) };
    }).deferred();
  }

  private plan(auth: AuthorizedEditSession, revision: number, taskPublicId: string, raw: Input) {
    this.check(auth, revision, this.clock());
    if (!isCanonicalUuidV4(taskPublicId)) return missing("TASK_NOT_FOUND");
    const snapshot = load(this.db, auth.projectId);
    const task = snapshot.tasks.find(t => t.id === taskPublicId);
    if (!task) return missing("TASK_NOT_FOUND");
    const previous = snapshot.bindings.find(b => b.taskId === taskPublicId && b.id === raw.sourceId);
    if (!previous) return missing("LEGACY_SOURCE_NOT_FOUND");
    if (sourceFingerprint(revision, previous, snapshot) !== raw.sourceFingerprint)
      throw new LogisticsTargetError(409, "LEGACY_SOURCE_STALE");
    if (previous.scope === raw.scope) throw new LogisticsTargetError(409, "LEGACY_SOURCE_UNCHANGED");
    if (task.type !== "summary") throw new LogisticsTargetError(422, "LEGACY_SCOPE_REQUIRES_SUMMARY");
    // Expanding an old source must not create a new inherited assignment
    // for a Target or member which has since been made inactive.
    if (previous.scope === "self" && raw.scope === "subtree") {
      const target = this.db.prepare("SELECT active FROM logistics_targets WHERE project_id=? AND public_id=?")
        .get(auth.projectId, previous.targetId) as {active: number} | undefined;
      const members = snapshot.targets.find(t => t.id === previous.targetId)?.members;
      if (!target || !members) throw new LogisticsTargetError(409, "LEGACY_SOURCE_INTEGRITY_BLOCKED");
      const selected = previous.selection === "whole" ? members :
        members.filter(m => previous.memberIds.includes(m.id));
      if (target.active !== 1 || selected.some(m => m.active === false))
        throw new LogisticsTargetError(409, "LEGACY_SOURCE_INACTIVE");
    }
    const candidate: TaskTargetResolutionInput = { ...snapshot, bindings: snapshot.bindings.map(b =>
      b === previous ? { ...b, scope: raw.scope } : b) };
    ensureProposedPathBudget(candidate);
    let impact: ReturnType<typeof compareTaskTargetImpact>;
    try { impact = compareTaskTargetImpact(snapshot, candidate); }
    catch (error) {
      if (error instanceof TaskTargetResolutionError)
        throw new LogisticsTargetError(409, "LEGACY_SOURCE_INTEGRITY_BLOCKED");
      throw error;
    }
    const token = digest({ revision, taskPublicId, sourceId: previous.id, scope: raw.scope,
      original: snapshot, candidate, affectedTaskIds: impact.changedTaskIds });
    return { snapshot, candidate, previous, impact, token,
      data: { projectRevision: revision, taskId: taskPublicId, sourceId: previous.id,
        beforeScope: previous.scope, afterScope: raw.scope, selection: previous.selection,
        memberCount: previous.selection === "whole"
          ? snapshot.targets.find(t => t.id === previous.targetId)?.members.length ?? 0 : previous.memberIds.length,
        affectedTaskIds: impact.changedTaskIds, before: impact.before, after: impact.after,
        impactToken: token } };
  }

  preview(auth: AuthorizedEditSession, revision: number, taskId: string, raw: unknown) {
    const input = parse(raw, false);
    return this.db.transaction(() => ({ data: this.plan(auth, revision, taskId, input).data })).deferred();
  }

  apply(auth: AuthorizedEditSession, revision: number, taskId: string, raw: unknown) {
    const input = parse(raw, true);
    return this.db.transaction(() => {
      const plan = this.plan(auth, revision, taskId, input);
      if (plan.token !== input.impactToken)
        throw new LogisticsTargetError(409, "LEGACY_SOURCE_IMPACT_STALE");
      const time = this.clock().toISOString();
      const result = this.db.prepare(`UPDATE task_target_bindings SET scope=?,updated_at=?
        WHERE project_id=? AND public_id=? AND scope=?
        AND task_id=(SELECT id FROM tasks WHERE project_id=? AND public_id=?)`)
        .run(input.scope, time, auth.projectId, input.sourceId, plan.previous.scope, auth.projectId, taskId);
      if (result.changes !== 1) throw new LogisticsTargetError(409, "LEGACY_SOURCE_STALE");
      // Post-write structural equivalence is required, not just a green UPDATE.
      if (JSON.stringify(load(this.db, auth.projectId)) !== JSON.stringify(plan.candidate))
        throw new LogisticsTargetError(409, "LEGACY_SOURCE_POSTCHECK_FAILED");
      if (!this.projects.advanceRevision(auth.projectId, revision, time))
        throw new LogisticsTargetError(412, "REVISION_MISMATCH");
      return { data: { ...plan.data, projectRevision: revision + 1, impactToken: null } };
    }).immediate();
  }
}
