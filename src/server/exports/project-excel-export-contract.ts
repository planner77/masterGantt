import { z } from "zod";

import type { ApiErrorDetail } from "@/contracts/projects";
import type { ProjectExcelExportRequest } from "@/contracts/project-excel-export";

const gridColumnId = z.enum(["text", "externalId", "projectStart", "projectDuration"]);
const exportSchema = z.object({
  includeDependencies: z.boolean(),
  scope: z.literal("project"),
  scale: z.literal("day"),
  hierarchyDisplay: z.literal("expanded"),
  layout: z.object({
    columns: z.array(z.object({
      id: gridColumnId,
      widthPx: z.number().finite().int().min(40).max(800),
    }).strict()).max(4),
  }).strict(),
}).strict().superRefine((value, context) => {
  const ids = value.layout.columns.map((column) => column.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: "custom",
      path: ["layout", "columns"],
      message: "Column identifiers must be unique.",
    });
  }
});

type ParseResult =
  | { success: true; data: ProjectExcelExportRequest }
  | { success: false; details: ApiErrorDetail[] };

export function parseProjectExcelExportInput(input: unknown): ParseResult {
  const result = exportSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    details: result.error.issues.map((issue) => ({
      path: issue.code === "unrecognized_keys"
        ? "$"
        : issue.path.length > 0 ? issue.path.join(".") : "$",
      code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD",
      message: issue.code === "unrecognized_keys"
        ? "The request contains an unknown field."
        : "Invalid field value.",
    })),
  };
}
