import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import {
  ProjectIssueService, parseProjectIssueInput, parseProjectIssueQuery,
  parseIssueCreateRequest, parseIssueUpdateRequest, parseIssueDeleteRequest,
  parseIssueCredentialRequest, projectIssueToday,
} from "../../../src/server/projects/project-issue-service-core";
import { handleProjectIssues } from "../../../src/server/projects/project-issue-handlers-core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";

const now = "2026-10-28T01:00:00.000Z";
const clock = () => new Date(now);
const migrationsDirectory = join(process.cwd(), "db/migrations");
const hashPassword = async () => ({
  algorithm: "scrypt" as const, salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2),
  n: 32768, r: 8, p: 3, keyLength: 32,
});
const issuePassword = "IssuePassword#123";
const issueHash = async (password: string) => ({
  algorithm: "scrypt" as const, salt: Buffer.alloc(16, 7),
  hash: createHash("sha256").update(password).digest(),
  n: 32768, r: 8, p: 3, keyLength: 32,
});
const issueVerify = async (candidate: string, record: { hash: Buffer } | undefined) =>
  Boolean(record?.hash?.equals(createHash("sha256").update(candidate).digest()));
const createBody = (override: Record<string, unknown> = {}) =>
  ({ ...input(override), issuePassword, confirmIssuePassword: issuePassword });
const updateBody = (override: Record<string, unknown> = {}) =>
  ({ ...input(override), issuePassword });
const databases: Database.Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

