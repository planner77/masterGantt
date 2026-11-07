import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScheduleViewSourceResponse } from "../../../src/contracts/schedule-views";
import { openDatabase } from "../../../src/server/db/core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { handleGetScheduleViewSource } from "../../../src/server/projects/schedule-view-source-handler-core";
import { ScheduleViewSourceService } from "../../../src/server/projects/schedule-view-source-service-core";
import { EditSessionRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleViewSourceRepository } from "../../../src/server/repositories/schedule-view-source-repository-core";
import { writeDisplayNameTranslations } from "../../../src/server/repositories/display-name-translations-repository-core";
import { createSessionToken } from "../../../src/server/security/session-core";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW as now } from "../../fixtures/resource-dashboard";

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { vi.restoreAllMocks(); for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function fixture(filename = ":memory:") {
  const f = wbsDashboardViewsFixture("mixed", filename);
  const service = new ScheduleViewSourceService(f.database, { clock: () => new Date(now) });
  let origin = "";
  const server = createServer(async (incoming, outgoing) => {
    const publicId = new URL(origin + incoming.url).pathname.split("/")[3];
    const response = await handleGetScheduleViewSource(new Request(origin + incoming.url, { method: incoming.method, headers: incoming.headers as Record<string, string> }), publicId,
      { service, applicationBaseUrl: origin, environment: "production", allowInsecureHttp: "true" });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  cleanups.push(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); f.database.close(); });
  const request = (publicId = f.project.publicId, cookie?: string, method = "GET") => fetch(`${origin}/api/projects/${publicId}/schedule-view-source`, { method, headers: cookie ? { Cookie: cookie } : {} });
  const read = async () => {
    const response = await request();
    expect(response.status, await response.clone().text()).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("set-cookie")).toBeNull();
    return (await response.json() as ScheduleViewSourceResponse).data;
  };
  const state = () => ({ canonical: f.state(), equipment: f.database.prepare("SELECT * FROM project_equipment ORDER BY id").all(),
    bindings: f.database.prepare("SELECT * FROM task_target_bindings ORDER BY id").all(),
    memberships: f.database.prepare("SELECT * FROM resource_group_members ORDER BY group_id,resource_id").all(),
    changes: f.database.prepare("SELECT total_changes() changes").get() });
  return { ...f, service, request, read, state };
}

