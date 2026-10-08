import type { ResourceExcelExportOptions, ResourceExcelReportBundle } from "../../contracts/resource-excel-export";
import { ResourceDashboardService } from "../resources/resource-dashboard-service-core";
import type Database from "better-sqlite3";

import type { MilestoneDashboardDto } from "../../contracts/milestone-dashboard";
import type { ProjectSnapshotResponse } from "../../contracts/projects";
import type { ResourceWorkloadResponse } from "../../contracts/resources";
import { PublicApiError } from "../http/api-error-core";
import { MilestoneDashboardService } from "../projects/milestone-dashboard-service-core";
import { TaskFieldProjectService } from "../projects/task-field-project-service";
import { ResourceCatalogRepository } from "../repositories/resource-catalog-repository-core";
import { ResourceWorkloadService } from "../resources/resource-workload-service-core";

export interface ProjectExportSnapshotBundle {
  snapshot: ProjectSnapshotResponse;
  resourceDashboard?: ResourceExcelReportBundle;
  stageDashboard: MilestoneDashboardDto;
  resourceWorkload?: ResourceWorkloadResponse;
}

/** Keeps all report inputs in one SQLite snapshot, including nested service reads. */
export class ProjectExportSnapshotService {
  constructor(private readonly database: Database.Database, private readonly options: {
    clock?: () => Date;
    mdPerMmEnvironment?: string;
  } = {}) {}

  get(publicId: string, includeResourceEffort = false, resourceOptions?: ResourceExcelExportOptions, expectedRevision?: number): ProjectExportSnapshotBundle | undefined {
    return this.database.transaction(() => {
      const now = (this.options.clock ?? (() => new Date()))();
      const clock = () => now;
      const snapshot = new TaskFieldProjectService(this.database, { clock }).getReadonlySnapshot(publicId);
      if (!snapshot) return undefined;
      if (expectedRevision !== undefined && snapshot.data.project.revision !== expectedRevision) throw new PublicApiError(412, "REVISION_MISMATCH", "Project changed. Reload and retry.");
      const stageDashboard = new MilestoneDashboardService(this.database, {
        clock, mdPerMmEnvironment: this.options.mdPerMmEnvironment,
      }).getDashboard(publicId);
      const resourceWorkload = includeResourceEffort
        ? new ResourceWorkloadService(this.database, { clock }).get(publicId, null, null, this.options.mdPerMmEnvironment)
        : undefined;
      const revision = snapshot.data.project.revision;
      const catalogRevision = new ResourceCatalogRepository(this.database).getRevision();
      if (!stageDashboard || (includeResourceEffort && !resourceWorkload)) {
        throw new PublicApiError(500, "CONFIGURATION_ERROR", "The export report is not configured correctly.");
      }
      if (stageDashboard.projectRevision !== revision || stageDashboard.catalogRevision !== catalogRevision
        || (resourceWorkload && (resourceWorkload.data.projectRevision !== revision || resourceWorkload.data.catalogRevision !== catalogRevision))) {
        throw new PublicApiError(412, "REVISION_MISMATCH", "Project or catalog changed. Reload and retry.");
      }
      const resourceDashboard = resourceOptions ? new ResourceDashboardService(this.database, { clock, mdPerMmEnvironment: this.options.mdPerMmEnvironment }).getExcelReport(publicId, resourceOptions) : undefined;
      if (resourceOptions && !resourceDashboard) throw new PublicApiError(500, "CONFIGURATION_ERROR", "Resource report export is not configured.");
      return { snapshot, stageDashboard, ...(resourceDashboard ? { resourceDashboard } : {}), ...(resourceWorkload ? { resourceWorkload } : {}) };
    }).deferred();
  }
}
