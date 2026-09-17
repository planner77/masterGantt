import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";

const migrationsDirectory = join(process.cwd(), "db", "migrations");

describe("Issue #54 project owner", () => {
  it("persists owner metadata and returns it from create, list, and readonly snapshot", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    const service = new TaskFieldProjectService(database);
    try {
      const created = await service.create({
        name: "Owner project",
        description: "owner regression",
        ownerName: "Production Engineering",
        editPassword: "owner-regression-password",
      });
      const publicId = created.response.data.project.publicId;

      expect(created.response.data.project.ownerName).toBe("Production Engineering");
      expect(service.listProjects().data.projects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ publicId, ownerName: "Production Engineering" }),
        ]),
      );
      expect(service.getReadonlySnapshot(publicId)?.data.project.ownerName)
        .toBe("Production Engineering");
      expect(
        database.prepare("SELECT owner_name FROM projects WHERE public_id = ?").pluck().get(publicId),
      ).toBe("Production Engineering");
    } finally {
      database.close();
    }
  });

  it("keeps pre-Issue-54 compatible projects readable with a null owner", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    const service = new TaskFieldProjectService(database);
    try {
      const created = await service.create({
        name: "Legacy compatible project",
        description: "",
        editPassword: "legacy-compatible-password",
      });
      const publicId = created.response.data.project.publicId;

      expect(created.response.data.project.ownerName).toBeNull();
      expect(service.listProjects().data.projects.find((project) => project.publicId === publicId)?.ownerName)
        .toBeNull();
      expect(service.getReadonlySnapshot(publicId)?.data.project.ownerName).toBeNull();
    } finally {
      database.close();
    }
  });
});
