import { z } from "zod";
import type {
  ResourceDrillScopeDto,
  ResourceDrillSourceContext,
  ResourceDataContext,
  ResourceDrillProjection,
} from "@/contracts/resource-drill";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hash = z.string().regex(/^[a-f0-9]{64}$/);
export const resourceDataContextSchema = z.object({
  projectPublicId: z.string(),
  projectRevision: z.number().int().nonnegative(),
  catalogRevision: z.number().int().nonnegative(),
  calendarRevision: hash,
  dataSnapshotId: hash,
});
const source = resourceDataContextSchema.extend({
  range: z.object({ from: date, to: date }),
  asOfDate: date,
  mdPerMm: z.number().finite().positive().nullable(),
  mdPerMmSource: z.enum(["query", "environment", "unset"]),
  mdPerMmProvided: z.boolean(),
  sourceProjection: z
    .object({
      kind: z.enum([
        "schedule",
        "milestoneReport",
        "report",
        "details",
        "groupChildren",
        "plan",
      ]),
    })
    .passthrough(),
});
export const resourceSourceContextSchema = z.custom<ResourceDrillSourceContext>(
  (value) => source.safeParse(value).success,
);
export function sameResourceDataContext(
  a: ResourceDataContext,
  b: ResourceDataContext,
) {
  return (
    a.projectPublicId === b.projectPublicId &&
    a.projectRevision === b.projectRevision &&
    a.catalogRevision === b.catalogRevision &&
    a.calendarRevision === b.calendarRevision &&
    a.dataSnapshotId === b.dataSnapshotId
  );
}
const scope = z.object({
  schema: z.literal("resource-dashboard/1"),
  snapshotId: hash,
  sourceContext: resourceSourceContextSchema,
  taskIds: z.array(z.string()).max(5000),
  assignmentIds: z.array(z.string()).max(8000),
  ancestorSummaryIds: z.array(z.string()),
  taskCount: z.number().int().nonnegative(),
  assignmentCount: z.number().int().nonnegative(),
});
export function readResourceDrillScope(
  body: unknown,
  expected: ResourceDrillSourceContext,
  snapshotId?: string,
  projection?: Extract<ResourceDrillProjection, { kind: "scope" }>,
): ResourceDrillScopeDto | null {
  const parsed = z.object({ data: scope }).safeParse(body);
  if (!parsed.success) return null;
  const value = parsed.data.data;
  if (projection) {
    const expectedProjection =
      projection.target === "dashboard"
        ? {
            kind: "details",
            selector: projection.selector,
            view:
              projection.selector.dimension === "diagnostic"
                ? "tasks"
                : "assignments",
          }
        : {
            kind: "plan",
            granularity: projection.granularity,
            periodId: projection.periodId,
            selector: projection.selector,
            demandScope: projection.demandScope,
            ...(projection.date ? { date: projection.date } : {}),
          };
    const key = (value: unknown): string =>
      value !== null && typeof value === "object"
        ? Array.isArray(value)
          ? JSON.stringify(value.map(key))
          : JSON.stringify(
              Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, item]) => [name, key(item)]),
            )
        : JSON.stringify(value);
    if (key(value.sourceContext.sourceProjection) !== key(expectedProjection))
      return null;
  }
  if (
    !sameResourceDataContext(value.sourceContext, expected) ||
    (snapshotId && value.snapshotId !== snapshotId) ||
    value.taskCount !== new Set(value.taskIds).size ||
    value.taskIds.length !== value.taskCount ||
    value.assignmentCount !== new Set(value.assignmentIds).size ||
    value.assignmentIds.length !== value.assignmentCount ||
    value.ancestorSummaryIds.some((id) => value.taskIds.includes(id)) ||
    value.ancestorSummaryIds.length !==
      new Set(value.ancestorSummaryIds).size ||
    value.sourceContext.range.from !== expected.range.from ||
    value.sourceContext.range.to !== expected.range.to ||
    value.sourceContext.asOfDate !== expected.asOfDate ||
    value.sourceContext.mdPerMm !== expected.mdPerMm ||
    value.sourceContext.mdPerMmSource !== expected.mdPerMmSource ||
    value.sourceContext.mdPerMmProvided !== expected.mdPerMmProvided
  )
    return null;
  return value;
}
