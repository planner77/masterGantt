import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { ResourceCatalogRepository } from "../../../src/server/repositories/resource-catalog-repository-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");

describe("Resource developer grade (Issue #288)", () => {
  it("persists the four canonical grades and nullable legacy resources", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const repository = new ResourceCatalogRepository(database);
      const now = "2026-09-30T00:00:00.000Z";
      const grades = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

      for (const [index, developerGrade] of grades.entries()) {
        repository.insertResource({
          publicId: `00000000-0000-4000-8000-00000000000${index + 1}`,
          name: `Developer ${index + 1}`,
          code: `DEV-${index + 1}`,
          description: "",
          developerGrade,
          now,
        });
      }
      repository.insertResource({
        publicId: "00000000-0000-4000-8000-000000000009",
        name: "Legacy resource",
        code: "LEGACY",
        description: "",
        now,
      });

      expect(repository.listResources().map((resource) => resource.developerGrade))
        .toEqual(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT", null]);
    } finally {
      database.close();
    }
  });

  it("rejects non-canonical developer grade values at the database boundary", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const statement = database.prepare(
        `INSERT INTO resources
          (public_id, name, code, description, developer_grade, active, created_at, updated_at)
         VALUES (?, ?, ?, '', ?, 1, ?, ?)`,
      );
      expect(() =>
        statement.run(
          "00000000-0000-4000-8000-000000000010",
          "Invalid grade",
          "INVALID",
          "advanced",
          "2026-09-30T00:00:00.000Z",
          "2026-09-30T00:00:00.000Z",
        ),
      ).toThrow(/CHECK constraint failed/);
      expect(() =>
        statement.run(
          "00000000-0000-4000-8000-000000000011",
          "Empty grade",
          "EMPTY",
          "",
          "2026-09-30T00:00:00.000Z",
          "2026-09-30T00:00:00.000Z",
        ),
      ).toThrow(/CHECK constraint failed/);
    } finally {
      database.close();
    }
  });
});
