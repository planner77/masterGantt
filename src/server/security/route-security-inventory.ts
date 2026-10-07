export type RouteSecurityPolicy =
  | "public-read"
  | "origin-and-create-limit"
  | "origin-and-password-limit"
  | "optional-session-read"
  | "origin-and-target-logout"
  | "origin-session"
  | "origin-session-if-match"
  | "origin-if-match-read"
  | "resource-admin-read"
  | "origin-resource-admin-auth"
  | "origin-resource-admin-logout"
  | "origin-resource-admin-password"
  | "origin-resource-admin-if-match"
  | "project-edit-session-read"
  | "logistics-catalog-read"
  | "logistics-admin-read"
  | "origin-logistics-admin-auth"
  | "origin-logistics-admin-logout"
  | "origin-logistics-admin-password"
  | "origin-logistics-admin-if-match"
  | "project-master-catalog-read"
  | "project-master-admin-read"
  | "origin-project-master-admin-auth"
  | "origin-project-master-admin-logout"
  | "origin-project-master-admin-password"
  | "origin-project-master-admin-if-match";

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
  { template: "/api/project-master/catalog", method: "GET", policy: "project-master-catalog-read", mutatesState: false },
  { template: "/api/project-master/admin/items", method: "GET", policy: "project-master-admin-read", mutatesState: false },
  { template: "/api/project-master/admin/items", method: "POST", policy: "origin-project-master-admin-if-match", mutatesState: true },
  { template: "/api/project-master/admin/items/{itemId}", method: "PATCH", policy: "origin-project-master-admin-if-match", mutatesState: true },
  { template: "/api/project-master/admin/relations", method: "POST", policy: "origin-project-master-admin-if-match", mutatesState: true },
  { template: "/api/project-master/admin/relations", method: "DELETE", policy: "origin-project-master-admin-if-match", mutatesState: true },
  { template: "/api/project-master/admin-sessions", method: "POST", policy: "origin-project-master-admin-auth", mutatesState: true },
  { template: "/api/project-master/admin-sessions", method: "DELETE", policy: "origin-project-master-admin-logout", mutatesState: true },
  { template: "/api/project-master/admin-password", method: "PUT", policy: "origin-project-master-admin-password", mutatesState: true },
  { template: "/api/project-templates", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/project-templates", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/project-templates/{templateId}", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/project-templates/{templateId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/project-templates/{templateId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/project-templates/{templateId}/duplicate", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/project-templates/{templateId}/instantiate", method: "POST", policy: "origin-and-create-limit", mutatesState: true },
  { template: "/api/projects/{publicId}", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/copy", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/exports/json", method: "POST", policy: "origin-if-match-read", mutatesState: false },
  { template: "/api/projects/{publicId}/exports/excel", method: "POST", policy: "origin-if-match-read", mutatesState: false },
  { template: "/api/projects/{publicId}/exports/gantt-svg", method: "POST", policy: "origin-if-match-read", mutatesState: false },
  { template: "/api/projects/{publicId}/imports/preview", method: "POST", policy: "origin-session", mutatesState: false },
  { template: "/api/projects/{publicId}/imports", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/edit-sessions", method: "POST", policy: "origin-and-password-limit", mutatesState: true },
  { template: "/api/projects/{publicId}/edit-sessions/current", method: "GET", policy: "optional-session-read", mutatesState: false },
  { template: "/api/projects/{publicId}/edit-sessions/current", method: "DELETE", policy: "origin-and-target-logout", mutatesState: true },
  { template: "/api/projects/{publicId}/edit-password", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/milestone-memberships", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/milestone-dashboard", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/tasks", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/links", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/links/{linkId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/links/{linkId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/task-commands", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/resource-catalog/admin-sessions", method: "POST", policy: "origin-resource-admin-auth", mutatesState: true },
  { template: "/api/resource-catalog/admin-sessions", method: "DELETE", policy: "origin-resource-admin-logout", mutatesState: true },
  { template: "/api/resource-catalog/admin-password", method: "PUT", policy: "origin-resource-admin-password", mutatesState: true },
  { template: "/api/resources", method: "GET", policy: "resource-admin-read", mutatesState: false },
  { template: "/api/resources", method: "POST", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resources/{resourceId}", method: "PATCH", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resources/{resourceId}", method: "DELETE", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resource-groups", method: "GET", policy: "resource-admin-read", mutatesState: false },
  { template: "/api/resource-groups", method: "POST", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resource-groups/{groupId}", method: "PATCH", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resource-groups/{groupId}", method: "DELETE", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/resource-groups/{groupId}/members", method: "PUT", policy: "origin-resource-admin-if-match", mutatesState: true },
  { template: "/api/logistics-catalog/types", method: "GET", policy: "logistics-catalog-read", mutatesState: false },
  { template: "/api/logistics-catalog/admin-sessions", method: "POST", policy: "origin-logistics-admin-auth", mutatesState: true },
  { template: "/api/logistics-catalog/admin-sessions", method: "DELETE", policy: "origin-logistics-admin-logout", mutatesState: true },
  { template: "/api/logistics-catalog/admin-password", method: "PUT", policy: "origin-logistics-admin-password", mutatesState: true },
  { template: "/api/logistics-catalog/admin/equipment-types", method: "GET", policy: "logistics-admin-read", mutatesState: false },
  { template: "/api/logistics-catalog/admin/equipment-types", method: "POST", policy: "origin-logistics-admin-if-match", mutatesState: true },
  { template: "/api/logistics-catalog/admin/equipment-types/{code}", method: "PATCH", policy: "origin-logistics-admin-if-match", mutatesState: true },
  { template: "/api/logistics-catalog/admin/system-types", method: "GET", policy: "logistics-admin-read", mutatesState: false },
  { template: "/api/logistics-catalog/admin/system-types", method: "POST", policy: "origin-logistics-admin-if-match", mutatesState: true },
  { template: "/api/logistics-catalog/admin/system-types/{code}", method: "PATCH", policy: "origin-logistics-admin-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/assignment-targets", method: "GET", policy: "project-edit-session-read", mutatesState: false },
  { template: "/api/projects/{publicId}/assigned-targets", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/resource-dashboard", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/resource-dashboard/details", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/resource-workload", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/work-calendars/countries", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/work-calendar", method: "GET", policy: "project-edit-session-read", mutatesState: false },
  { template: "/api/projects/{publicId}/work-calendar/preview", method: "POST", policy: "origin-session-if-match", mutatesState: false },
  { template: "/api/projects/{publicId}/work-calendar", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}/assignments", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/logistics/processes", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/processes/{processId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/processes/{processId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/equipment", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/equipment/{equipmentId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/equipment/{equipmentId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/equipment/{equipmentId}/systems", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/systems", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/systems/{systemId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/systems/{systemId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/systems/{systemId}/processes", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/systems/{systemId}/children", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/equipment/{equipmentId}/resource-roles", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/systems/{systemId}/resource-roles", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}/logistics-links", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}/tasks/{taskId}/logistics-links", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/logistics/dashboard", method: "GET", policy: "public-read", mutatesState: false },
] satisfies readonly RouteSecurityInventoryEntry[]);

export const NEXT_AUTOMATIC_METHOD_SECURITY = Object.freeze({
  HEAD: "Framework-generated only for GET semantics; it must remain stateless.",
  OPTIONS: "Framework-generated Allow discovery only; no credentialed CORS headers are emitted.",
});
