import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { handleCreateLogisticsType } from "../../../src/server/logistics/logistics-type-catalog-handlers-core";
import { LogisticsTypeCatalogService } from "../../../src/server/logistics/logistics-type-catalog-service-core";
import { logisticsCatalogAdminCookieName } from "../../../src/server/security/logistics-catalog-cookie-core";

const migrationsDirectory = join(process.cwd(), "db", "migrations");
const applicationBaseUrl = "https://gantt.example.test";

describe("Logistics type catalog HTTP handlers", () => {
  it("returns 409 for a duplicate stable type code", async () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
    try {
      const service = new LogisticsTypeCatalogService(database, {
        clock: () => new Date("2026-09-30T00:00:00.000Z"),
      });
      const bootstrap = "D".repeat(16);
      const admin = service.unlockAdmin(bootstrap, bootstrap);
      if (!admin) throw new Error("fixture admin session missing");
      service.create("equipment", admin.rawToken, 1, { code: "shuttle", name: "Shuttle" });

      const cookieName = logisticsCatalogAdminCookieName("production", new URL(applicationBaseUrl));
      const request = new Request(`${applicationBaseUrl}/api/logistics-catalog/admin/equipment-types`, {
        method: "POST",
        headers: {
          Origin: applicationBaseUrl,
          Cookie: `${cookieName}=${admin.rawToken}`,
          "Content-Type": "application/json",
          "If-Match": '"2"',
        },
        body: JSON.stringify({ code: "shuttle", name: "Duplicate Shuttle" }),
      });

      const response = await handleCreateLogisticsType(request, "equipment", {
        catalogService: service,
        applicationBaseUrl,
        environment: "production",
        requestId: () => "request-duplicate-type",
      });
      expect(response.status).toBe(409);
      const body = await response.json() as { error: { code: string } };
      expect(body.error.code).toBe("LOGISTICS_CATALOG_CONFLICT");
      expect(service.getCatalog(admin.rawToken).data.revision).toBe(2);
    } finally {
      database.close();
    }
  });
});
