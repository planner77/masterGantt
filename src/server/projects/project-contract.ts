import { z } from "zod";

import type {
  ApiErrorDetail,
  ChangeEditPasswordRequest,
  CopyProjectRequest,
  CreateProjectRequest,
  UnlockProjectRequest,
  UpdateProjectRequest,
} from "@/contracts/projects";

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
const projectName = wellFormedString
  .transform((value) => value.trim())
  .refine((value) => {
    const length = codePointLength(value);
    return length >= 1 && length <= 200;
  });
const projectOwnerName = wellFormedString
  .transform((value) => value.trim())
  .refine((value) => {
    const length = codePointLength(value);
    return length >= 1 && length <= 100;
  });
const projectDescription = wellFormedString.refine(
  (value) => codePointLength(value) <= 4_000,
);
const newPassword = wellFormedString.refine((value) => {
  const length = codePointLength(value);
  return length >= 1 && length <= 12;
});

const createProjectSchema = z.object({
  name: projectName,
  description: projectDescription,
  ownerName: projectOwnerName,
  editPassword: newPassword,
}).strict();

const copyProjectSchema = z.object({
  name: projectName,
  description: projectDescription,
  ownerName: projectOwnerName,
  editPassword: newPassword,
  resetProgress: z.boolean().optional(),
}).strict();

/**
 * Internal service input keeps ownerName optional so legacy focused service
 * fixtures can create pre-Issue-54 compatible rows. The HTTP parser always
 * returns a CreateProjectRequest where ownerName is required and normalized.
 */
export type CreateProjectInput = Omit<CreateProjectRequest, "ownerName"> & {
  ownerName?: string;
};
export type ProjectInputParseResult =
  | { success: true; data: CreateProjectRequest }
  | { success: false; details: ApiErrorDetail[] };

function parseStrictInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { success: true; data: T } | { success: false; details: ApiErrorDetail[] } {
  const result = schema.safeParse(input);
  if (result.success) return result;
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

export function parseCreateProjectInput(input: unknown): ProjectInputParseResult {
  return parseStrictInput<CreateProjectRequest>(createProjectSchema, input);
}

export function parseCopyProjectInput(input: unknown) {
  return parseStrictInput<CopyProjectRequest & { ownerName: string }>(
    copyProjectSchema,
    input,
  );
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

export function parseUnlockProjectInput(input: unknown) {
  return parseStrictInput<UnlockProjectRequest>(unlockProjectSchema, input);
}

export function parseUpdateProjectInput(input: unknown) {
  return parseStrictInput<UpdateProjectRequest>(updateProjectSchema, input);
}

export function parseChangeEditPasswordInput(input: unknown) {
  return parseStrictInput<ChangeEditPasswordRequest>(changeEditPasswordSchema, input);
}

const CANONICAL_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCanonicalUuidV4(value: string): boolean {
  return CANONICAL_UUID_V4.test(value);
}
