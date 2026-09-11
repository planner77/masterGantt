export type RouteSecurityPolicy =
  | "public-read"
  | "discovery-disabled"
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

/**
 * Source-of-truth inventory for explicitly exported Route Handler methods.
 * Next may synthesize HEAD for GET and OPTIONS for Allow discovery. Those
 * automatic methods are treated as stateless and never enable credentialed
 * cross-origin access.
 */
export const ROUTE_SECURITY_INVENTORY = Object.freeze([
  { template: "/api/health/live", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects", method: "GET", policy: "discovery-disabled", mutatesState: false },
  { template: "/api/projects", method: "POST", policy: "origin-and-create-limit", mutatesState: true },
  { template: "/api/projects/{publicId}", method: "GET", policy: "public-read", mutatesState: false },
  { template: "/api/projects/{publicId}", method: "PATCH", policy: "origin-session-if-match", mutatesState: true },
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
