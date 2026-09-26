import { z } from "zod";
import type { ApiErrorDetail, CreateLinkRequest, UpdateLinkRequest } from "../../contracts/projects";

const createSchema = z.object({
  predecessorExternalId: z.string().min(1).max(128),
  successorExternalId: z.string().min(1).max(128),
  type: z.enum(["FS", "SS", "FF", "SF"]).default("FS"),
  lag: z.number().int().min(-10000).max(10000).default(0),
}).strict();

const updateSchema = z.object({
  type: z.enum(["FS", "SS", "FF", "SF"]).optional(),
  lag: z.number().int().min(-10000).max(10000).optional(),
}).strict().refine((data) => data.type !== undefined || data.lag !== undefined, {
  message: "At least one of type or lag must be provided.",
});

export function parseCreateLinkInput(input: unknown):
  | { success: true; data: CreateLinkRequest }
  | { success: false; details: ApiErrorDetail[] } {
  const result = createSchema.safeParse(input);
  if (result.success) return result;
  return {
    success: false,
    details: result.error.issues.map((issue) => ({
      path: issue.code === "unrecognized_keys" ? "$" : issue.path.join(".") || "$",
      code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD",
      message: issue.code === "unrecognized_keys"
        ? "The request contains an unknown field."
        : "Invalid field value.",
    })),
  };
}

export function parseUpdateLinkInput(input: unknown):
  | { success: true; data: UpdateLinkRequest }
  | { success: false; details: ApiErrorDetail[] } {
  const result = updateSchema.safeParse(input);
  if (result.success) return result;
  return {
    success: false,
    details: result.error.issues.map((issue) => ({
      path: issue.code === "unrecognized_keys" ? "$" : issue.path.join(".") || "$",
      code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD",
      message: issue.code === "unrecognized_keys"
        ? "The request contains an unknown field."
        : "Invalid field value.",
    })),
  };
}
