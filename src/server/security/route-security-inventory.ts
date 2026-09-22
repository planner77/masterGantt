export type RouteSecurityPolicy =
  | "public-read"
  | "origin-and-create-limit"
  | "origin-and-password-limit"
  | "optional-session-read"
  | "origin-and-target-logout"
  | "origin-session-if-match"
  | "origin-if-match-read"
  | "resource-admin-read"
  | "origin-resource-admin-auth"
  | "origin-resource-admin-logout"
  | "origin-resource-admin-if-match"
  | "project-edit-session-read";

export interface RouteSecurityInventoryEntry {
  template: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  policy: RouteSecurityPolicy;
  mutatesState: boolean;
}

export const ROUTE_SECURITY_INVENTORY = Object.freeze([
  { template: "/api/health/live", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/health/ready", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects", method: "POST", policy: "origin-and-create-limit", mutatesState: true },
  { template: "/api/projects/{publicId}", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/copy", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/exports/excel", method: "POST", policy: "origin-if-match-read", mutatesState: false },
  { template: "/api/projects/{publicId}/edit-sessions", method: "POST", policy: "origin-and-password-limit", mutatesState: true },
  { template: "/api/projects/{publicId}/edit-sessions/current", method: "GET", policy: "optional-session-read", mutatesState: false },
  { template: "/api/projects/{publicId}/edit-sessions/current", method: "DELETE", policy: "origin-and-target-logout", mutatesState: true },
  { template: "/api/projects/{publicId}/edit-password", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/links", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/links/{linkId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/task-commands", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/resource-catalog/admin-sessions", method: "POST", policy: "origin-resource-admin-auth", mutatesState: true },
  { template: "/api/resource-catalog/admin-sessions", method: "DELETE", policy: "origin-resource-admin-logout", mutatesState: true },
  { template: "/api/resources", method: "GET", policy: "resource-admin-read", mutatesState: false },
  { template: "/api/resources", method: "POST", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resources/{resourceId}", method: "PATCH", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resource-groups", method: "GET", policy: "resource-admin-read", mutatesState: false },
  { template: "/api/resource-groups", method: "POST", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resource-groups/{groupId}", method: "PATCH", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resource-groups/{groupId}/members", method: "PUT", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/assignment-targets", method: "GET", policy: "project-edit-session-read", mutatesState: false },
  { template: "/api/projects/{publicId}/assigned-targets", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/resource-workload", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/work-calendars/countries", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/work-calendar", method: "GET", policy: "project-edit-session-read", mutatesState: false },
  { template: "/api/projects/{publicId}/work-calendar/preview", method: "POST", policy: "origin-session-if-match", mutatesState: false },
  { template: "/api/projects/{publicId}/work-calendar", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}/assignments", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
] satisfies readonly RouteSecurityInventoryEntry[]);

export const NEXT_AUTOMATIC_METHOD_SECURITY = Object.freeze({
  HEAD: "Framework-generated only for GET semantics; it must remain stateless.",
  OPTIONS: "Framework-generated Allow discovery only; no credentialed CORS headers are emitted.",
});
