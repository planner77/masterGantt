import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { handleGetTarget, handleListTargets, handleMutateTarget } from "../../../src/server/logistics/logistics-targets-handlers-core";
import { LogisticsTargetService } from "../../../src/server/logistics/logistics-targets-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { LogisticsTypeCatalogRepository } from "../../../src/server/repositories/logistics-type-catalog-repository-core";
import { ProcessCatalogRepository } from "../../../src/server/repositories/process-catalog-repository-core";
import { ProjectMasterRepository } from "../../../src/server/repositories/project-master-repository-core";
import { EditSessionRepository, ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";
import { createSessionToken, sessionExpiry } from "../../../src/server/security/session-core";

const migrationDir = join(process.cwd(), "db/migrations");
const now = new Date("2026-10-12T01:00:00.000Z");
const stamp = now.toISOString();
const baseUrl = "https://gantt.example.com";
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup(filename = ":memory:", migrationsDirectory = migrationDir) {
  const { database: db } = openDatabase({ filename, migrationsDirectory });
  const project = new ProjectRepository(db).insert({
    publicId: randomUUID(), name: "F2 acceptance", description: "", status: "planned",
    passwordKdf: "scrypt", passwordSalt: Buffer.alloc(16, 1), passwordHash: Buffer.alloc(32, 2),
    scryptN: 32768, scryptR: 8, scryptP: 3, scryptKeyLength: 32,
    calendarTimezone: "Asia/Seoul", createdAt: stamp, updatedAt: stamp,
  });
  const token = createSessionToken();
  const sessionId = new EditSessionRepository(db).insert({
    projectId: project.id, tokenHash: token.tokenHash, authVersion: project.authVersion,
    createdAt: stamp, expiresAt: sessionExpiry(now).toISOString(),
  });
  const projectService = new TaskFieldProjectService(db, { clock: () => now });
  const authorization = projectService.authorize(project.publicId, token.rawToken);
  if (authorization.kind !== "authorized") throw new Error("Fixture edit authorization failed");
  const logistics = new LogisticsRepository(db);
  const mcs = logistics.insertSystem({
    publicId: randomUUID(), projectId: project.id, code: "MCS-1", name: "MCS",
    systemType: "mcs", layer: "coordinator", scope: "project", now: stamp,
  });
  return {
    db, project, token, sessionId, projectService, auth: authorization.authorization,
    logistics, mcs, targets: new LogisticsTargetService(db, { clock: () => now }),
  };
}
type Fixture = ReturnType<typeof setup>;

function revision(f: Fixture) {
  return new ProjectRepository(f.db).findByPublicId(f.project.publicId)!.revision;
}
function common(f: Fixture, code: string) {
  return { code, name: code, scope: "project_common" as const,
    members: [{ kind: "system" as const, entityId: f.mcs.publicId }] };
}
function mappedProcesses(f: Fixture) {
  const master = new ProjectMasterRepository(f.db);
  const item = (category: "BUSINESS_UNIT" | "PRODUCT" | "SITE_ENTITY", code: string) =>
    master.insertItem({ publicId: randomUUID(), category, code, name: code,
      active: true, sortOrder: 0, now: stamp });
  const bu = item("BUSINESS_UNIT", "BU-F2");
  const product = item("PRODUCT", "PROD-F2");
  const site = item("SITE_ENTITY", "SITE-F2");
  f.db.prepare("INSERT INTO business_unit_products(business_unit_id,product_id) VALUES(?,?)")
    .run(bu.id, product.id);
  f.db.prepare("INSERT INTO business_unit_product_sites(business_unit_id,product_id,site_entity_id) VALUES(?,?,?)")
    .run(bu.id, product.id, site.id);
  f.db.prepare("UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?")
    .run(bu.id, product.id, site.id, f.project.id);
  const typeId = Number(f.db.prepare(
    "INSERT INTO process_types(public_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?)",
  ).run(randomUUID(), "F2-PROC", "Process", stamp, stamp).lastInsertRowid);
  const make = (code: string) => {
    const process = f.logistics.insertProcess({
      publicId: randomUUID(), projectId: f.project.id, code, name: code,
      parentId: null, active: 1, now: stamp,
    });
    const occurrenceId = randomUUID();
    const id = Number(f.db.prepare(
      "INSERT INTO site_product_processes(public_id,business_unit_id,product_id,site_entity_id,process_type_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(occurrenceId, bu.id, product.id, site.id, typeId, code, code, stamp, stamp).lastInsertRowid);
    const catalog = new ProcessCatalogRepository(f.db);
    catalog.setMapping(f.project.id, process.id, catalog.find("occurrences", occurrenceId)!, null, stamp);
    const areaId = randomUUID();
    f.db.prepare(
      "INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)",
    ).run(areaId, id, code + "-AREA", "Area", stamp, stamp);
    return { process, areaId };
  };
  const A = make("PROC-A");
  const B = make("PROC-B");
  const equipment = (code: string, processId: number, quantity: number) =>
    f.logistics.insertEquipment({
      publicId: randomUUID(), projectId: f.project.id, processId, code, name: code,
      equipmentType: "amr", managementUnit: "fleet", quantity, now: stamp,
    });
  const system = (code: string, processId: number) => {
    const s = f.logistics.insertSystem({
      publicId: randomUUID(), projectId: f.project.id, code, name: code,
      systemType: "acs", layer: "controller", scope: "processes", now: stamp,
    });
    f.logistics.setSystemProcesses(f.project.id, s.id, [processId], stamp);
    return s;
  };
  const eqA = equipment("AMR-A", A.process.id, 10);
  const eqB = equipment("AMR-B", B.process.id, 5);
  const acsA = system("ACS-A", A.process.id);
  const acsB = system("ACS-B", B.process.id);
  return { A, B, eqA, eqB, acsA, acsB };
}
function httpDeps(f: Fixture) {
  return { service: f.targets, projectService: f.projectService,
    applicationBaseUrl: baseUrl, environment: "production" };
}
type RequestOptions = {
  origin?: string | null;
  cookie?: boolean;
  ifMatch?: string | null;
  contentType?: string;
  declaredLength?: string;
  rawBody?: string;
};
function mutation(f: Fixture, action: "create" | "update" | "delete", body: unknown,
  options: RequestOptions = {}, targetId?: string) {
  const headers: Record<string, string> = {};
  if (options.origin !== null) headers.Origin = options.origin ?? baseUrl;
  if (options.cookie !== false) {
    headers.Cookie = editSessionCookieName("production", new URL(baseUrl)) + "=" + f.token.rawToken;
  }
  if (options.ifMatch !== null) headers["If-Match"] = options.ifMatch ?? ('"' + revision(f) + '"');
  if (action !== "delete") headers["Content-Type"] = options.contentType ?? "application/json";
  if (options.declaredLength !== undefined) headers["Content-Length"] = options.declaredLength;
  const url = baseUrl + "/api/projects/" + f.project.publicId + "/logistics/targets" +
    (targetId === undefined ? "" : "/" + targetId);
  const request = new Request(url, {
    method: action === "create" ? "POST" : action === "update" ? "PATCH" : "DELETE",
    headers,
    ...(action === "delete" ? {} : { body: options.rawBody ?? JSON.stringify(body) }),
  });
  return handleMutateTarget(request, f.project.publicId, httpDeps(f), action, targetId);
}
function listing(f: Fixture, query = "", authenticated = false) {
  const headers = authenticated ? {
    Cookie: editSessionCookieName("production", new URL(baseUrl)) + "=" + f.token.rawToken,
  } : undefined;
  const request = new Request(baseUrl + "/api/projects/" + f.project.publicId +
    "/logistics/targets" + query, { headers });
  return handleListTargets(request, f.project.publicId, httpDeps(f));
}
function usage(f: Fixture, targetId: string) {
  const request = new Request(baseUrl + "/api/projects/" + f.project.publicId +
    "/logistics/targets/" + targetId + "/usage");
  return handleGetTarget(request, f.project.publicId, targetId, httpDeps(f), true);
}
function count(f: Fixture, table: string) {
  // Table names are fixed in tests; do not use caller data from the application.
  if (!["logistics_targets", "logistics_target_members", "project_equipment",
    "project_logistics_systems"].includes(table)) throw new Error("invalid fixture table");
  return (f.db.prepare("SELECT COUNT(*) AS n FROM " + table).get() as { n: number }).n;
}

describe("Issue #672 — #616 F2 acceptance: domain and SQL", () => {
  it("AC1 accepts equipment-only, System-only, mixed and common Targets with optional WorkArea", () => {
    const f = setup();
    try {
      const { A, B, eqA, eqB, acsA, acsB } = mappedProcesses(f);
      const eq = f.targets.create(f.auth, revision(f), {
        code: "EQUIPMENT", name: "equipment only", scope: "process",
        projectProcessId: A.process.publicId, workAreaId: A.areaId,
        members: [{ kind: "equipment", entityId: eqA.publicId }],
      }).data.target!;
      expect(eq.members.map(m => m.kind)).toEqual(["equipment"]);
      expect(eq.workAreaId).toBe(A.areaId);
      expect(eq.members[0].quantity).toBe(10);
      const sys = f.targets.create(f.auth, revision(f), {
        code: "SYSTEM", name: "System only", scope: "process",
        projectProcessId: B.process.publicId,
        members: [{ kind: "system", entityId: acsB.publicId }],
      }).data.target!;
      expect(sys.workAreaId).toBeNull();
      expect(sys.members[0].quantity).toBe(1);
      const mixed = f.targets.create(f.auth, revision(f), {
        code: "MIXED", name: "Mixed", scope: "process",
        projectProcessId: A.process.publicId,
        members: [
          { kind: "equipment", entityId: eqA.publicId },
          { kind: "system", entityId: acsA.publicId },
          { kind: "system", entityId: f.mcs.publicId },
        ],
      }).data.target!;
      expect(mixed.members).toHaveLength(3);
      expect(f.targets.create(f.auth, revision(f), common(f, "COMMON")).data.target!.members[0].entityId)
        .toBe(f.mcs.publicId);
      expect(eqB.quantity).toBe(5);
      expect(acsA.code).toBe("ACS-A");
      expect(count(f, "logistics_targets")).toBe(4);
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    } finally { f.db.close(); }
  });

  it("AC1 rejects a wrong occurrence, wrong process, common equipment, inactive System and duplicate members", () => {
    const f = setup();
    try {
      const { A, B, eqA, eqB, acsA } = mappedProcesses(f);
      const before = revision(f);
      const bad = (code: string, processId: string, area: string | null,
        members: Array<{ kind: "equipment" | "system"; entityId: string }>) =>
        f.targets.create(f.auth, before, {
          code, name: code, scope: "process", projectProcessId: processId,
          workAreaId: area, members,
        });
      expect(() => bad("WRONG-AREA", B.process.publicId, A.areaId,
        [{ kind: "equipment", entityId: eqB.publicId }])).toThrow();
      expect(() => bad("WRONG-PROC", A.process.publicId, null,
        [{ kind: "equipment", entityId: eqB.publicId }])).toThrow();
      expect(() => f.targets.create(f.auth, before, {
        code: "BAD-COMMON", name: "bad", scope: "project_common",
        members: [{ kind: "equipment", entityId: eqA.publicId }],
      })).toThrow();
      expect(() => bad("DUPLICATE", A.process.publicId, null,
        [{ kind: "system", entityId: acsA.publicId },
          { kind: "system", entityId: acsA.publicId }])).toThrow();
      f.db.prepare("UPDATE project_logistics_systems SET active=0 WHERE id=?").run(f.mcs.id);
      expect(() => f.targets.create(f.auth, before, common(f, "INACTIVE"))).toThrow();
      expect(count(f, "logistics_targets")).toBe(0);
      expect(revision(f)).toBe(before);
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    } finally { f.db.close(); }
  });

  it("AC2 and AC4 preserve source identity, quantities, control graph and unrelated memberships", () => {
    const f = setup();
    try {
      const { A, B, eqA, eqB, acsA, acsB } = mappedProcesses(f);
      f.logistics.setEquipmentSystems(f.project.id, eqA.id,
        [{ systemId: acsA.id, controlRole: "primary" }], stamp);
      f.logistics.setEquipmentSystems(f.project.id, eqB.id,
        [{ systemId: acsB.id, controlRole: "primary" }], stamp);
      f.logistics.setCoordinatedSystems(f.project.id, f.mcs.id, [acsA.id, acsB.id], stamp);
      const resourceId = Number(f.db.prepare(
        "INSERT INTO resources(public_id,name,code,description,developer_grade,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      ).run(randomUUID(), "F2 Owner", "F2-OWNER", "", "ADVANCED", 1, stamp, stamp).lastInsertRowid);
      f.db.prepare(
        "INSERT INTO project_equipment_resource_roles(project_id,equipment_id,resource_id,role,is_primary,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      ).run(f.project.id, eqA.id, resourceId, "owner", 1, stamp, stamp);
      f.db.prepare(
        "INSERT INTO project_system_resource_roles(project_id,system_id,resource_id,role,is_primary,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      ).run(f.project.id, f.mcs.id, resourceId, "pi", 1, stamp, stamp);
      const source = () => JSON.stringify([
        f.db.prepare("SELECT * FROM project_equipment ORDER BY id").all(),
        f.db.prepare("SELECT * FROM project_logistics_systems ORDER BY id").all(),
        f.db.prepare("SELECT * FROM project_equipment_systems ORDER BY id").all(),
        f.db.prepare("SELECT * FROM project_system_links ORDER BY id").all(),
        f.db.prepare("SELECT * FROM project_equipment_resource_roles ORDER BY id").all(),
        f.db.prepare("SELECT * FROM project_system_resource_roles ORDER BY id").all(),
      ]);
      const original = source();
      const first = f.targets.create(f.auth, revision(f), {
        code: "A", name: "A", scope: "process", projectProcessId: A.process.publicId,
        members: [{ kind: "equipment", entityId: eqA.publicId },
          { kind: "system", entityId: acsA.publicId },
          { kind: "system", entityId: f.mcs.publicId }],
      }).data.target!;
      const second = f.targets.create(f.auth, revision(f), {
        code: "B", name: "B", scope: "process", projectProcessId: B.process.publicId,
        members: [{ kind: "equipment", entityId: eqB.publicId },
          { kind: "system", entityId: acsB.publicId },
          { kind: "system", entityId: f.mcs.publicId }],
      }).data.target!;
      expect(f.targets.usage(f.project.publicId, first.id).members
        .find(m => m.entityId === f.mcs.publicId)!.targetCount).toBe(2);
      f.targets.update(f.auth, revision(f), first.id, {
        name: "Renamed", members: [{ kind: "system", entityId: f.mcs.publicId }],
      });
      expect(f.targets.get(f.project.publicId, second.id).members.map(m => m.entityId))
        .toContain(f.mcs.publicId);
      expect(source()).toBe(original);
      f.targets.delete(f.auth, revision(f), first.id);
      expect(f.targets.get(f.project.publicId, second.id).members.map(m => m.entityId))
        .toContain(f.mcs.publicId);
      expect(source()).toBe(original);
      expect(() => f.db.prepare("DELETE FROM project_logistics_systems WHERE id=?")
        .run(f.mcs.id)).toThrow();
      expect(f.targets.usage(f.project.publicId, second.id).members
        .find(m => m.entityId === f.mcs.publicId)!.targetCount).toBe(1);
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    } finally { f.db.close(); }
  });

  it("AC3 rolls back inline-created Equipment and Target when a later member fails", () => {
    const f = setup();
    try {
      const { A } = mappedProcesses(f);
      const type = new LogisticsTypeCatalogRepository(f.db);
      type.insert("equipment", {
        code: "f2-test-amr", name: "F2 AMR", active: true, sortOrder: 0, now: stamp,
      });
      const before = revision(f);
      const payload = {
        code: "ATOMIC", name: "Atomic", scope: "process",
        projectProcessId: A.process.publicId,
        members: [
          { kind: "equipment", create: { code: "NEW-AMR", name: "New AMR",
            equipmentType: "f2-test-amr", managementUnit: "fleet", quantity: 3 } },
          { kind: "system", create: { code: "BAD-SYSTEM", systemType: "missing-type",
            layer: "controller", scope: "project" } },
        ],
      };
      expect(() => f.targets.create(f.auth, before, payload))
        .toThrow("TARGET_SYSTEM_TYPE_INACTIVE");
      expect(f.logistics.findEquipmentByCode(f.project.id, "NEW-AMR")).toBeUndefined();
      expect(count(f, "logistics_targets")).toBe(0);
      expect(revision(f)).toBe(before);
      const accepted = f.targets.create(f.auth, before, {
        ...payload, members: [payload.members[0]],
      });
      expect(accepted.data.projectRevision).toBe(before + 1);
      expect(accepted.data.target!.members[0].quantity).toBe(3);
      expect(f.logistics.findEquipmentByCode(f.project.id, "NEW-AMR")).toBeDefined();
      expect(() => f.targets.create(f.auth, before, {
        ...payload, code: "DUPLICATE-SUBMIT", members: [payload.members[0]],
      })).toThrow();
      expect(count(f, "logistics_targets")).toBe(1);
      expect(revision(f)).toBe(before + 1);
    } finally { f.db.close(); }
  });
});

describe("Issue #672 — #616 F2 acceptance: actual Target HTTP handlers", () => {
  it("AC3 enforces Origin/session/strong CAS, bound JSON and rollback with exact status codes", async () => {
    const f = setup();
    try {
      const payload = common(f, "COMMON");
      expect((await mutation(f, "create", payload, { origin: null })).status).toBe(403);
      expect((await mutation(f, "create", payload, { cookie: false })).status).toBe(401);
      expect((await mutation(f, "create", payload, { ifMatch: null })).status).toBe(428);
      expect((await mutation(f, "create", payload, { ifMatch: 'W/"1"' })).status).toBe(400);
      expect((await mutation(f, "create", payload, { rawBody: "{" })).status).toBe(400);
      expect((await mutation(f, "create", payload, { contentType: "text/plain" })).status).toBe(415);
      expect((await mutation(f, "create", payload, { declaredLength: "33000" })).status).toBe(413);
      expect((await mutation(f, "create", { ...payload, members: [] })).status).toBe(400);
      expect((await mutation(f, "create", { ...payload, code: "FOREIGN",
        members: [{ kind: "system", entityId: randomUUID() }] })).status).toBe(409);
      expect(revision(f)).toBe(1);
      expect(count(f, "logistics_targets")).toBe(0);
      const created = await mutation(f, "create", payload);
      expect(created.status).toBe(201);
      expect(created.headers.get("ETag")).toBe('"2"');
      const data = await created.json();
      const targetId = data.data.target.id as string;
      expect((await mutation(f, "create", { ...payload, code: "STALE" },
        { ifMatch: '"1"' })).status).toBe(412);
      expect((await mutation(f, "create", payload)).status).toBe(409);
      const noChange = await mutation(f, "update", { name: "COMMON" }, {}, targetId);
      expect(noChange.status).toBe(200);
      expect((await noChange.json()).data.projectRevision).toBe(2);
      expect(revision(f)).toBe(2);
      expect((await mutation(f, "delete", null, { ifMatch: '"1"' }, targetId)).status).toBe(412);
      expect((await mutation(f, "delete", null, {}, targetId)).status).toBe(200);
      expect(revision(f)).toBe(3);
      expect(count(f, "logistics_targets")).toBe(0);
      expect(f.logistics.findSystemByPublicId(f.project.id, f.mcs.publicId)).toBeDefined();
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    } finally { f.db.close(); }
  });

  it("AC4/AC6 provide bounded sorted read-only list, search, correct usage and HTTP errors", async () => {
    const f = setup();
    try {
      for (const [code, name] of [["Z", "Zulu"], ["A", "Alpha"], ["M", "Mike"]]) {
        f.targets.create(f.auth, revision(f), {
          ...common(f, code), name,
        });
      }
      const paged = listing(f, "?limit=1&offset=1");
      expect(paged.status).toBe(200);
      const result = await paged.json();
      expect(result.data.permission).toBe("readonly");
      expect(result.data.total).toBe(3);
      expect(result.data.targets.map((t: { code: string }) => t.code)).toEqual(["M"]);
      expect(result.data.projectRevision).toBe(4);
      const searched = await listing(f, "?limit=10&offset=0&search=alph").json();
      expect(searched.data.total).toBe(1);
      expect(searched.data.targets[0].code).toBe("A");
      const authList = await listing(f, "?limit=100", true).json();
      expect(authList.data.permission).toBe("edit");
      expect(authList.data.targets).toHaveLength(3);
      const id = authList.data.targets[0].id as string;
      const us = await usage(f, id).json();
      expect(us.data.memberCount).toBe(1);
      expect(us.data.members[0].targetCount).toBe(3);
      expect(us.data.members[0].directTaskCount).toBe(0);
      // This is a legacy interim placeholder, NOT an authoritative WBS–Target task count (#617).
      expect(us.data.referencedByTaskCount).toBe(0);
      for (const query of ["?limit=0", "?limit=101", "?offset=-1",
        "?offset=10001", "?search=%20", "?limit=1&limit=2", "?unknown=yes"]) {
        expect(listing(f, query).status).toBe(400);
      }
      expect(usage(f, randomUUID()).status).toBe(404);
    } finally { f.db.close(); }
  });
});

describe("Issue #672 — #616 F2 acceptance: SQLite migration persistence", () => {
  it("AC5 upgrades an actual 0025 file DB, retains existing instances and reopens Target identity after restart", () => {
    const folder = mkdtempSync(join(tmpdir(), "mastergantt-f2-upgrade-"));
    tempDirs.push(folder);
    const prior = join(folder, "migrations-0025");
    mkdirSync(prior);
    const names = readdirSync(migrationDir).filter(name => /^\d{4}_.*\.sql$/.test(name));
    for (const name of names.filter(name => Number(name.slice(0, 4)) <= 25)) {
      copyFileSync(join(migrationDir, name), join(prior, name));
    }
    const filename = join(folder, "f2.sqlite3");
    const f = setup(filename, prior);
    const sourceId = f.project.publicId;
    const mcsId = f.mcs.publicId;
    const auth = f.auth;
    expect((f.db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as {v:number}).v).toBe(25);
    f.db.close();

    const first = openDatabase({ filename, migrationsDirectory: migrationDir });
    expect(first.migrations.applied).toEqual(["0026_logistics_targets.sql"]);
    const target = new LogisticsTargetService(first.database, { clock: () => now }).create(auth, 1, {
      code: "PERSIST", name: "Persisted", scope: "project_common",
      members: [{ kind: "system", entityId: mcsId }],
    }).data.target!;
    expect(first.database.pragma("foreign_key_check")).toEqual([]);
    first.database.close();

    const second = openDatabase({ filename, migrationsDirectory: migrationDir });
    try {
      expect(second.migrations.applied).toEqual([]);
      const saved = new LogisticsTargetService(second.database).get(sourceId, target.id);
      expect(saved.members).toHaveLength(1);
      expect(saved.members[0].entityId).toBe(mcsId);
      expect(saved.id).toBe(target.id);
      expect(saved.code).toBe("PERSIST");
      expect(second.database.pragma("foreign_key_check")).toEqual([]);
      expect((second.database.prepare("SELECT MAX(version) AS v FROM schema_migrations")
        .get() as {v:number}).v).toBe(26);
    } finally { second.database.close(); }
  });
});
