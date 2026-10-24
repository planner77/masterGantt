import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";

import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { parseCreateProjectInput, parseUpdateProjectInput } from "../../../src/server/projects/project-contract";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const databases: Database.Database[] = [];
let timestamp = "2026-10-24T02:00:00.000Z";
function setup() {
  const database = openDatabase({ filename: ":memory:", migrationsDirectory }).database;
  databases.push(database);
  const service = new ProjectService(database, {
    clock: () => new Date(timestamp),
    hashPassword: async () => ({
      algorithm: "scrypt", salt: Buffer.alloc(16, 3), hash: Buffer.alloc(32, 8),
      n: 32_768, r: 8, p: 3, keyLength: 32,
    }),
  });
  return { database, service };
}
afterEach(() => { databases.splice(0).forEach(db => db.close()); timestamp = "2026-10-24T02:00:00.000Z"; });

describe("Issue #479 visibility and private read authorization", () => {
  it("accepts only strict public/private values and permits visibility-only PATCH", () => {
    const base = { name: "Project", ownerName: "Owner", description: "", editPassword: "secret" };
    for (const visibility of ["public", "private"] as const) {
      expect(parseCreateProjectInput({ ...base, visibility })).toMatchObject({ success: true });
      expect(parseUpdateProjectInput({ visibility })).toMatchObject({ success: true });
    }
    for (const visibility of [null, "", "hidden", 1]) {
      expect(parseCreateProjectInput({ ...base, visibility }).success).toBe(false);
      expect(parseUpdateProjectInput({ visibility }).success).toBe(false);
    }
    expect(parseCreateProjectInput(base).success).toBe(true);
  });

  it("migrates pre-existing-compatible defaults and enforces the DB CHECK", async () => {
    const { database, service } = setup();
    const created = await service.create({ name: "Legacy", description: "", editPassword: "s" });
    const id = created.response.data.project.publicId;
    expect(created.response.data.project.visibility).toBe("public");
    expect((database.prepare("SELECT visibility FROM projects WHERE public_id = ?").get(id) as {visibility:string}).visibility).toBe("public");
    expect(() => database.prepare("UPDATE projects SET visibility = 'unknown' WHERE public_id = ?").run(id)).toThrow();
    expect(() => database.prepare("UPDATE projects SET visibility = NULL WHERE public_id = ?").run(id)).toThrow();
    expect(service.getReadonlySnapshot(id)?.data.project.visibility).toBe("public");
  });

  it("hides the private canonical snapshot from missing/foreign/expired/revoked sessions", async () => {
    const { database, service } = setup();
    const first = await service.create({name:"Private name",description:"Sensitive",editPassword:"x",visibility:"private"});
    const other = await service.create({name:"Other",description:"",editPassword:"y",visibility:"private"});
    const id = first.response.data.project.publicId;
    expect(service.listProjects().data.projects.find(p => p.publicId === id)).toMatchObject({name:"Private name",visibility:"private"});
    expect(service.projectReadAccess(id)).toBe("locked");
    expect(service.getReadonlySnapshot(id)).toBeUndefined();
    expect(service.projectReadAccess(id, other.rawSessionToken)).toBe("locked");
    expect(service.getReadonlySnapshot(id, other.rawSessionToken)).toBeUndefined();
    expect(service.projectReadAccess(id, first.rawSessionToken)).toBe("allowed");
    expect(service.getReadonlySnapshot(id, first.rawSessionToken)?.data.project.name).toBe("Private name");
    timestamp = "2026-10-24T11:00:00.000Z";
    expect(service.projectReadAccess(id, first.rawSessionToken)).toBe("locked");
    timestamp = "2026-10-24T02:00:00.000Z";
    database.prepare("UPDATE edit_sessions SET revoked_at = ? WHERE project_id = (SELECT id FROM projects WHERE public_id = ?)").run(timestamp,id);
    expect(service.projectReadAccess(id, first.rawSessionToken)).toBe("locked");
  });

  it("changes visibility within the existing edit session + If-Match revision contract without rotating credentials", async () => {
    const { database, service } = setup();
    const created = await service.create({name:"Private",description:"",editPassword:"x",visibility:"private"});
    const id = created.response.data.project.publicId;
    const result = service.authorize(id, created.rawSessionToken);
    expect(result.kind).toBe("authorized");
    if (result.kind !== "authorized") throw new Error("No edit session");
    const before = database.prepare("SELECT auth_version, password_hash FROM projects WHERE public_id = ?").get(id) as {auth_version:number;password_hash:Buffer};
    const changed = service.updateMetadata(result.authorization, 1, { visibility:"public" });
    expect(changed.data.project).toMatchObject({visibility:"public", revision:2});
    expect(changed.data.operation.changedFields).toContain("visibility");
    expect(service.projectReadAccess(id)).toBe("allowed");
    expect(service.getReadonlySnapshot(id)?.data.project.visibility).toBe("public");
    const after = database.prepare("SELECT auth_version, password_hash FROM projects WHERE public_id = ?").get(id) as {auth_version:number;password_hash:Buffer};
    expect(after).toEqual(before);
    expect(() => service.updateMetadata(result.authorization, 1, {visibility:"private"})).toThrow();
    service.updateMetadata(result.authorization, 2, {visibility:"private"});
    expect(service.projectReadAccess(id)).toBe("locked");
  });
});
