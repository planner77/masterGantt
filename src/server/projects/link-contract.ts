import { z } from "zod";
import type { ApiErrorDetail, CreateLinkRequest } from "../../contracts/projects";

const schema = z.object({
  predecessorExternalId: z.string().min(1).max(128),
  successorExternalId: z.string().min(1).max(128),
  type: z.literal("FS"),
  lag: z.literal(0),
}).strict();

export function parseCreateLinkInput(input: unknown):
  | { success: true; data: CreateLinkRequest }
  | { success: false; details: ApiErrorDetail[] } {
  const result = schema.safeParse(input);
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
