export type RouteSecurityPolicy =
  | "public-read"
  | "origin-and-create-limit"
  | "origin-and-password-limit"
  | "optional-session-read"
  | "origin-and-target-logout"
  | "origin-session-if-match";

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
  { template: "/api/projects/{publicId}/edit-sessions", method: "POST", policy: "origin-and-password-limit", mutatesState: true },
  { template: "/api/projects/{publicId}/edit-sessions/current", method: "GET", policy: "optional-session-read", mutatesState: false },
  { template: "/api/projects/{publicId}/edit-sessions/current", method: "DELETE", policy: "origin-and-target-logout", mutatesState: true },
  { template: "/api/projects/{publicId}/edit-password", method: "PUT", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks", method: "POST", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
  { template: "/api/projects/{publicId}/tasks/{taskId}", method: "DELETE", policy: "origin-session-if-match", mutatesState: true },
] satisfies readonly RouteSecurityInventoryEntry[]);

export const NEXT_AUTOMATIC_METHOD_SECURITY = Object.freeze({
  HEAD: "Framework-generated only for GET semantics; it must remain stateless.",
  OPTIONS: "Framework-generated Allow discovery only; no credentialed CORS headers are emitted.",
});
