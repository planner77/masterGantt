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
