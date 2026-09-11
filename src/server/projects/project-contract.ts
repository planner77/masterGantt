import { z } from "zod";

import type {
  ApiErrorDetail,
  ChangeEditPasswordRequest,
  CreateProjectRequest,
  UnlockProjectRequest,
  UpdateProjectRequest,
} from "@/contracts/projects";

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) {
        return false;
      }
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return false;
      }
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

const projectName = wellFormedString
  .transform((value) => value.trim())
  .refine((value) => {
    const length = codePointLength(value);
    return length >= 1 && length <= 200;
  });

const projectDescription = wellFormedString.refine(
  (value) => codePointLength(value) <= 4_000,
);

const newPassword = wellFormedString
  .refine((value) => codePointLength(value) >= 12)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 1_024);

const createProjectSchema = z
  .object({
    name: projectName,
    description: projectDescription,
    editPassword: newPassword,
  })
  .strict();

export type CreateProjectInput = CreateProjectRequest;

export type ProjectInputParseResult =
  | { success: true; data: CreateProjectInput }
  | { success: false; details: ApiErrorDetail[] };

export function parseCreateProjectInput(
  input: unknown,
): ProjectInputParseResult {
  const result = createProjectSchema.safeParse(input);
  if (result.success) {
    return result;
  }

  const details: ApiErrorDetail[] = [];
  for (const issue of result.error.issues) {
    if (issue.code === "unrecognized_keys") {
      details.push({
        path: "$",
        code: "UNKNOWN_FIELD",
        message: "The request contains an unknown field.",
      });
      continue;
    }

    details.push({
      path: issue.path.length > 0 ? issue.path.join(".") : "$",
      code: "INVALID_FIELD",
      message: "Invalid field value.",
    });
  }

  return { success: false, details };
}

const unlockProjectSchema = z.object({
  editPassword: wellFormedString.refine(
    (value) => Buffer.byteLength(value, "utf8") <= 1_024,
  ),
}).strict();

const updateProjectSchema = z.object({
  name: projectName.optional(),
  description: projectDescription.optional(),
}).strict().refine(
  (value) => value.name !== undefined || value.description !== undefined,
);

const changeEditPasswordSchema = z.object({
  newEditPassword: newPassword,
}).strict();

function parseStrictInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { success: true; data: T } | { success: false; details: ApiErrorDetail[] } {
  const result = schema.safeParse(input);
  if (result.success) {
    return result;
  }

  const details: ApiErrorDetail[] = result.error.issues.map((issue) => ({
    path: issue.code === "unrecognized_keys"
      ? "$"
      : issue.path.length > 0 ? issue.path.join(".") : "$",
    code: issue.code === "unrecognized_keys" ? "UNKNOWN_FIELD" : "INVALID_FIELD",
    message: issue.code === "unrecognized_keys"
      ? "The request contains an unknown field."
      : "Invalid field value.",
  }));
  return { success: false, details };
}

export function parseUnlockProjectInput(input: unknown) {
  return parseStrictInput<UnlockProjectRequest>(unlockProjectSchema, input);
}

export function parseUpdateProjectInput(input: unknown) {
  return parseStrictInput<UpdateProjectRequest>(updateProjectSchema, input);
}

export function parseChangeEditPasswordInput(input: unknown) {
  return parseStrictInput<ChangeEditPasswordRequest>(
    changeEditPasswordSchema,
    input,
  );
}

const CANONICAL_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCanonicalUuidV4(value: string): boolean {
  return CANONICAL_UUID_V4.test(value);
}
