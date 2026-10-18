import type Database from "better-sqlite3";
import type { StageMembership } from "../../domain/milestones/stage-gates";

export class MilestoneMembershipRepository {
  constructor(private readonly database: Database.Database) {}

  list(projectId: number): StageMembership[] {
    return this.database.prepare(`
      SELECT member.public_id AS taskId, milestone.public_id AS milestoneTaskId
      FROM task_milestone_memberships membership
      JOIN tasks member ON member.id = membership.member_task_id AND member.project_id = membership.project_id
      JOIN tasks milestone ON milestone.id = membership.milestone_task_id AND milestone.project_id = membership.project_id
      WHERE membership.project_id = ? ORDER BY member.id
    `).all(projectId) as StageMembership[];
  }

  set(projectId: number, memberTaskId: number, milestoneTaskId: number | null): void {
    if (milestoneTaskId === null) {
      this.database.prepare("DELETE FROM task_milestone_memberships WHERE project_id = ? AND member_task_id = ?").run(projectId, memberTaskId);
    } else {
      this.database.prepare(`INSERT INTO task_milestone_memberships(project_id, member_task_id, milestone_task_id)
        VALUES (?, ?, ?) ON CONFLICT(project_id, member_task_id) DO UPDATE SET milestone_task_id = excluded.milestone_task_id
      `).run(projectId, memberTaskId, milestoneTaskId);
    }
  }
}
