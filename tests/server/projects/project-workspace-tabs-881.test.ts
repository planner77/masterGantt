import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectService, RevisionMismatchError } from "../../../src/server/projects/project-service-core";
import { parseUpdateProjectInput } from "../../../src/server/projects/project-contract";
import type { PasswordHashRecord } from "../../../src/server/security/password-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const hash: PasswordHashRecord = {
  algorithm: "scrypt", salt: Buffer.alloc(16, 1), hash: Buffer.alloc(32, 2),
  n: 32768, r: 8, p: 3, keyLength: 32,
};
const allOn = { issue: true, dashboard: true, master: true };

describe("Issue #881 Project workspace tabs", () => {
  it("rejects partial/unknown/nonboolean/forged project inputs", () => {
    expect(parseUpdateProjectInput({ workspaceTabs: allOn }).success).toBe(true);
    for (const bad of [
      { workspaceTabs: { issue: false } },
      { workspaceTabs: { ...allOn, secret: true } },
      { workspaceTabs: { ...allOn, master: 1 } },
      { workspaceTabs: null },
      { workspaceTabs: allOn, ownerName: "forged" },
    ]) expect(parseUpdateProjectInput(bad).success).toBe(false);
  });

  it("defaults ON, writes only one Project with a valid session and enforces revision CAS", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    const service = new ProjectService(database, {
      clock: () => new Date("2026-11-07T00:00:00.000Z"),
      hashPassword: async () => hash,
    });
    try {
      const first = await service.create({ name: "First", description: "", editPassword: "pass" });
      const second = await service.create({ name: "Second", description: "", editPassword: "pass" });
      const id = first.response.data.project.publicId;
      expect(first.response.data.project.workspaceTabs).toEqual(allOn);
      expect(service.getAuthorizedReadonlySnapshot(id)?.data.project.workspaceTabs).toEqual(allOn);
      const firstAuth = service.authorize(id, first.rawSessionToken);
      const secondAuth = service.authorize(second.response.data.project.publicId, second.rawSessionToken);
      expect(firstAuth.kind).toBe("authorized");
      expect(secondAuth.kind).toBe("authorized");
      if (firstAuth.kind !== "authorized" || secondAuth.kind !== "authorized") throw Error("Auth fixture missing");
      const flags = { issue: false, dashboard: false, master: false };
      const result = service.updateMetadata(firstAuth.authorization, 1, { workspaceTabs: flags });
      expect(result.data.project).toMatchObject({ revision: 2, workspaceTabs: flags });
      expect(result.data.operation.changedFields).toContain("workspaceTabs");
      expect(service.getReadonlySnapshot(second.response.data.project.publicId)?.data.project.workspaceTabs).toEqual(allOn);
      expect(() => service.updateMetadata(firstAuth.authorization, 1, { workspaceTabs: allOn })).toThrow(RevisionMismatchError);
      expect(() => service.updateMetadata(secondAuth.authorization, 2, { workspaceTabs: allOn })).toThrow();
      const persisted = database.prepare("SELECT workspace_issue_visible, workspace_dashboard_visible, workspace_master_visible FROM projects WHERE public_id = ?").get(id) as Record<string, number>;
      expect(persisted).toEqual({ workspace_issue_visible: 0, workspace_dashboard_visible: 0, workspace_master_visible: 0 });
      expect(service.updateMetadata(firstAuth.authorization, 2, { workspaceTabs: allOn }).data.project.workspaceTabs).toEqual(allOn);
    } finally { database.close(); }
  });
});
