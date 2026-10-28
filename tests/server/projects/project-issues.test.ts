import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import {
  ProjectIssueService, parseProjectIssueInput, parseProjectIssueQuery, projectIssueToday,
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
const databases: Database.Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

async function fixture() {
  const db = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
  databases.push(db);
  const projects = new TaskFieldProjectService(db, { clock, hashPassword });
  const service = new ProjectIssueService(db, { clock });
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
  const handle = (request: Request, p = a, issueId?: string) => handleProjectIssues(request, p.publicId, {
    service, projectService: projects, applicationBaseUrl: base, environment: "test",
  }, issueId);
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
    const first = f.service.mutate(f.a.authorization, f.a.revision(), parseProjectIssueInput(input()));
    expect(first.data.issue).toMatchObject({ title: "차량 정지", completed: false, reporterName: "등록자" });
    expect(first.data.projectRevision).toBe(2);
    for (let index = 0; index < 22; index++) {
      f.service.mutate(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
        title: "문제 " + String(index).padStart(2, "0"),
        description: "재발 상황 " + index,
        completed: index < 11, completedOn: index < 11 ? "2026-10-28" : null,
      })));
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
    const updated = f.service.mutate(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
      completed: true, completedOn: "2026-10-28", title: "다시 정상",
    })), first.data.issue.issueId);
    expect(updated.data.issue).toMatchObject({ title: "다시 정상", completed: true });
    expect(list("status=completed").total).toBe(12);
    expect(f.service.list(f.b.publicId, parseProjectIssueQuery(new URLSearchParams())).data.summary.total).toBe(0);
  });

  it("checks current session, revision and cross-project Task; clears only deleted references", async () => {
    const f = await fixture();
    const otherTask = f.projects.createTask(f.b.authorization, f.b.revision(), {
      type: "task", name: "B 전용", externalId: "B", start: "2026-10-29", duration: 1, progress: 0,
    }).data.tasks.find(item => item.externalId === "B")!;
    expect(() => f.service.mutate(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
      relatedTaskId: otherTask.taskId,
    })))).toThrow("Task");
    const ownTask = f.projects.createTask(f.a.authorization, f.a.revision(), {
      type: "task", name: "A 전용", externalId: "A", start: "2026-10-29", duration: 1, progress: 0,
    }).data.tasks.find(item => item.externalId === "A")!;
    const catalog = new ResourceCatalogRepository(f.db);
    const resource = catalog.insertResource({
      publicId: randomUUID(), name: "김개발", code: "DEV", description: "", now,
    });
    // A valid global Resource UUID belonging only to another project is still forbidden.
    const selectForeignResource = () => f.service.mutate(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
      reporterResourceId: resource.publicId, reporterName: "조작된 이름",
    })));
    expect(selectForeignResource).toThrow("현재 프로젝트");
    const registerResource = (projectId: number) => f.db.prepare(
      "INSERT INTO project_resource_memberships(project_id, resource_id, created_at) SELECT ?, id, ? FROM resources WHERE public_id = ?"
    ).run(projectId, now, resource.publicId);
    expect(registerResource(f.b.authorization.projectId).changes).toBe(1);
    expect(selectForeignResource).toThrow("현재 프로젝트");
    expect(registerResource(f.a.authorization.projectId).changes).toBe(1);
    const created = f.service.mutate(f.a.authorization, f.a.revision(), parseProjectIssueInput(input({
      reporterResourceId: resource.publicId, reporterName: "조작된 이름",
      assigneeResourceId: resource.publicId, assigneeName: "조작된 이름",
      relatedTaskId: ownTask.taskId, relatedTaskText: "조작된 Task",
    })));
    expect(created.data.issue).toMatchObject({
      reporterName: "김개발", assigneeName: "김개발",
      relatedTaskText: "A 전용", relatedTaskId: ownTask.taskId,
    });
    expect(() => f.service.mutate(f.a.authorization, f.a.revision() - 1,
      parseProjectIssueInput(input()))).toThrow("프로젝트가 변경");
    f.db.prepare("DELETE FROM tasks WHERE project_id=? AND public_id=?").run(f.a.authorization.projectId, ownTask.taskId);
    f.db.prepare("DELETE FROM resources WHERE public_id=?").run(resource.publicId);
    const list = f.service.list(f.a.publicId, parseProjectIssueQuery(new URLSearchParams())).data.issues;
    expect(list[0]).toMatchObject({ relatedTaskId: null, relatedTaskText: "A 전용",
      reporterResourceId: null, assigneeResourceId: null, reporterName: "김개발" });
    const unauthorized = { ...f.a.authorization, projectAuthVersion: -1 };
    expect(() => f.service.mutate(unauthorized, f.a.revision(), parseProjectIssueInput(input()))).toThrow("편집 세션");
  });

  it("enforces Origin, If-Match, edit session, repeatable read, and no-store HTTP", async () => {
    const f = await fixture();
    const post = await f.handle(f.request("POST", input()));
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
    const patch = await f.handle(f.request("PATCH", input({ completed: true, completedOn: "2026-10-28" }), {
      issueId: created.data.issue.issueId,
    }), f.a, created.data.issue.issueId);
    expect(patch.status).toBe(200);
    const other = await f.handle(f.request("PATCH", input(), {
      p: f.b, issueId: created.data.issue.issueId,
    }), f.b, created.data.issue.issueId);
    expect(other.status).toBe(404);
    const invalid = await f.handle(f.request("POST", { ...input(), complete: true }));
    expect(invalid.status).toBe(400);
  });
});
