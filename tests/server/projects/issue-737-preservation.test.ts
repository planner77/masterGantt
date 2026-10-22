import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ResourceDashboardService } from "../../../src/server/resources/resource-dashboard-service-core";
import type { WbsViewDimension } from "../../../src/contracts/wbs-dashboard-views";
import { wbsDashboardViewsFixture } from "../../fixtures/wbs-dashboard-views";
import { RESOURCE_DASHBOARD_NOW } from "../../fixtures/resource-dashboard";

// Synthetic, isolated SQLite only. This does not validate production/off-host restore.
function storedRows(database: Database.Database) {
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").pluck().all() as string[];
  return Object.fromEntries(tables.map(name => {
    const quoted = `"${name.replaceAll('"', '""')}"`;
    const rows = database.prepare(`SELECT * FROM ${quoted}`).all();
    return [name, rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))];
  }));
}

function reports(database: Database.Database, publicId: string) {
  const service = new ResourceDashboardService(database, { clock: () => new Date(RESOURCE_DASHBOARD_NOW), mdPerMmEnvironment: "20" });
  return (["process", "equipment", "system", "milestone", "resource"] as WbsViewDimension[]).map(root => {
    const response = service.queryWbsView(publicId, {
      spec: { version: "wbs-view:v1", contextSourceVersion: "explicit-task-context:v1", root, levels: [] },
      filters: { from: "2026-10-05", to: "2026-10-09", asOfDate: "2026-10-12", mdPerMm: 20 },
    });
    expect(response).toBeDefined();
    return response;
  });
}

describe("#737 synthetic full-reference backup, restore and restart", () => {
  it.each(["direct", "target", "mixed"] as const)("preserves every stored identity and five view snapshots for %s data", async mode => {
    const directory = mkdtempSync(join(tmpdir(), "mastergantt-737-"));
    let source: Database.Database | undefined;
    let restored: Database.Database | undefined;
    try {
      const filename = join(directory, "source.sqlite3"), backup = join(directory, "backup.sqlite3");
      const f = wbsDashboardViewsFixture(mode, filename);
      source = f.database;
      const before = storedRows(source);
      const beforeReports = reports(source, f.project.publicId);
      // Read projections must not create a Target, Assignment, reference or revision.
      expect(storedRows(source)).toEqual(before);
      await source.backup(backup);
      source.close(); source = undefined;
      for (let restart = 0; restart < 2; restart++) {
        const opened = openDatabase({ filename: backup, migrationsDirectory: join(process.cwd(), "db/migrations") });
        restored = opened.database;
        expect(opened.migrations.applied).toEqual([]);
        expect(restored.pragma("integrity_check", { simple: true })).toBe("ok");
        expect(restored.pragma("foreign_key_check")).toEqual([]);
        expect(storedRows(restored)).toEqual(before);
        expect(reports(restored, f.project.publicId)).toEqual(beforeReports);
        expect(storedRows(restored)).toEqual(before);
        const targets = restored.prepare("SELECT COUNT(*) FROM logistics_targets WHERE project_id=?").pluck().get(f.project.id);
        expect(targets).toBe(mode === "direct" ? 0 : 2);
        restored.close(); restored = undefined;
      }
    } finally {
      if (source?.open) source.close();
      if (restored?.open) restored.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
