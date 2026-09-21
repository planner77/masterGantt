import { z } from "zod";

import type {
  ApiErrorDetail,
  TaskHierarchyCommandRequest,
  TaskHierarchyCreateSeed,
} from "../../contracts/projects";
import { isCanonicalUuidV4 } from "./project-contract";
import { parseCreateTaskInput } from "./task-contract";

const uuid = z.string().refine(isCanonicalUuidV4);
const placement = z.enum(["before", "after", "child"]);

const createSeed = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  type: z.enum(["task", "milestone"]),
  scheduleMode: z.enum(["auto", "manual"]).optional(),
  start: z.string(),
  end: z.string().optional(),
  duration: z.number().int(),
  progress: z.number().finite(),
}).strict();

const commandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create"),
    anchorTaskId: uuid,
    placement,
    task: createSeed,
  }).strict(),
  z.object({
    kind: z.literal("convert"),
    taskId: uuid,
    targetType: z.enum(["task", "summary", "milestone"]),
  }).strict(),
  z.object({
    kind: z.literal("move"),
    taskId: uuid,
    direction: z.enum(["up", "down"]),
  }).strict(),
  z.object({
    kind: z.literal("indent"),
    taskId: uuid,
  }).strict(),
  z.object({
    kind: z.literal("outdent"),
    taskId: uuid,
  }).strict(),
  z.object({
    kind: z.literal("reparent"),
    taskId: uuid,
    anchorTaskId: uuid,
    placement,
  }).strict(),
  z.object({
    kind: z.literal("copy"),
    taskId: uuid,
    anchorTaskId: uuid,
    placement,
  }).strict(),
]);

type ParseResult =
  | { success: true; data: TaskHierarchyCommandRequest }
  | { success: false; details: ApiErrorDetail[] };

function details(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.code === "unrecognized_keys"
      ? "$"
      : issue.path.length > 0 ? issue.path.join(".") : "$",
    code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD",
    message: issue.code === "unrecognized_keys"
      ? "The request contains an unknown field."
      : "Invalid field value.",
  }));
}

function validateCreateSeed(seed: TaskHierarchyCreateSeed): boolean {
  return parseCreateTaskInput({
    ...seed,
    parentExternalId: null,
  }).success;
}

export function parseTaskHierarchyCommand(input: unknown): ParseResult {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { success: false, details: details(parsed.error) };
  const command = parsed.data as TaskHierarchyCommandRequest;
  if (command.kind === "create" && !validateCreateSeed(command.task)) {
    return {
      success: false,
      details: [{ path: "task", code: "INVALID_FIELD", message: "Invalid task seed." }],
    };
  }
  return { success: true, data: command };
}
