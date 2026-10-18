import type Database from "better-sqlite3";
import type { ProcessCatalogKind, ProjectProcessMappingDto } from "../../contracts/process-catalog";
export const PROCESS_CATALOG_TABLES: Record<ProcessCatalogKind, string> = {
  types: "process_types", standards: "product_standard_processes", occurrences: "site_product_processes", workAreas: "work_areas"
};
export interface ProcessCatalogRecord {
  id: number;
  public_id: string;
  code: string;
  name: string;
  active: number;
  sort_order: number;
  usage_count: number;
  product_id?: number;
  process_type_id?: number;
  business_unit_id?: number;
  site_entity_id?: number;
  standard_process_id?: number | null;
  occurrence_id?: number;
  product_public_id?: string;
  type_public_id?: string;
  business_unit_public_id?: string;
  site_public_id?: string;
  standard_public_id?: string | null;
  occurrence_public_id?: string;
}
export interface InternalProcessTriple {
  businessUnitId: number;
  productId: number;
  siteEntityId: number;
}
export interface ProcessMappingRecord {
  project_id: number;
  project_process_id: number;
  occurrence_id: number;
  work_area_id: number | null;
  business_unit_id: number;
  product_id: number;
  site_entity_id: number;
}
const columns: Record<ProcessCatalogKind, readonly string[]> = {
  types: ["code", "name", "active", "sort_order"],
  standards: ["code", "name", "active", "sort_order", "product_id", "process_type_id"],
  occurrences: ["code", "name", "active", "sort_order", "business_unit_id", "product_id", "site_entity_id", "process_type_id", "standard_process_id"],
  workAreas: ["code", "name", "active", "sort_order", "occurrence_id"],
};
const usage: Record<ProcessCatalogKind, string> = {
  types: "(SELECT COUNT(*) FROM product_standard_processes WHERE process_type_id=t.id)+(SELECT COUNT(*) FROM site_product_processes WHERE process_type_id=t.id)",
  standards: "(SELECT COUNT(*) FROM site_product_processes WHERE standard_process_id=t.id)",
  occurrences: "(SELECT COUNT(*) FROM work_areas WHERE occurrence_id=t.id)+(SELECT COUNT(*) FROM project_process_occurrence_mappings WHERE occurrence_id=t.id)",
  workAreas: "(SELECT COUNT(*) FROM project_process_occurrence_mappings WHERE work_area_id=t.id)",
};
const extra: Record<ProcessCatalogKind, string> = {
  types: "",
  standards: ",p.public_id product_public_id,pt.public_id type_public_id",
  occurrences: ",p.public_id product_public_id,pt.public_id type_public_id,b.public_id business_unit_public_id,s.public_id site_public_id,st.public_id standard_public_id",
  workAreas: ",o.public_id occurrence_public_id",
};
const joins: Record<ProcessCatalogKind, string> = {
  types: "",
  standards: "JOIN project_master_items p ON p.id=t.product_id JOIN process_types pt ON pt.id=t.process_type_id",
  occurrences: "JOIN project_master_items p ON p.id=t.product_id JOIN process_types pt ON pt.id=t.process_type_id JOIN project_master_items b ON b.id=t.business_unit_id JOIN project_master_items s ON s.id=t.site_entity_id LEFT JOIN product_standard_processes st ON st.id=t.standard_process_id",
  workAreas: "JOIN site_product_processes o ON o.id=t.occurrence_id",
};
/** All SQL identifiers come from fixed maps; caller values remain bound parameters. */
export class ProcessCatalogRepository {
  constructor(private readonly database: Database.Database) {
  }
  revision(): number {
    return this.database.prepare("SELECT revision FROM process_catalog_state WHERE id=1").pluck().get() as number;
  }
  advance(expected: number, now: string): boolean {
    return this.database.prepare("UPDATE process_catalog_state SET revision=revision+1,updated_at=? WHERE id=1 AND revision=?").run(now, expected).changes === 1;
  }
  list(kind: ProcessCatalogKind, options: {
    limit: number;
    search?: string;
    active?: boolean;
    productId?: number;
    triple?: InternalProcessTriple;
  }): ProcessCatalogRecord[] {
    const where: string[] = [], values: Array<string | number> = [];
    if (options.search) {
      where.push("(instr(lower(t.code),lower(?))>0 OR instr(lower(t.name),lower(?))>0)");
      values.push(options.search, options.search);
    }
    if (options.active !== undefined) {
      where.push("t.active=?");
      values.push(options.active ? 1 : 0);
    }
    if (options.productId !== undefined && kind === "standards") {
      where.push("t.product_id=?");
      values.push(options.productId);
    }
    if (options.productId !== undefined && kind === "types") {
      where.push("(EXISTS(SELECT 1 FROM product_standard_processes ps WHERE ps.process_type_id=t.id AND ps.product_id=?) OR EXISTS(SELECT 1 FROM site_product_processes sp WHERE sp.process_type_id=t.id AND sp.business_unit_id=? AND sp.product_id=? AND sp.site_entity_id=?))");
      values.push(options.productId, options.triple?.businessUnitId ?? -1, options.productId, options.triple?.siteEntityId ?? -1);
    }
    if (options.triple && (kind === "occurrences" || kind === "workAreas")) {
      const alias = kind === "workAreas" ? "o" : "t";
      where.push(`${alias}.business_unit_id=? AND ${alias}.product_id=? AND ${alias}.site_entity_id=?`);
      values.push(options.triple.businessUnitId, options.triple.productId, options.triple.siteEntityId);
    }
    values.push(options.limit + 1);
    return this.database.prepare(`SELECT t.*${extra[kind]},${usage[kind]} usage_count FROM ${PROCESS_CATALOG_TABLES[kind]} t ${joins[kind]} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY t.sort_order,lower(t.name),t.code,t.public_id LIMIT ?`).all(...values) as ProcessCatalogRecord[];
  }
  find(kind: ProcessCatalogKind, publicId: string): ProcessCatalogRecord | undefined {
    return this.database.prepare(`SELECT t.*${extra[kind]},${usage[kind]} usage_count FROM ${PROCESS_CATALOG_TABLES[kind]} t ${joins[kind]} WHERE t.public_id=?`).get(publicId) as ProcessCatalogRecord | undefined;
  }
  insert(kind: ProcessCatalogKind, publicId: string, values: Record<string, string | number | null>, now: string): void {
    const fields = columns[kind];
    this.database.prepare(`INSERT INTO ${PROCESS_CATALOG_TABLES[kind]}(public_id,${fields.join(",")},created_at,updated_at) VALUES(${Array(fields.length + 3).fill("?").join(",")})`).run(publicId, ...fields.map((key) => values[key]), now, now);
  }
  update(kind: ProcessCatalogKind, id: number, values: Record<string, string | number | null>, now: string): void {
    const fields = columns[kind].filter((key) => key in values);
    this.database.prepare(`UPDATE ${PROCESS_CATALOG_TABLES[kind]} SET ${fields.map((key) => `${key}=?`).join(",")},updated_at=? WHERE id=?`).run(...fields.map((key) => values[key]), now, id);
  }
  remove(kind: ProcessCatalogKind, id: number): void {
    this.database.prepare(`DELETE FROM ${PROCESS_CATALOG_TABLES[kind]} WHERE id=?`).run(id);
  }
  mapping(projectId: number, processId: number): ProcessMappingRecord | undefined {
    return this.database.prepare("SELECT * FROM project_process_occurrence_mappings WHERE project_id=? AND project_process_id=?").get(projectId, processId) as ProcessMappingRecord | undefined;
  }
  hasMappings(projectId: number): boolean {
    return Boolean(this.database.prepare("SELECT 1 FROM project_process_occurrence_mappings WHERE project_id=? LIMIT 1").get(projectId));
  }
  rawMappings(projectId: number): ProcessMappingRecord[] {
    return this.database.prepare("SELECT * FROM project_process_occurrence_mappings WHERE project_id=? ORDER BY project_process_id").all(projectId) as ProcessMappingRecord[];
  }
  insertCopiedMapping(projectId: number, processId: number, record: ProcessMappingRecord, now: string): void {
    this.database.prepare("INSERT INTO project_process_occurrence_mappings(project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,work_area_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(projectId, processId, record.occurrence_id, record.business_unit_id, record.product_id, record.site_entity_id, record.work_area_id, now, now);
  }
  standardIdentity(id: number): {
    product_id: number;
    process_type_id: number;
  } | undefined {
    return this.database.prepare("SELECT product_id,process_type_id FROM product_standard_processes WHERE id=?").get(id) as {
      product_id: number;
      process_type_id: number;
    } | undefined;
  }
  occurrenceForStandard(triple: InternalProcessTriple, standardId: number): ProcessCatalogRecord | undefined {
    const row = this.database.prepare("SELECT public_id FROM site_product_processes WHERE business_unit_id=? AND product_id=? AND site_entity_id=? AND standard_process_id=?").get(triple.businessUnitId, triple.productId, triple.siteEntityId, standardId) as {
      public_id: string;
    } | undefined;
    return row ? this.find("occurrences", row.public_id) : undefined;
  }
  mappings(projectId: number, limit: number): ProjectProcessMappingDto[] {
    return this.database.prepare(`SELECT pp.public_id processId,o.public_id occurrenceId,w.public_id workAreaId,(pp.active=1 AND o.active=1 AND pt.active=1 AND b.active=1 AND p.active=1 AND s.active=1 AND (st.id IS NULL OR st.active=1) AND (w.id IS NULL OR w.active=1)) active FROM project_process_occurrence_mappings m JOIN project_processes pp ON pp.project_id=m.project_id AND pp.id=m.project_process_id JOIN site_product_processes o ON o.id=m.occurrence_id JOIN process_types pt ON pt.id=o.process_type_id JOIN project_master_items b ON b.id=o.business_unit_id JOIN project_master_items p ON p.id=o.product_id JOIN project_master_items s ON s.id=o.site_entity_id LEFT JOIN product_standard_processes st ON st.id=o.standard_process_id LEFT JOIN work_areas w ON w.id=m.work_area_id WHERE m.project_id=? ORDER BY pp.sort_order,pp.code,pp.public_id LIMIT ?`).all(projectId, limit + 1).map((row) => {
      const value = row as Omit<ProjectProcessMappingDto, "active"> & {
        active: number;
      };
      return {
        ...value, active: value.active === 1
      };
    });
  }
  setMapping(projectId: number, processId: number, occurrence: ProcessCatalogRecord | null, workArea: ProcessCatalogRecord | null, now: string): void {
    if (!occurrence) {
      this.database.prepare("DELETE FROM project_process_occurrence_mappings WHERE project_id=? AND project_process_id=?").run(projectId, processId);
      return;
    }
    this.database.prepare(`INSERT INTO project_process_occurrence_mappings(project_id,project_process_id,occurrence_id,business_unit_id,product_id,site_entity_id,work_area_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,project_process_id) DO UPDATE SET occurrence_id=excluded.occurrence_id,business_unit_id=excluded.business_unit_id,product_id=excluded.product_id,site_entity_id=excluded.site_entity_id,work_area_id=excluded.work_area_id,updated_at=excluded.updated_at`).run(projectId, processId, occurrence.id, occurrence.business_unit_id, occurrence.product_id, occurrence.site_entity_id, workArea?.id ?? null, now, now);
  }
}
