import { createHash } from "node:crypto";
import { PublicApiError } from "../http/api-error-core";
import { parseStrictJsonBytes } from "../http/strict-json-core";

export const IMPORT_FILE_LIMIT_BYTES = 5 * 1024 * 1024;
const MULTIPART_FRAMING_LIMIT_BYTES = 16 * 1024;
const JSON_SYNTAX_DEPTH_LIMIT = 64;

export function parseProjectImportBytes(bytes: Uint8Array): unknown {
  return parseStrictJsonBytes(bytes, {
    maximumBytes: IMPORT_FILE_LIMIT_BYTES,
    maximumDepth: JSON_SYNTAX_DEPTH_LIMIT,
    error: (kind) => {
      if (kind === "tooLarge") return new PublicApiError(413, "IMPORT_TOO_LARGE", "The import file is too large.");
      if (kind === "depth") return new PublicApiError(413, "IMPORT_TOO_LARGE", "Import JSON nesting exceeds the limit.");
      if (kind === "invalidUtf8") return new PublicApiError(400, "INVALID_UTF8", "The import file must use valid UTF-8.");
      if (kind === "duplicateKey") return new PublicApiError(400, "DUPLICATE_JSON_KEY", "The import file contains a duplicate object key.");
      return new PublicApiError(400, "INVALID_JSON", "The import file is not valid JSON.");
    },
  });
}

export function projectImportPreviewDigest(bytes: Uint8Array, publicId: string, revision: number): string {
  return createHash("sha256").update(`mastergantt-import-preview:v1\0${publicId}\0${revision}\0`, "utf8").update(bytes).digest("hex");
}

export async function readProjectImportFile(request: Request): Promise<Uint8Array> {
  const encoding = request.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") throw new PublicApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Encoded import bodies are not supported.");
  const contentType = request.headers.get("content-type") ?? "";
  const multipart = /^multipart\/form-data\s*;/i.test(contentType);
  const json = /^(application\/json|application\/vnd\.mastergantt\.import\+json)(?:\s*;\s*charset=utf-8)?$/i.test(contentType.trim());
  if (!multipart && !json) throw new PublicApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Import accepts JSON files or UTF-8 JSON bodies.");
  const limit = IMPORT_FILE_LIMIT_BYTES + (multipart ? MULTIPART_FRAMING_LIMIT_BYTES : 0);
  const length = request.headers.get("content-length");
  if (length !== null && !/^\d+$/.test(length)) throw new PublicApiError(400, "INVALID_REQUEST", "Invalid Content-Length.");
  if (length !== null && Number(length) > limit) throw new PublicApiError(413, "IMPORT_TOO_LARGE", "The import request is too large.");
  if (!request.body) throw new PublicApiError(400, "INVALID_REQUEST", "An import file is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel().catch(() => undefined); throw new PublicApiError(413, "IMPORT_TOO_LARGE", "The import request is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (!multipart) return bytes;
  let form: FormData;
  try { form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new PublicApiError(400, "INVALID_REQUEST", "Invalid multipart import body."); }
  const entries = [...form.entries()];
  if (entries.length !== 1 || entries[0][0] !== "file" || typeof entries[0][1] === "string") {
    throw new PublicApiError(400, "INVALID_REQUEST", "Exactly one file part is required; additional or duplicate parts are rejected.");
  }
  const file = entries[0][1];
  if (file.size > IMPORT_FILE_LIMIT_BYTES) throw new PublicApiError(413, "IMPORT_TOO_LARGE", "The import file is too large.");
  return new Uint8Array(await file.arrayBuffer());
}
