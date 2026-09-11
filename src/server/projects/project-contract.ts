import { z } from "zod";

import type {
  ApiErrorDetail,
  CreateProjectRequest,
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

const createProjectSchema = z
  .object({
    name: wellFormedString
      .transform((value) => value.trim())
      .refine((value) => {
        const length = codePointLength(value);
        return length >= 1 && length <= 200;
      }),
    description: wellFormedString.refine(
      (value) => codePointLength(value) <= 4_000,
    ),
    editPassword: wellFormedString
      .refine((value) => codePointLength(value) >= 12)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 1_024),
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

const CANONICAL_UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isCanonicalUuidV4(value: string): boolean {
  return CANONICAL_UUID_V4.test(value);
}
