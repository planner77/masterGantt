import { join } from "node:path";
import { expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ResourceCatalogService } from "../../../src/server/resources/resource-catalog-service-core";
import { LogisticsTypeCatalogService } from "../../../src/server/logistics/logistics-type-catalog-service-core";
import { ProjectMasterService } from "../../../src/server/project-master/project-master-service-core";
import { ProjectService } from "../../../src/server/projects/project-service-core";

it("Issue #452: each global administrator and project edit session authorize only their own domain", async () => {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db", "migrations") });
  try {
    const options = { clock: () => new Date("2026-10-05T00:00:00.000Z") };
    const services = [new ResourceCatalogService(database, options), new LogisticsTypeCatalogService(database, options), new ProjectMasterService(database, options)];
    const project = new ProjectService(database, options);
    const created = await project.create({ name: "Session isolation fixture", description: "", editPassword: "Test-only1!" });
    const tokens = services.map(service => {
      const session = service.unlockAdmin("Bootstrap-only-16", "Bootstrap-only-16");
      expect(session).toBeDefined();
      return session!.rawToken;
    });
    const publicId = created.response.data.project.publicId;
    expect(project.authorize(publicId, created.rawSessionToken).kind).toBe("authorized");
    for (const [index, service] of services.entries()) {
      expect(service.authorizeAdmin(tokens[index])).toBeTruthy();
      expect(service.authorizeAdmin(created.rawSessionToken)).toBeFalsy();
      for (const [other, token] of tokens.entries()) {
        if (other !== index) expect(service.authorizeAdmin(token)).toBeFalsy();
        expect(project.authorize(publicId, token).kind).toBe("unauthorized");
      }
    }
  } finally {
    database.close();
  }
});
