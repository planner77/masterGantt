import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openDatabase } from "../../../src/server/db/core";
import { handleUnlockProjectMasterAdmin } from "../../../src/server/project-master/project-master-handlers-core";
import { ProjectMasterService } from "../../../src/server/project-master/project-master-service-core";
import {
  projectMasterAdminUnlockRateLimiter,
  UNATTRIBUTED_PROJECT_MASTER_ADMIN_RATE_KEY,
} from "../../../src/server/security/rate-limit-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const applicationBaseUrl = "https://gantt.example.test";

afterEach(() => projectMasterAdminUnlockRateLimiter.clear());

describe("Project master administrator HTTP security", () => {
  it("rate-limits administrator login before password KDF work", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const service = new ProjectMasterService(database);
      for (let index = 0; index < 20; index += 1) {
        expect(projectMasterAdminUnlockRateLimiter.consume(UNATTRIBUTED_PROJECT_MASTER_ADMIN_RATE_KEY).allowed).toBe(true);
      }

      const response = await handleUnlockProjectMasterAdmin(
        new Request(`${applicationBaseUrl}/api/project-master/admin-sessions`, {
          method: "POST",
          headers: { Origin: applicationBaseUrl, "Content-Type": "application/json" },
          body: JSON.stringify({ password: "A".repeat(16) }),
        }),
        {
          service,
          applicationBaseUrl,
          environment: "production",
          adminPassword: "A".repeat(16),
          requestId: () => "project-master-rate-limit",
        },
      );

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).not.toBeNull();
      const body = await response.json() as { error: { code: string } };
      expect(body.error.code).toBe("RATE_LIMITED");
      expect(service.adminCredentialConfigured()).toBe(false);
    } finally {
      database.close();
    }
  });
});
