import type Database from "better-sqlite3";
import { PublicApiError } from "../http/api-error-core";

/** A context marker is meaningful even when both selections are explicitly empty. */
export function assertScheduleContextExportSupported(db: Database.Database, projectId: number): void {
  if (["project_processes","project_equipment","project_logistics_systems","project_work_areas"].some(owner =>
    Boolean(db.prepare(`SELECT 1 FROM ${owner}_translations tr JOIN ${owner} o ON o.id=tr.owner_id WHERE o.project_id=? LIMIT 1`).get(projectId)))) {
    throw new PublicApiError(409,"DISPLAY_NAME_TRANSLATIONS_EXPORT_UNSUPPORTED",
      "일정 JSON·Excel 형식은 기준정보 표시명 번역을 보존하지 않습니다. Project Copy 또는 Template version 6을 이용해 주세요.");
  }

  if (db.prepare("SELECT 1 FROM project_work_areas WHERE project_id=? UNION ALL SELECT 1 FROM equipment_work_areas WHERE project_id=? UNION ALL SELECT 1 FROM equipment_project_work_areas WHERE project_id=? UNION ALL SELECT 1 FROM task_process_contexts WHERE project_id=? LIMIT 1").get(projectId,projectId,projectId,projectId)) {
    throw new PublicApiError(409,"PROCESS_CONTEXT_EXPORT_UNSUPPORTED",
      "일정 JSON·Excel은 프로젝트 소속 WorkArea·설비 WorkArea와 Task 공정·WorkArea 문맥을 보존하지 않습니다. Project Copy 또는 지원 Template를 사용하세요.");
  }
}