async function fixture() {
  const db = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
  databases.push(db);
  const projects = new TaskFieldProjectService(db, { clock, hashPassword });
  const service = new ProjectIssueService(db, {
    clock, hashPassword: issueHash, verifyPassword: issueVerify,
    verifyProjectPassword: async (candidate: string) => candidate === "test",
  });
  const make = async (name: string) => {
    const created = await projects.create({ name, description: "", editPassword: "test" });
    const publicId = created.response.data.project.publicId;
    const authorized = projects.authorize(publicId, created.rawSessionToken);
    if (authorized.kind !== "authorized") throw new Error("test authorization");
    return { publicId, rawToken: created.rawSessionToken, authorization: authorized.authorization,
      revision: () => projects.getReadonlySnapshot(publicId)!.data.project.revision };
  };
  const a = await make("A"), b = await make("B");
  const base = "http://localhost:3012";
  const request = (method: string, body?: unknown, parameters: {
    p?: typeof a; revision?: number; origin?: string; token?: string;
    query?: string; issueId?: string;
  } = {}) => {
    const p = parameters.p ?? a;
    const path = "/api/projects/" + p.publicId + "/issues";
    return new Request(base + path + (parameters.issueId ? "/" + parameters.issueId : "") + (parameters.query ?? ""), {
      method, headers: {
        Origin: parameters.origin ?? base,
        Cookie: editSessionCookieName("test", new URL(base)) + "=" + (parameters.token ?? p.rawToken),
        "If-Match": '"' + (parameters.revision ?? p.revision()) + '"',
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };
  const handle = (request: Request, p = a, issueId?: string, credentialAction = false) => handleProjectIssues(request, p.publicId, {
    service, projectService: projects, applicationBaseUrl: base, environment: "test",
  }, issueId, credentialAction);
  return { db, projects, service, a, b, request, handle };
}

function input(override: Record<string, unknown> = {}) {
  return {
    title: "차량 정지", description: "로그 https://example.com/issue/1",
    reporterName: "등록자", reporterResourceId: null,
    assigneeName: "담당자", assigneeResourceId: null,
    occurredOn: "2026-10-28", completed: false, completedOn: null,
    relatedTaskId: null, relatedTaskText: "자유 입력 Task", ...override,
  };
}

describe("#838-#840 project Issue persistence and API", () => {
  it("uses the project timezone and rejects malformed dates, completion, identity and query", () => {
    expect(projectIssueToday(clock())).toBe("2026-10-28");
    expect(() => parseProjectIssueInput(input({ occurredOn: "2026-02-30" }))).toThrow();
    expect(() => parseProjectIssueInput(input({ completed: true }))).toThrow();
    expect(() => parseProjectIssueInput(input({ completedOn: "2026-10-28" }))).toThrow();
    expect(() => parseProjectIssueInput(input({ reporterResourceId: "not-a-uuid" }))).toThrow();
    expect(() => parseProjectIssueInput({ ...input(), surprising: true })).toThrow();
    expect(() => parseProjectIssueQuery(new URLSearchParams("limit=200"))).toThrow();
    expect(() => parseProjectIssueQuery(new URLSearchParams("page=-1"))).toThrow();
    expect(() => parseProjectIssueQuery(new URLSearchParams("q=a&q=b"))).toThrow();
  });

  it("persists 23 searchable issues, paginates, and keeps the global numerator/denominator", async () => {
    const f = await fixture();
    const first = await f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input()), issuePassword);
    expect(first.data.issue).toMatchObject({ title: "차량 정지", completed: false, reporterName: "등록자" });
    expect(first.data.projectRevision).toBe(2);
    for (let index = 0; index < 22; index++) {
      await f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
        title: "문제 " + String(index).padStart(2, "0"),
        description: "재발 상황 " + index,
        completed: index < 11, completedOn: index < 11 ? "2026-10-28" : null,
      })), issuePassword);
    }
    const list = (query: string) => f.service.list(f.a.publicId, parseProjectIssueQuery(new URLSearchParams(query))).data;
    const firstPage = list("limit=10&page=1");
    expect(firstPage.summary).toEqual({ total: 23, completed: 11 });
    expect(firstPage.total).toBe(23);
    expect(firstPage.issues).toHaveLength(10);
    expect(list("limit=10&page=2").issues).toHaveLength(10);
    expect(list("limit=10&page=3").issues).toHaveLength(3);
    expect(list("status=completed&limit=50").total).toBe(11);
    expect(list("status=completed").summary.total).toBe(23);
    expect(list("q=차량").total).toBe(1);
    expect(list("q=example.com").total).toBe(1);
    expect(list("q=담당자").total).toBe(23);
    expect(list("page=4&limit=10").issues).toHaveLength(0);
    const updated = await f.service.update(f.a.publicId, first.data.issue.issueId, f.a.revision(), parseProjectIssueInput(input({
      completed: true, completedOn: "2026-10-28", title: "다시 정상",
    })), issuePassword);
    expect(updated.data.issue).toMatchObject({ title: "다시 정상", completed: true });
    expect(list("status=completed").total).toBe(12);
    expect(f.service.list(f.b.publicId, parseProjectIssueQuery(new URLSearchParams())).data.summary.total).toBe(0);
  });

  it("checks current session, revision and cross-project Task; clears only deleted references", async () => {
    const f = await fixture();
    const otherTask = f.projects.createTask(f.b.authorization, f.b.revision(), {
      type: "task", name: "B 전용", externalId: "B", start: "2026-10-29", duration: 1, progress: 0,
    }).data.tasks.find(item => item.externalId === "B")!;
    await expect(f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
      relatedTaskId: otherTask.taskId,
    })), issuePassword)).rejects.toThrow("Task");
    const ownTask = f.projects.createTask(f.a.authorization, f.a.revision(), {
      type: "task", name: "A 전용", externalId: "A", start: "2026-10-29", duration: 1, progress: 0,
    }).data.tasks.find(item => item.externalId === "A")!;
    const catalog = new ResourceCatalogRepository(f.db);
    const resource = catalog.insertResource({
      publicId: randomUUID(), name: "김개발", code: "DEV", description: "", now,
    });
    // A valid global Resource UUID belonging only to another project is still forbidden.
    const selectForeignResource = () => f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
      reporterResourceId: resource.publicId, reporterName: "조작된 이름",
    })), issuePassword);
    await expect(selectForeignResource()).rejects.toThrow("현재 프로젝트");
    const registerResource = (projectId: number) => f.db.prepare(
      "INSERT INTO project_resource_memberships(project_id, resource_id, created_at) SELECT ?, id, ? FROM resources WHERE public_id = ?"
    ).run(projectId, now, resource.publicId);
    expect(registerResource(f.b.authorization.projectId).changes).toBe(1);
    await expect(selectForeignResource()).rejects.toThrow("현재 프로젝트");
    expect(registerResource(f.a.authorization.projectId).changes).toBe(1);
    const created = await f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
      reporterResourceId: resource.publicId, reporterName: "조작된 이름",
      assigneeResourceId: resource.publicId, assigneeName: "조작된 이름",
      relatedTaskId: ownTask.taskId, relatedTaskText: "조작된 Task",
    })), issuePassword);
    expect(created.data.issue).toMatchObject({
      reporterName: "김개발", assigneeName: "김개발",
      relatedTaskText: "A 전용", relatedTaskId: ownTask.taskId,
    });
    await expect(f.service.create(f.a.authorization, f.a.revision() - 1,
      parseProjectIssueInput(input()), issuePassword)).rejects.toThrow("프로젝트가 변경");
    f.db.prepare("DELETE FROM tasks WHERE project_id=? AND public_id=?").run(f.a.authorization.projectId, ownTask.taskId);
    // Catalog deletion is only valid after both project memberships are unregistered.
    // Preserve the FK guard: never bypass or disable foreign-key checks for this fixture.
    const removedMemberships = f.db.prepare(
      "DELETE FROM project_resource_memberships WHERE resource_id = (SELECT id FROM resources WHERE public_id = ?)"
    ).run(resource.publicId);
    expect(removedMemberships.changes).toBe(2);
    expect(f.db.prepare("DELETE FROM resources WHERE public_id=?").run(resource.publicId).changes).toBe(1);
    const list = f.service.list(f.a.publicId, parseProjectIssueQuery(new URLSearchParams())).data.issues;
    expect(list[0]).toMatchObject({ relatedTaskId: null, relatedTaskText: "A 전용",
      reporterResourceId: null, assigneeResourceId: null, reporterName: "김개발" });
    const unauthorized = { ...f.a.authorization, projectAuthVersion: -1 };
    await expect(f.service.create(unauthorized, f.a.revision(), parseProjectIssueInput(input()), issuePassword)).rejects.toThrow("편집 세션");
  });

  it("enforces Origin, If-Match, edit session, repeatable read, and no-store HTTP", async () => {
    const f = await fixture();
    const post = await f.handle(f.request("POST", createBody()));
    expect(post.status).toBe(201);
    expect(post.headers.get("cache-control")).toBe("private, no-store");
    const created = (await post.json()) as { data: { issue: { issueId: string }; projectRevision: number } };
    const get = await f.handle(f.request("GET", undefined, { query: "?limit=10" }));
    expect(get.status).toBe(200);
    expect(((await get.json()) as { data: { summary: { total: number } } }).data.summary.total).toBe(1);
    const forbidden = await f.handle(f.request("POST", input(), { origin: "https://evil.example" }));
    expect(forbidden.status).toBe(403);
    const missingSession = await f.handle(f.request("POST", input(), { token: "no-session" }));
    expect(missingSession.status).toBe(401);
    const stale = await f.handle(f.request("POST", input(), { revision: 1 }));
    expect(stale.status).toBe(412);
    const patch = await f.handle(f.request("PATCH", updateBody({ completed: true, completedOn: "2026-10-28" }), {
      issueId: created.data.issue.issueId,
    }), f.a, created.data.issue.issueId);
    expect(patch.status).toBe(200);
    const other = await f.handle(f.request("PATCH", updateBody(), {
      p: f.b, issueId: created.data.issue.issueId,
    }), f.b, created.data.issue.issueId);
    expect(other.status).toBe(404);
    const invalid = await f.handle(f.request("POST", { ...createBody(), complete: true }));
    expect(invalid.status).toBe(400);
  });
  it("#846 rejects malformed password payloads before mutation", () => {
    expect(() => parseIssueCreateRequest({ ...input(), issuePassword: "short", confirmIssuePassword: "short" })).toThrow();
    expect(() => parseIssueCreateRequest({ ...input(), issuePassword, confirmIssuePassword: "mismatch" })).toThrow();
    expect(() => parseIssueCreateRequest({ ...input(), issuePassword, confirmIssuePassword: issuePassword })).not.toThrow();
    expect(() => parseIssueUpdateRequest({ ...input(), issuePassword })).not.toThrow();
    expect(() => parseIssueDeleteRequest({ issuePassword, extra: 1 })).toThrow();
    expect(() => parseIssueCredentialRequest({ operation: "reset", projectPassword: "test",
      newPassword: issuePassword, confirmPassword: issuePassword })).not.toThrow();
  });

  it("#846 allows correct per-Issue password without edit session, never editor bypass, and tombstones list/KPI", async () => {
    const f = await fixture();
    const created = await f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input()), issuePassword);
    const issueId = created.data.issue.issueId;
    expect(created.data.issue.credentialState).toBe("protected");
    const stored = f.db.prepare("SELECT * FROM project_issues WHERE public_id = ?").get(issueId) as {
      password_hash: Buffer; password_salt: Buffer; credential_state: string; lifecycle_state: string;
    };
    expect(stored.password_hash).toBeInstanceOf(Buffer);
    expect(stored.password_salt).toHaveLength(16);
    expect(stored.lifecycle_state).toBe("ACTIVE");
    const get = await f.handle(f.request("GET"));
    expect(JSON.stringify(await get.json())).not.toContain("password_hash");
    expect(JSON.stringify(f.service.list(f.a.publicId, parseProjectIssueQuery(new URLSearchParams())))).not.toContain("passwordSalt");

    const withoutEdit = { token: "invalid-session", issueId };
    const wrong = await f.handle(f.request("PATCH", { ...updateBody(), issuePassword: "Wrong12345" }, withoutEdit),
      f.a, issueId);
    expect(wrong.status).toBe(401);
    const correct = await f.handle(f.request("PATCH", updateBody({ completed: true, completedOn: "2026-10-28" }), withoutEdit),
      f.a, issueId);
    expect(correct.status).toBe(200);
    const edited = (await correct.json()) as { data: { projectRevision: number } };
    const stale = await f.handle(f.request("DELETE", { issuePassword }, { ...withoutEdit, revision: created.data.projectRevision }),
      f.a, issueId);
    expect(stale.status).toBe(412);
    const wrongDelete = await f.handle(f.request("DELETE", { issuePassword: "Wrong12345" }, withoutEdit), f.a, issueId);
    expect(wrongDelete.status).toBe(401);
    const deleted = await f.handle(f.request("DELETE", { issuePassword },
      { ...withoutEdit, revision: edited.data.projectRevision }), f.a, issueId);
    expect(deleted.status).toBe(200);
    expect((await deleted.json() as { data: { deleted: boolean } }).data.deleted).toBe(true);
    const tombstone = f.db.prepare("SELECT lifecycle_state, deleted_at, title, completed FROM project_issues WHERE public_id = ?")
      .get(issueId) as { lifecycle_state: string; deleted_at: string | null; title: string; completed: number };
    expect(tombstone).toMatchObject({ lifecycle_state: "DELETED", title: "차량 정지", completed: 1 });
    expect(tombstone.deleted_at).not.toBeNull();
    for (const query of ["", "status=open", "status=completed", "q=차량", "page=2&limit=10"]) {
      const result = f.service.list(f.a.publicId, parseProjectIssueQuery(new URLSearchParams(query))).data;
      expect(result.summary).toEqual({ total: 0, completed: 0 });
      expect(result.total).toBe(0);
      expect(result.issues).toHaveLength(0);
    }
    const repeat = await f.handle(f.request("DELETE", { issuePassword }, withoutEdit), f.a, issueId);
    expect(repeat.status).toBe(404);
    const mutateGone = await f.handle(f.request("PATCH", updateBody(), withoutEdit), f.a, issueId);
    expect(mutateGone.status).toBe(404);
  });

  it("#846 isolates every Issue credential and rejects invalid Origin or private access", async () => {
    const f = await fixture();
    const a = await f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({ title: "A Issue" })), issuePassword);
    const b = await f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({ title: "B Issue" })), "IssuePassword#OTHER");
    const wrongOnA = await f.handle(f.request("PATCH", { ...updateBody(), issuePassword: "IssuePassword#OTHER" },
      { issueId: a.data.issue.issueId }), f.a, a.data.issue.issueId);
    expect(wrongOnA.status).toBe(401);
    const wrongOnB = await f.handle(f.request("DELETE", { issuePassword },
      { issueId: b.data.issue.issueId }), f.a, b.data.issue.issueId);
    expect(wrongOnB.status).toBe(401);
    const origin = await f.handle(f.request("PATCH", updateBody(), {
      issueId: a.data.issue.issueId, origin: "https://attacker.example",
    }), f.a, a.data.issue.issueId);
    expect(origin.status).toBe(403);
    // Simulate the existing Project visibility contract change; the Issue password
    // must never grant a private Project read session or mutation.
    f.db.prepare("UPDATE projects SET visibility = 'private', revision = revision + 1 WHERE id = ?")
      .run(f.a.authorization.projectId);
    const privateGet = await f.handle(f.request("GET", undefined, { token: "no-session" }));
    expect(privateGet.status).toBe(401);
    const privateWrite = await f.handle(f.request("PATCH", updateBody(), {
      issueId: a.data.issue.issueId, token: "no-session",
    }), f.a, a.data.issue.issueId);
    expect(privateWrite.status).toBe(401);
    const validPrivateWrite = await f.handle(f.request("PATCH", updateBody(), {
      issueId: a.data.issue.issueId,
    }), f.a, a.data.issue.issueId);
    expect(validPrivateWrite.status).toBe(200);
  });

  it("#846 rate-limits Issue password guesses with Retry-After and keeps underlying data unchanged", async () => {
    const { issuePasswordGlobalRateLimiter, issuePasswordPerIssueRateLimiter } =
      await import("../../../src/server/security/rate-limit-core");
    issuePasswordGlobalRateLimiter.clear(); issuePasswordPerIssueRateLimiter.clear();
    try {
      const f = await fixture();
      const created = await f.service.create(f.a.authorization, f.a.revision(), parseProjectIssueInput(input()), issuePassword);
      const id = created.data.issue.issueId;
      for (let n = 0; n < 10; n++) {
        const result = await f.handle(f.request("PATCH",
          { ...updateBody({ title: "attacker" }), issuePassword: "WrongPassword" }, { issueId: id }), f.a, id);
        expect(result.status).toBe(401);
      }
      const throttled = await f.handle(f.request("PATCH", updateBody({ title: "attacker" }),
        { issueId: id }), f.a, id);
      expect(throttled.status).toBe(429);
      expect(Number(throttled.headers.get("retry-after"))).toBeGreaterThan(0);
      expect(f.service.list(f.a.publicId, parseProjectIssueQuery(new URLSearchParams())).data.issues[0].title)
        .toBe("차량 정지");
    } finally {
      issuePasswordGlobalRateLimiter.clear(); issuePasswordPerIssueRateLimiter.clear();
    }
  });

  it("#846 legacy password initialization and reset require project session plus actual project password", async () => {
    const f = await fixture();
    const id = randomUUID();
    const projectId = f.a.authorization.projectId;
    f.db.prepare(`INSERT INTO project_issues
      (public_id, project_id, title, description, reporter_name, assignee_name, occurred_on,
       completed, completed_on, related_task_text, created_at, updated_at)
       VALUES (?, ?, 'legacy', '', '', '', '2026-10-28', 0, NULL, '', ?, ?)`).run(id, projectId, now, now);
    const credentials = (operation: "initialize" | "reset", projectPassword: string) =>
      ({ operation, projectPassword, newPassword: issuePassword, confirmPassword: issuePassword });
    const unconfigured = f.service.list(f.a.publicId, parseProjectIssueQuery(new URLSearchParams())).data.issues[0];
    expect(unconfigured.credentialState).toBe("unconfigured");
    const noSession = await f.handle(f.request("PATCH", credentials("initialize", "test"), {
      issueId: id, token: "invalid",
    }), f.a, id, true);
    expect(noSession.status).toBe(401);
    const wrongProject = await f.handle(f.request("PATCH", credentials("initialize", "wrong"), { issueId: id }),
      f.a, id, true);
    expect(wrongProject.status).toBe(401);
    const legacyMutation = await f.handle(f.request("PATCH", updateBody(), { issueId: id, token: "invalid" }),
      f.a, id);
    expect(legacyMutation.status).toBe(409);
    const first = await f.handle(f.request("PATCH", credentials("initialize", "test"), { issueId: id }),
      f.a, id, true);
    expect(first.status).toBe(200);
    const initialized = await first.json() as { data: { issue: { credentialState: string } } };
    expect(initialized.data.issue.credentialState).toBe("protected");
    expect(f.db.prepare("SELECT COUNT(*) FROM project_issue_credential_audit WHERE action='INITIALIZE'")
      .pluck().get()).toBe(1);
    const reset = await f.handle(f.request("PATCH", credentials("reset", "test"), { issueId: id }),
      f.a, id, true);
    expect(reset.status).toBe(200);
    expect(f.db.prepare("SELECT COUNT(*) FROM project_issue_credential_audit WHERE action='RESET'")
      .pluck().get()).toBe(1);
    expect(f.db.pragma("foreign_key_check")).toEqual([]);
  });
});
