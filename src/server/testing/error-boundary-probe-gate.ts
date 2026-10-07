import "server-only";

export function isE2eErrorBoundaryProbeEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_ERROR_BOUNDARY_PROBE === "true"
  );
}