describe("#880 schedule view source — actual HTTP and migrated SQLite", () => {
  it("reads explicit assignments/actual multiple groups, inactive metadata and single fleet rows without writes or global catalog disclosure", async () => {
    const f = await fixture(), r1 = f.resources.get("R1")!;
    const unrelated = f.catalog.insertResource({ publicId: randomUUID(), name: "Unrelated private global resource", code: null, description: "DO NOT EXPOSE", now });
    f.catalog.insertGroup({ publicId: randomUUID(), name: "Unrelated global group", code: null, description: "DO NOT EXPOSE", now });
    // Registered/Group-only members do not become personal Task assignees or public metadata.
    const group = f.groups.get("G1")!;
    f.database.prepare("INSERT INTO resource_group_members(group_id,resource_id,created_at) VALUES(?,?,?)").run(group.id, unrelated.id, now);
    f.database.prepare("UPDATE resources SET active=0 WHERE id=?").run(r1.id);
    f.database.prepare("UPDATE project_equipment SET active=0 WHERE id=?").run(f.equipment[0].id);
    f.database.prepare("UPDATE logistics_equipment_types SET active=0 WHERE code='amr'").run();
    writeDisplayNameTranslations(f.database, "resource_groups", group.id, { en: "Group one" });
    writeDisplayNameTranslations(f.database, "project_equipment", f.equipment[0].id, { en: "Equipment one" });
    writeDisplayNameTranslations(f.database, "logistics_equipment_types", "amr", { en: "Autonomous robot" });
    const before = f.state(), data = await f.read();
    expect(data).toMatchObject({ schema: "schedule-view-source/1", projectPublicId: f.project.publicId, projectRevision: f.project.revision,
      catalogRevision: f.catalog.getRevision(), logisticsTypeCatalogRevision: 1 });
    expect(data.resources).toEqual([{ id: r1.publicId, name: r1.name, active: false }]);
    expect(data.groups.map(row => row.id).sort()).toEqual([...f.groups.values()].map(row => row.publicId).sort());
    expect(data.groups.every(row => row.memberResourceIds.length === 1 && row.memberResourceIds[0] === r1.publicId)).toBe(true);
    expect(data.groups.find(row => row.id === group.publicId)?.translations).toEqual({ en: "Group one" });
    expect(data.assignments.filter(row => row.taskId === f.tasks.get("GROUP_ONLY")!.publicId)).toEqual([
      expect.objectContaining({ target: { kind: "group", id: group.publicId }, allocation: null }),
    ]);
    expect(data.equipment).toHaveLength(3);
    expect(data.equipment.find(row => row.id === f.idleEquipment.publicId)).toMatchObject({ quantity: 7, managementUnit: "fleet", model: "" });
    expect(data.equipment.find(row => row.id === f.equipment[0].publicId)).toMatchObject({ active: false, translations: { en: "Equipment one" } });
    expect(data.equipmentTypes).toEqual([expect.objectContaining({ code: "amr", active: false, translations: { en: "Autonomous robot" } })]);
    expect(data.taskEquipment.every(row => !row.effectiveEquipmentIds.includes(f.idleEquipment.publicId))).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/Unrelated|DO NOT EXPOSE|password|token|description|usageCount|projectUsageCount/);
    expect(f.state()).toEqual(before);
  });

  it("reuses canonical direct + ancestor subtree + archived resolver while keeping duplicate sources and one effective equipment identity", async () => {
    const f = await fixture(), summary = f.tasks.get("S")!, child = f.tasks.get("T0")!, equipment = f.equipment[0];
    f.logistics.replaceTaskEquipmentLinks(f.project.id, summary.id, [{ equipmentId: equipment.id, scope: "subtree" }], now);
    f.logistics.replaceTaskEquipmentLinks(f.project.id, child.id, [{ equipmentId: equipment.id, scope: "self" }], now);
    const before = f.state(), data = await f.read();
    const canonical = new LogisticsService(f.database).getTaskLogisticsLinks(f.project.id, child.publicId);
    const source = data.taskEquipment.find(row => row.taskId === child.publicId)!;
    expect(source.effectiveEquipmentIds).toEqual(canonical.effectiveEquipmentIds);
    expect(source.effectiveEquipmentIds).toHaveLength(2);
    expect(source.directEquipmentLinks).toEqual(canonical.directEquipmentLinks);
    expect(source.inheritedEquipmentLinks).toEqual(canonical.inheritedEquipmentLinks);
    expect(source.compatibilityLinks).toEqual(canonical.compatibilityLinks!.filter(row => row.kind === "equipment").map(row => {
      const equipmentSource = { ...row }; delete equipmentSource.context; return equipmentSource;
    }));
    expect(source.compatibilityLinks?.some(row => row.entityId === equipment.publicId)).toBe(true);
    expect(data.taskEquipment).toHaveLength(f.tasks.size);
    expect(f.state()).toEqual(before);
  });

  it("preserves Summary direct assignments as source and does not infer descendant personal assignments", async () => {
    const f = await fixture(), resource = f.resources.get("R2")!, summary = f.tasks.get("S")!, child = f.tasks.get("T0")!;
    f.catalog.replaceTaskAssignments({ projectId: f.project.id, taskId: summary.id, now, targets: [{ kind: "resource", publicId: resource.publicId,
      internalId: resource.id, assignmentPublicId: randomUUID(), assignmentStart: null, assignmentEnd: null, allocationPercent: 50 }] });
    const data = await f.read();
    expect(data.resources.some(row => row.id === resource.publicId)).toBe(true);
    expect(data.assignments.some(row => row.taskId === summary.publicId && row.target.id === resource.publicId)).toBe(true);
    expect(data.assignments.some(row => row.taskId === child.publicId && row.target.id === resource.publicId)).toBe(false);
  });

  it("enforces exact private Project sessions including foreign, expired, revoked and malformed cookies", async () => {
    const f = await fixture(), foreign = f.createProject(), sessions = new EditSessionRepository(f.database);
    f.database.prepare("UPDATE projects SET visibility='private' WHERE id=?").run(f.project.id);
    const ownToken = createSessionToken(), foreignToken = createSessionToken();
    for (const [project, token] of [[f.project, ownToken], [foreign, foreignToken]] as const) sessions.insert({ projectId: project.id, tokenHash: token.tokenHash,
      authVersion: project.authVersion, createdAt: now, expiresAt: "2026-10-16T16:00:00.000Z" });
    for (const cookie of [undefined, `mastergantt_edit=${foreignToken.rawToken}`, "mastergantt_edit=malformed"]) {
      const response = await f.request(f.project.publicId, cookie);
      expect(response.status).toBe(401); expect(await response.json()).toMatchObject({ error: { code: "PROJECT_LOCKED" } });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    const valid = await f.request(f.project.publicId, `mastergantt_edit=${ownToken.rawToken}`);
    expect(valid.status).toBe(200); expect(JSON.stringify(await valid.json())).not.toMatch(/token|password|salt|authVersion/);
    f.database.prepare("UPDATE edit_sessions SET expires_at=? WHERE project_id=?").run("2026-10-16T14:00:00.000Z", f.project.id);
    expect((await f.request(f.project.publicId, `mastergantt_edit=${ownToken.rawToken}`)).status).toBe(401);
    f.database.prepare("UPDATE edit_sessions SET expires_at=?,revoked_at=? WHERE project_id=?").run("2026-10-16T16:00:00.000Z", now, f.project.id);
    expect((await f.request(f.project.publicId, `mastergantt_edit=${ownToken.rawToken}`)).status).toBe(401);
  });

  it("keeps other Project assignments/equipment isolated and refreshes independent catalog revisions", async () => {
    const f = await fixture(), empty = f.createProject(), first = await f.read();
    const response = await f.request(empty.publicId), other = (await response.json() as ScheduleViewSourceResponse).data;
    expect(other).toMatchObject({ assignments: [], resources: [], groups: [], equipment: [], equipmentTypes: [], taskEquipment: [] });
    f.database.prepare("UPDATE resource_groups SET name='Renamed group' WHERE id=?").run(f.groups.get("G1")!.id);
    f.catalog.advanceRevision(first.catalogRevision, now);
    f.database.prepare("UPDATE logistics_type_catalog_state SET revision=revision+1 WHERE id=1").run();
    f.database.prepare("UPDATE logistics_equipment_types SET name='Renamed type' WHERE code='amr'").run();
    const second = await f.read();
    expect(second.projectRevision).toBe(first.projectRevision);
    expect(second.catalogRevision).toBe(first.catalogRevision + 1);
    expect(second.logisticsTypeCatalogRevision).toBe(first.logisticsTypeCatalogRevision + 1);
    expect(second.groups.some(row => row.name === "Renamed group")).toBe(true);
    expect(second.equipmentTypes[0].name).toBe("Renamed type");
  });

  it.each(["assignment", "membership", "equipment"] as const)("blocks damaged %s references instead of silently dropping data", async kind => {
    const f = await fixture();
    f.database.pragma("foreign_keys=OFF");
    if (kind === "assignment") f.database.prepare("UPDATE task_assignments SET resource_id=999999 WHERE id=(SELECT min(id) FROM task_assignments WHERE resource_id IS NOT NULL)").run();
    if (kind === "membership") f.database.prepare("INSERT INTO resource_group_members(group_id,resource_id,created_at) VALUES(999999,?,?)").run(f.resources.get("R1")!.id, now);
    if (kind === "equipment") f.database.prepare("UPDATE task_equipment_links SET equipment_id=999999 WHERE id=(SELECT min(id) FROM task_equipment_links)").run();
    f.database.pragma("foreign_keys=ON");
    const before = f.state(), response = await f.request();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: kind === "equipment" ? "LOGISTICS_SOURCE_INVALID" : "SCHEDULE_VIEW_SOURCE_INVALID" } });
    expect(f.state()).toEqual(before);
  });

  it("rejects unsupported methods, malformed/missing Projects and bad deployment configuration without source disclosure", async () => {
    const f = await fixture();
    expect((await f.request(randomUUID())).status).toBe(404);
    expect((await f.request("not-a-project")).status).toBe(404);
    expect((await f.request(f.project.publicId, undefined, "POST")).status).toBe(405);
    const response = await handleGetScheduleViewSource(new Request("https://gantt.example"), f.project.publicId,
      { service: f.service, applicationBaseUrl: "invalid", environment: "production" });
    expect(response.status).toBe(500); expect(await response.json()).toMatchObject({ error: { code: "CONFIGURATION_ERROR" } });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("bounds assignment collection before materialization and preserves the rejected source without writes", async () => {
    const f = await fixture(), task = f.tasks.get("T1")!;
    f.database.transaction(() => {
      const resource = f.database.prepare("INSERT INTO resources(public_id,name,description,active,created_at,updated_at) VALUES(?,?,'',1,?,?)");
      const assignment = f.database.prepare("INSERT INTO task_assignments(public_id,project_id,task_id,resource_id,created_at,updated_at) VALUES(?,?,?,?,?,?)");
      for (let index = 0; index < 8001; index++) {
        const resourceId = Number(resource.run(randomUUID(), `Bounded resource ${index}`, now, now).lastInsertRowid);
        assignment.run(randomUUID(), f.project.id, task.id, resourceId, now, now);
      }
    })();
    const before = f.state(), response = await f.request();
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "SCHEDULE_VIEW_SOURCE_LIMIT_EXCEEDED" } });
    expect(f.state()).toEqual(before);
  });

  it("keeps one WAL read snapshot when another connection changes Project and global metadata during collection", async () => {
    const directory = mkdtempSync(join(tmpdir(), "schedule-view-source-"));
    cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
    const filename = join(directory, "database.sqlite3"), f = await fixture(filename);
    const writer = openDatabase({ filename, migrationsDirectory: join(process.cwd(), "db/migrations") }).database;
    cleanups.push(() => { writer.close(); });
    const initial = await f.read();
    const original = ScheduleViewSourceRepository.prototype.read;
    vi.spyOn(ScheduleViewSourceRepository.prototype, "read").mockImplementationOnce(function (this: ScheduleViewSourceRepository, id: number) {
      writer.transaction(() => {
        writer.prepare("UPDATE projects SET revision=revision+1 WHERE id=?").run(f.project.id);
        writer.prepare("UPDATE resources SET name='Concurrent new name' WHERE id=?").run(f.resources.get("R1")!.id);
        writer.prepare("UPDATE resource_catalog_state SET revision=revision+1 WHERE id=1").run();
      })();
      return original.call(this, id);
    });
    expect(await f.read()).toEqual(initial);
    const refreshed = await f.read();
    expect(refreshed.projectRevision).toBe(initial.projectRevision + 1);
    expect(refreshed.catalogRevision).toBe(initial.catalogRevision + 1);
    expect(refreshed.resources[0].name).toBe("Concurrent new name");
  });
});
