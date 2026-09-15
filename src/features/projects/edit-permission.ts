export type ProjectEditPermission = "readonly" | "edit";

export type ParsedEditPermission = Readonly<{
  permission: ProjectEditPermission;
  valid: boolean;
}>;

/**
 * Parse the current edit-session response conservatively.
 *
 * A malformed payload, an invalid timestamp, or an already expired edit grant is
 * never allowed to enable mutation UI. `valid` distinguishes a legitimate
 * readonly response from a response that failed contract validation so callers
 * can notify the user while still failing closed.
 */
export function parseCurrentEditPermission(
  value: unknown,
  nowMilliseconds = Date.now(),
): ParsedEditPermission {
  if (typeof value !== "object" || value === null || !("data" in value)) {
    return { permission: "readonly", valid: false };
  }

  const data = value.data;
  if (typeof data !== "object" || data === null || !("permission" in data)) {
    return { permission: "readonly", valid: false };
  }

  if (data.permission === "readonly") {
    return { permission: "readonly", valid: true };
  }

  if (data.permission !== "edit" || !("expiresAt" in data) || typeof data.expiresAt !== "string") {
    return { permission: "readonly", valid: false };
  }

  const expiresAt = Date.parse(data.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMilliseconds) {
    return { permission: "readonly", valid: false };
  }

  return { permission: "edit", valid: true };
}
