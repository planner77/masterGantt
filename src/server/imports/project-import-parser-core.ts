import { createHash } from "node:crypto";
import { PublicApiError } from "../http/api-error-core";

export const IMPORT_FILE_LIMIT_BYTES = 5 * 1024 * 1024;
const MULTIPART_FRAMING_LIMIT_BYTES = 16 * 1024;
const JSON_SYNTAX_DEPTH_LIMIT = 64;

/** Scan before JSON.parse so duplicate keys cannot disappear during object construction. */
function checkJsonSyntax(text: string): void {
  let cursor = 0;
  const invalid = (): never => { throw new PublicApiError(400, "INVALID_JSON", "The import file is not valid JSON."); };
  const whitespace = () => { while (/[\t\r\n ]/.test(text[cursor] ?? "") && cursor < text.length) cursor++; };
  const string = (): string => {
    if (text[cursor] !== '"') invalid();
    const start = cursor++;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === "\\") { if (cursor >= text.length) invalid(); cursor++; }
      else if (char === '"') {
        try { return JSON.parse(text.slice(start, cursor)) as string; } catch { return invalid(); }
      }
    }
    return invalid();
  };
  const value = (depth: number): void => {
    whitespace();
    const char = text[cursor];
    if (char === "{" || char === "[") {
      if (depth + 1 > JSON_SYNTAX_DEPTH_LIMIT) throw new PublicApiError(413, "IMPORT_TOO_LARGE", "Import JSON nesting exceeds the limit.");
      cursor++;
      const end = char === "{" ? "}" : "]";
      whitespace();
      if (text[cursor] === end) { cursor++; return; }
      const keys = new Set<string>();
      while (true) {
        if (char === "{") {
          whitespace();
          const key = string();
          if (keys.has(key)) throw new PublicApiError(400, "DUPLICATE_JSON_KEY", "The import file contains a duplicate object key.");
          keys.add(key);
          whitespace();
          if (text[cursor++] !== ":") invalid();
        }
        value(depth + 1);
        whitespace();
        const separator = text[cursor++];
        if (separator === end) return;
        if (separator !== ",") invalid();
      }
    }
    if (char === '"') { string(); return; }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, cursor)) { cursor += literal.length; return; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(cursor));
    if (!number) invalid();
    cursor += number![0].length;
  };
  value(0);
  whitespace();
  if (cursor !== text.length) invalid();
}

export function parseProjectImportBytes(bytes: Uint8Array): unknown {
  if (bytes.byteLength > IMPORT_FILE_LIMIT_BYTES) throw new PublicApiError(413, "IMPORT_TOO_LARGE", "The import file is too large.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new PublicApiError(400, "INVALID_UTF8", "The import file must use valid UTF-8."); }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  checkJsonSyntax(text);
  try { return JSON.parse(text) as unknown; }
  catch { throw new PublicApiError(400, "INVALID_JSON", "The import file is not valid JSON."); }
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
