import { z } from "zod";

import type { ApiErrorDetail } from "@/contracts/projects";
import type { ProjectGanttImageExportRequest } from "@/contracts/project-gantt-image-export";
import { dateToOrdinal } from "../../domain/scheduling/date-only";

const common = {
  scale: z.enum(["day", "week"]),
  hierarchyDisplay: z.literal("expanded"),
};

const schema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("project"), ...common }).strict(),
  z.object({
    scope: z.literal("range"),
    startDate: z.string(),
    endDate: z.string(),
    ...common,
  }).strict(),
]);

type ParseResult =
  | { success: true; data: ProjectGanttImageExportRequest }
  | { success: false; details: ApiErrorDetail[] };

export function parseProjectSvgExportInput(input: unknown): ParseResult {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      details: parsed.error.issues.map((issue) => ({
        path: issue.code === "unrecognized_keys" ? "$" : issue.path.join(".") || "$",
        code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD",
        message: issue.code === "unrecognized_keys" ? "The request contains an unknown field." : "Invalid field value.",
      })),
    };
  }
  if (parsed.data.scope === "range") {
    let start: number;
    let end: number;
    try {
      start = dateToOrdinal(parsed.data.startDate);
      end = dateToOrdinal(parsed.data.endDate);
    } catch {
      return { success: false, details: [{ path: "startDate,endDate", code: "INVALID_FIELD", message: "Invalid date range." }] };
    }
    if (start > end) {
      return { success: false, details: [{ path: "endDate", code: "INVALID_FIELD", message: "End date must not precede start date." }] };
    }
  }
  return { success: true, data: parsed.data };
}
