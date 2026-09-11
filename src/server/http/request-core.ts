import { PublicApiError } from "./api-error-core";

export const PROJECT_CREATE_BODY_LIMIT_BYTES = 32 * 1_024;

function isJsonUtf8ContentType(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const parts = value.split(";").map((part) => part.trim());
  if (parts[0].toLowerCase() !== "application/json") {
    return false;
  }

  if (parts.length === 1) {
    return true;
  }

  return (
    parts.length === 2 &&
    parts[1].toLowerCase() === "charset=utf-8"
  );
}

function validateDeclaredLength(request: Request, maximumBytes: number): void {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength === null) {
    return;
  }

  if (!/^\d+$/.test(declaredLength)) {
    throw new PublicApiError(
      400,
      "INVALID_REQUEST",
      "The request is invalid.",
    );
  }

  if (Number(declaredLength) > maximumBytes) {
    throw new PublicApiError(
      413,
      "REQUEST_TOO_LARGE",
      "The request body is too large.",
    );
  }
}

async function readBodyBytes(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    byteLength += value.byteLength;
    if (byteLength > maximumBytes) {
      await reader.cancel().catch(() => undefined);
      throw new PublicApiError(
        413,
        "REQUEST_TOO_LARGE",
        "The request body is too large.",
      );
    }
    chunks.push(value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readBoundedJson(
  request: Request,
  maximumBytes = PROJECT_CREATE_BODY_LIMIT_BYTES,
): Promise<unknown> {
  if (!isJsonUtf8ContentType(request.headers.get("content-type"))) {
    throw new PublicApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json with UTF-8 encoding.",
    );
  }

  const contentEncoding = request.headers.get("content-encoding");
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    throw new PublicApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Encoded request bodies are not supported.",
    );
  }

  validateDeclaredLength(request, maximumBytes);
  const bytes = await readBodyBytes(request, maximumBytes);

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new PublicApiError(
      400,
      "INVALID_JSON",
      "The request body is not valid JSON.",
    );
  }
}

export function parseRequiredIfMatch(request: Request): number {
  const value = request.headers.get("if-match");
  if (value === null) {
    throw new PublicApiError(
      428,
      "PRECONDITION_REQUIRED",
      "If-Match is required.",
    );
  }

  const match = /^"([1-9][0-9]*)"$/.exec(value);
  if (!match) {
    throw new PublicApiError(
      400,
      "INVALID_REQUEST",
      "If-Match must contain one strong positive revision ETag.",
    );
  }

  const revision = Number(match[1]);
  if (!Number.isSafeInteger(revision)) {
    throw new PublicApiError(
      400,
      "INVALID_REQUEST",
      "If-Match must contain one strong positive revision ETag.",
    );
  }
  return revision;
}
