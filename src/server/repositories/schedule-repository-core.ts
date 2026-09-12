import type Database from "better-sqlite3";

export interface TaskRecord {
  id: number;
  projectId: number;
  externalId: string;
  publicId: string;
  name: string;
  type: "task" | "summary" | "milestone";
  scheduleMode: "auto" | "manual";
  requestedStart: string | null;
  startDate: string;
  endDate: string;
  duration: number;
  progress: number;
  parentId: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinkRecord {
  id: number;
  publicId: string;
  projectId: number;
  predecessorTaskId: number;
  successorTaskId: number;
  type: "FS";
  lag: 0;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayRecord {
  id: number;
  projectId: number;
  holidayDate: string;
  name: string | null;
  createdAt: string;
}

export interface NewTaskRecord {
  projectId: number;
  externalId: string;
  publicId: string;
  name: string;
  type: "task" | "milestone";
  scheduleMode: "auto" | "manual";
  requestedStart: string;
  startDate: string;
  endDate: string;
  duration: number;
  progress: number;
  parentId: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type UpdatedTaskRecord = Omit<
  NewTaskRecord,
  "projectId" | "externalId" | "publicId" | "parentId" | "sortOrder" | "createdAt"
>;

export interface NewLinkRecord {
  publicId: string;
  projectId: number;
  predecessorTaskId: number;
  successorTaskId: number;
  type: "FS";
  lag: 0;
  createdAt: string;
  updatedAt: string;
}

export type UpdatedLinkRecord = Pick<
  NewLinkRecord,
  "predecessorTaskId" | "successorTaskId" | "type" | "lag" | "updatedAt"
>;

type TaskRow = {
  id: number;
  project_id: number;
  external_id: string;
  public_id: string;
  name: string;
  type: TaskRecord["type"];
  schedule_mode: TaskRecord["scheduleMode"];
  requested_start: string | null;
  start_date: string;
  end_date: string;
  duration: number;
  progress: number;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type LinkRow = {
  id: number;
  public_id: string;
  project_id: number;
  predecessor_task_id: number;
  successor_task_id: number;
  type: "FS";
  lag: 0;
  created_at: string;
  updated_at: string;
};

type HolidayRow = {
  id: number;
  project_id: number;
  holiday_date: string;
  name: string | null;
  created_at: string;
};

function mapTask(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    externalId: row.external_id,
    publicId: row.public_id,
    name: row.name,
    type: row.type,
    scheduleMode: row.schedule_mode,
    requestedStart: row.requested_start,
    startDate: row.start_date,
    endDate: row.end_date,
    duration: row.duration,
    progress: row.progress,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLink(row: LinkRow): LinkRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    projectId: row.project_id,
    predecessorTaskId: row.predecessor_task_id,
    successorTaskId: row.successor_task_id,
    type: row.type,
    lag: row.lag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHoliday(row: HolidayRow): HolidayRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    holidayDate: row.holiday_date,
    name: row.name,
    createdAt: row.created_at,
  };
}

export class ScheduleRepository {
  constructor(private readonly database: Database.Database) {}

  listTasks(projectId: number): TaskRecord[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM tasks
          WHERE project_id = ?
          ORDER BY parent_id IS NOT NULL, parent_id, sort_order, id
        `,
      )
      .all(projectId) as TaskRow[];

    return rows.map(mapTask);
  }

  findTaskByPublicId(
    projectId: number,
    taskPublicId: string,
  ): TaskRecord | undefined {
    const row = this.database
      .prepare("SELECT * FROM tasks WHERE project_id = ? AND public_id = ?")
      .get(projectId, taskPublicId) as TaskRow | undefined;

    return row ? mapTask(row) : undefined;
  }

  findTaskByExternalId(
    projectId: number,
    externalId: string,
  ): TaskRecord | undefined {
    const row = this.database
      .prepare("SELECT * FROM tasks WHERE project_id = ? AND external_id = ?")
      .get(projectId, externalId) as TaskRow | undefined;
    return row ? mapTask(row) : undefined;
  }

  taskPublicIdExists(taskPublicId: string): boolean {
    return this.database
      .prepare("SELECT 1 FROM tasks WHERE public_id = ?")
      .pluck()
      .get(taskPublicId) === 1;
  }

  countTasks(projectId: number): number {
    return this.database
      .prepare("SELECT count(*) FROM tasks WHERE project_id = ?")
      .pluck()
      .get(projectId) as number;
  }

  nextRootSortOrder(projectId: number): number {
    return this.nextSiblingSortOrder(projectId, null);
  }

  nextSiblingSortOrder(projectId: number, parentId: number | null): number {
    return this.database
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks WHERE project_id = ? AND parent_id IS ?",
      )
      .pluck()
      .get(projectId, parentId) as number;
  }

  insertTask(task: NewTaskRecord): TaskRecord {
    const result = this.database.prepare(
      `INSERT INTO tasks (
        project_id, external_id, public_id, name, type, schedule_mode,
        requested_start, start_date, end_date, duration, progress,
        parent_id, sort_order, created_at, updated_at
      ) VALUES (
        @projectId, @externalId, @publicId, @name, @type, @scheduleMode,
        @requestedStart, @startDate, @endDate, @duration, @progress,
        @parentId, @sortOrder, @createdAt, @updatedAt
      )`,
    ).run(task);
    const row = this.database.prepare("SELECT * FROM tasks WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as TaskRow | undefined;
    if (!row) throw new Error("Inserted task could not be read back.");
    return mapTask(row);
  }

  updateTask(
    projectId: number,
    taskPublicId: string,
    task: UpdatedTaskRecord,
  ): TaskRecord | undefined {
    const result = this.database.prepare(
      `UPDATE tasks
       SET name = @name,
           type = @type,
           schedule_mode = @scheduleMode,
           requested_start = @requestedStart,
           start_date = @startDate,
           end_date = @endDate,
           duration = @duration,
           progress = @progress,
           updated_at = @updatedAt
       WHERE project_id = @projectId AND public_id = @taskPublicId`,
    ).run({ ...task, projectId, taskPublicId });
    return result.changes === 1
      ? this.findTaskByPublicId(projectId, taskPublicId)
      : undefined;
  }

  renameTask(
    projectId: number,
    taskPublicId: string,
    name: string,
    updatedAt: string,
  ): TaskRecord | undefined {
    const result = this.database.prepare(
      `UPDATE tasks
       SET name = ?, updated_at = ?
       WHERE project_id = ? AND public_id = ?`,
    ).run(name, updatedAt, projectId, taskPublicId);
    return result.changes === 1
      ? this.findTaskByPublicId(projectId, taskPublicId)
      : undefined;
  }

  convertTaskToSummary(
    projectId: number,
    taskPublicId: string,
    updatedAt: string,
  ): boolean {
    return this.database.prepare(
      `UPDATE tasks
       SET type = 'summary',
           schedule_mode = 'auto',
           requested_start = NULL,
           updated_at = ?
       WHERE project_id = ? AND public_id = ? AND type = 'task'`,
    ).run(updatedAt, projectId, taskPublicId).changes === 1;
  }

  updateSummarySchedule(
    projectId: number,
    taskPublicId: string,
    schedule: {
      startDate: string;
      endDate: string;
      duration: number;
      progress: number;
      updatedAt: string;
    },
  ): boolean {
    return this.database.prepare(
      `UPDATE tasks
       SET schedule_mode = 'auto',
           requested_start = NULL,
           start_date = @startDate,
           end_date = @endDate,
           duration = @duration,
           progress = @progress,
           updated_at = @updatedAt
       WHERE project_id = @projectId
         AND public_id = @taskPublicId
         AND type = 'summary'`,
    ).run({ ...schedule, projectId, taskPublicId }).changes === 1;
  }

  deleteTask(projectId: number, taskPublicId: string): boolean {
    return this.database
      .prepare("DELETE FROM tasks WHERE project_id = ? AND public_id = ?")
      .run(projectId, taskPublicId).changes === 1;
  }

  listLinks(projectId: number): LinkRecord[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM links
          WHERE project_id = ?
          ORDER BY id
        `,
      )
      .all(projectId) as LinkRow[];

    return rows.map(mapLink);
  }

  findLinkByPublicId(
    projectId: number,
    linkPublicId: string,
  ): LinkRecord | undefined {
    const row = this.database
      .prepare("SELECT * FROM links WHERE project_id = ? AND public_id = ?")
      .get(projectId, linkPublicId) as LinkRow | undefined;
    return row ? mapLink(row) : undefined;
  }

  listIncidentLinks(projectId: number, taskId: number): LinkRecord[] {
    const rows = this.database.prepare(
      `SELECT * FROM links
       WHERE project_id = ?
         AND (predecessor_task_id = ? OR successor_task_id = ?)
       ORDER BY id`,
    ).all(projectId, taskId, taskId) as LinkRow[];
    return rows.map(mapLink);
  }

  insertLink(link: NewLinkRecord): LinkRecord {
    const result = this.database.prepare(
      `INSERT INTO links (
        public_id, project_id, predecessor_task_id, successor_task_id,
        type, lag, created_at, updated_at
      ) VALUES (
        @publicId, @projectId, @predecessorTaskId, @successorTaskId,
        @type, @lag, @createdAt, @updatedAt
      )`,
    ).run(link);
    const row = this.database.prepare("SELECT * FROM links WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as LinkRow | undefined;
    if (!row) throw new Error("Inserted link could not be read back.");
    return mapLink(row);
  }

  updateLink(
    projectId: number,
    linkPublicId: string,
    link: UpdatedLinkRecord,
  ): LinkRecord | undefined {
    const result = this.database.prepare(
      `UPDATE links
       SET predecessor_task_id = @predecessorTaskId,
           successor_task_id = @successorTaskId,
           type = @type,
           lag = @lag,
           updated_at = @updatedAt
       WHERE project_id = @projectId AND public_id = @linkPublicId`,
    ).run({ ...link, projectId, linkPublicId });
    return result.changes === 1
      ? this.findLinkByPublicId(projectId, linkPublicId)
      : undefined;
  }

  deleteLink(projectId: number, linkPublicId: string): boolean {
    return this.database
      .prepare("DELETE FROM links WHERE project_id = ? AND public_id = ?")
      .run(projectId, linkPublicId).changes === 1;
  }

  listHolidays(projectId: number): HolidayRecord[] {
    const rows = this.database
      .prepare(
        `
          SELECT *
          FROM project_holidays
          WHERE project_id = ?
          ORDER BY holiday_date, id
        `,
      )
      .all(projectId) as HolidayRow[];

    return rows.map(mapHoliday);
  }
}
