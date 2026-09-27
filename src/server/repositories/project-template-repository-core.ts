import type Database from "better-sqlite3";

export interface ProjectTemplateRecord {
  id: number;
  publicId: string;
  name: string;
  description: string;
  sourceProjectId: number | null;
  sourceProjectPublicId: string | null;
  sourceProjectName: string | null;
  active: number;
  taskCount: number;
  milestoneCount: number;
  contentJson: string;
  createdAt: string;
  updatedAt: string;
}

interface RawTemplateRow {
  id: number;
  public_id: string;
  name: string;
  description: string;
  source_project_id: number | null;
  source_project_public_id: string | null;
  source_project_name: string | null;
  active: number;
  task_count: number;
  milestone_count: number;
  content_json: string;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RawTemplateRow): ProjectTemplateRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    description: row.description,
    sourceProjectId: row.source_project_id,
    sourceProjectPublicId: row.source_project_public_id,
    sourceProjectName: row.source_project_name,
    active: row.active,
    taskCount: row.task_count,
    milestoneCount: row.milestone_count,
    contentJson: row.content_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectTemplateRepository {
  constructor(private readonly database: Database.Database) {}

  listTemplates(options?: { activeOnly?: boolean; query?: string }): ProjectTemplateRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.activeOnly) {
      conditions.push("pt.active = 1");
    }

    if (options?.query && options.query.trim().length > 0) {
      conditions.push("(pt.name LIKE ? OR pt.description LIKE ?)");
      const pattern = `%${options.query.trim()}%`;
      params.push(pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT pt.id, pt.public_id, pt.name, pt.description, pt.source_project_id,
             p.public_id AS source_project_public_id, pt.source_project_name,
             pt.active, pt.task_count, pt.milestone_count, pt.content_json, pt.created_at, pt.updated_at
      FROM project_templates pt
      LEFT JOIN projects p ON p.id = pt.source_project_id
      ${whereClause}
      ORDER BY pt.updated_at DESC, pt.id DESC
    `;

    const rows = this.database.prepare(sql).all(...params) as RawTemplateRow[];
    return rows.map(mapRow);
  }

  findTemplateByPublicId(publicId: string): ProjectTemplateRecord | undefined {
    const row = this.database.prepare(`
      SELECT pt.id, pt.public_id, pt.name, pt.description, pt.source_project_id,
             p.public_id AS source_project_public_id, pt.source_project_name,
             pt.active, pt.task_count, pt.milestone_count, pt.content_json, pt.created_at, pt.updated_at
      FROM project_templates pt
      LEFT JOIN projects p ON p.id = pt.source_project_id
      WHERE pt.public_id = ?
    `).get(publicId) as RawTemplateRow | undefined;

    return row ? mapRow(row) : undefined;
  }

  findTemplateById(id: number): ProjectTemplateRecord | undefined {
    const row = this.database.prepare(`
      SELECT pt.id, pt.public_id, pt.name, pt.description, pt.source_project_id,
             p.public_id AS source_project_public_id, pt.source_project_name,
             pt.active, pt.task_count, pt.milestone_count, pt.content_json, pt.created_at, pt.updated_at
      FROM project_templates pt
      LEFT JOIN projects p ON p.id = pt.source_project_id
      WHERE pt.id = ?
    `).get(id) as RawTemplateRow | undefined;

    return row ? mapRow(row) : undefined;
  }

  insertTemplate(input: {
    publicId: string;
    name: string;
    description: string;
    sourceProjectId: number | null;
    sourceProjectName: string | null;
    active: number;
    taskCount: number;
    milestoneCount: number;
    contentJson: string;
    now: string;
  }): ProjectTemplateRecord {
    const result = this.database.prepare(`
      INSERT INTO project_templates (
        public_id, name, description, source_project_id, source_project_name,
        active, task_count, milestone_count, content_json, created_at, updated_at
      ) VALUES (
        @publicId, @name, @description, @sourceProjectId, @sourceProjectName,
        @active, @taskCount, @milestoneCount, @contentJson, @now, @now
      )
    `).run({
      publicId: input.publicId,
      name: input.name,
      description: input.description,
      sourceProjectId: input.sourceProjectId,
      sourceProjectName: input.sourceProjectName,
      active: input.active,
      taskCount: input.taskCount,
      milestoneCount: input.milestoneCount,
      contentJson: input.contentJson,
      now: input.now,
    });

    return this.findTemplateById(Number(result.lastInsertRowid))!;
  }

  updateTemplate(
    id: number,
    input: {
      name?: string;
      description?: string;
      active?: number;
      now: string;
    },
  ): ProjectTemplateRecord | undefined {
    const sets: string[] = ["updated_at = @now"];
    const params: Record<string, unknown> = { id, now: input.now };

    if (input.name !== undefined) {
      sets.push("name = @name");
      params.name = input.name;
    }
    if (input.description !== undefined) {
      sets.push("description = @description");
      params.description = input.description;
    }
    if (input.active !== undefined) {
      sets.push("active = @active");
      params.active = input.active;
    }

    this.database.prepare(`
      UPDATE project_templates
      SET ${sets.join(", ")}
      WHERE id = @id
    `).run(params);

    return this.findTemplateById(id);
  }

  deleteTemplate(id: number): boolean {
    const result = this.database.prepare("DELETE FROM project_templates WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
