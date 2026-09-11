import { z } from "zod";

import type {
  ApiErrorDetail,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "../../contracts/projects";

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

const wellFormedString = z.string().refine(isWellFormedUnicode);

const taskName = wellFormedString
  .transform((value) => value.trim())
  .refine((value) => {
    const length = codePointLength(value);
    return length >= 1 && length <= 200;
  });

const externalId = wellFormedString.refine((value) => {
  const length = codePointLength(value);
  return length >= 1 &&
    length <= 128 &&
    !/^\p{White_Space}|\p{White_Space}$/u.test(value) &&
    !/[\p{Cc}\p{Cf}]/u.test(value);
});

const leafType = z.enum(["task", "milestone"]);
const scheduleMode = z.enum(["auto", "manual"]);
const dateLabel = wellFormedString;
const duration = z.number().int();
const progress = z.number().finite().min(0).max(100);

const createTaskSchema = z.object({
  externalId: externalId.optional(),
  name: taskName,
  type: leafType,
  scheduleMode: scheduleMode.optional(),
  start: dateLabel,
  end: dateLabel.optional(),
  duration,
  progress,
  parentExternalId: z.null().optional(),
}).strict();

const updateTaskSchema = z.object({
  name: taskName.optional(),
  scheduleMode: scheduleMode.optional(),
  start: dateLabel.optional(),
  end: dateLabel.optional(),
  duration: duration.optional(),
  progress: progress.optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one task field is required." },
).refine(
  (value) => value.end === undefined ||
    value.start !== undefined || value.duration !== undefined,
  { path: ["end"], message: "End requires start or duration." },
);

type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; details: ApiErrorDetail[] };

function parseStrict<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  if (result.success) return result;

  return {
    success: false,
    details: result.error.issues.map((issue) => ({
      path: issue.code === "unrecognized_keys"
        ? "$"
        : issue.path.length > 0 ? issue.path.join(".") : "$",
      code: issue.code === "unrecognized_keys"
        ? "UNKNOWN_FIELD"
        : "INVALID_FIELD",
      message: issue.code === "unrecognized_keys"
        ? "The request contains an unknown field."
        : "Invalid field value.",
    })),
  };
}

export function parseCreateTaskInput(input: unknown): ParseResult<CreateTaskRequest> {
  return parseStrict(createTaskSchema, input);
}

export function parseUpdateTaskInput(input: unknown): ParseResult<UpdateTaskRequest> {
  return parseStrict(updateTaskSchema, input);
}
