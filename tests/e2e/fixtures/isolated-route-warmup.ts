/**
 * Read-only Next development route warm-up plan for disposable E2E servers.
 * A canonical non-existing project ID compiles the route without writing data,
 * authenticating, or creating an edit session.
 *
 * #751 / CI #3030.1: TaskAssignmentEditor reads assigned-targets and then
 * assignment-targets. Cold compilation of the second GET was 4501.785ms
 * within a strict 5000ms assertion window in the failed original trace.
 */
export function isolatedReadOnlyWarmupPaths(missing: string): string[] {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(missing)) {
    throw new Error("Isolated warm-up requires a canonical, non-existing UUIDv4 project ID.");
  }
  const project = "/api/projects/" + missing;
  return [
    "/", "/projects/new", "/api/project-master/catalog",
    "/projects/" + missing,
    "/api/projects", project,
    project + "/edit-sessions",
    project + "/edit-sessions/current",
    project + "/edit-password",
    project + "/tasks",
    project + "/tasks/" + missing,
    // Read-only GET. Warm up both sequential editor dependencies before
    // the timed test body. Never POST/PATCH or use an existing project.
    project + "/assigned-targets",
    project + "/assignment-targets",
  ];
}

export function isolatedWarmupStage(path: string):
  | "next_assigned_targets_warmup"
  | "next_assignment_targets_warmup"
  | null {
  if (/^\/api\/projects\/[^/]+\/assigned-targets$/.test(path)) return "next_assigned_targets_warmup";
  if (/^\/api\/projects\/[^/]+\/assignment-targets$/.test(path)) return "next_assignment_targets_warmup";
  return null;
}
