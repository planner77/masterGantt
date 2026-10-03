const SCHEDULE_FIELDS = new Set(["start", "duration", "end", "scheduleMode"]);
const METADATA_FIELDS = new Set(["name", "description", "url"]);
const BASELINE_FIELDS = new Set(["baseline", "baselineStart", "baselineDuration", "baselineEnd"]);

/** Classifies supplied fields only; validation remains the strict API contract's responsibility. */
export function classifyTaskPatch(input: object) {
  const fields = Object.keys(input);
  return {
    hasSchedule: fields.some((field) => SCHEDULE_FIELDS.has(field)),
    hasMetadata: fields.some((field) => METADATA_FIELDS.has(field)),
    hasProgress: fields.includes("progress") || fields.includes("status"),
    hasBaseline: fields.some((field) => BASELINE_FIELDS.has(field)),
    unknownFields: fields.filter((field) => !SCHEDULE_FIELDS.has(field) &&
      !METADATA_FIELDS.has(field) && !BASELINE_FIELDS.has(field) && field !== "progress" && field !== "status"),
  };
}
