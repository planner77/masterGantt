import type Database from "better-sqlite3";
import { PublicApiError } from "../http/api-error-core";

/** A context marker is meaningful even when both selections are explicitly empty. */
export function assertScheduleContextExportSupported(db: Database.Database, projectId: number): void {
  if (db.prepare("SELECT 1 FROM equipment_work_areas WHERE project_id=? UNION ALL SELECT 1 FROM task_process_contexts WHERE project_id=? LIMIT 1").get(projectId,projectId)) {
    throw new PublicApiError(409,"PROCESS_CONTEXT_EXPORT_UNSUPPORTED",
      "일정 JSON·Excel은 설비 WorkArea와 Task 공정·WorkArea 문맥을 보존하지 않습니다. Project Copy 또는 지원 Template를 사용하세요.");
  }
}
