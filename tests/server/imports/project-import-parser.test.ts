import { describe, expect, it } from "vitest";
import { IMPORT_FILE_LIMIT_BYTES, parseProjectImportBytes, projectImportPreviewDigest, readProjectImportFile } from "../../../src/server/imports/project-import-parser-core";
const bytes = (value: string) => new TextEncoder().encode(value);
const request = (body: BodyInit, type = "application/json", headers = {}) => new Request("https://gantt.example.com/import", { method: "POST", headers: { "Content-Type": type, ...headers }, body });
describe("bounded project import parser", () => {
  it("accepts UTF-8 and exactly one leading BOM", () => { expect(parseProjectImportBytes(bytes('\uFEFF{"이름":"작업"}'))).toEqual({ 이름: "작업" }); expect(() => parseProjectImportBytes(bytes('\uFEFF\uFEFF{}'))).toThrow(); });
  it("rejects invalid UTF-8 instead of replacing it", () => { expect(() => parseProjectImportBytes(new Uint8Array([0xc3, 0x28]))).toThrow("valid UTF-8"); });
  it.each(['{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"outer":{"x":1,"x":2}}'])("rejects duplicate decoded keys %s", (value) => { expect(() => parseProjectImportBytes(bytes(value))).toThrow("duplicate object key"); });
  it.each(['{"x":}', '[1,]', '01', '{} true', '"\\x"', '{"x":NaN}'])("rejects invalid syntax %s", (value) => { expect(() => parseProjectImportBytes(bytes(value))).toThrow(); });
  it("accepts depth 64 and rejects depth 65 independently of WBS", () => { expect(() => parseProjectImportBytes(bytes("[".repeat(64) + "0" + "]".repeat(64)))).not.toThrow(); expect(() => parseProjectImportBytes(bytes("[".repeat(65) + "0" + "]".repeat(65)))).toThrow("nesting"); });
  it("enforces bytes, not text length", () => { expect(() => parseProjectImportBytes(new Uint8Array(IMPORT_FILE_LIMIT_BYTES + 1))).toThrow("too large"); });
  it("binds digest to exact bytes, target and base revision", () => { const a = projectImportPreviewDigest(bytes("{}"), "p", 1); expect(a).toMatch(/^[a-f0-9]{64}$/); for (const b of [projectImportPreviewDigest(bytes("{} "), "p", 1), projectImportPreviewDigest(bytes("{}"), "q", 1), projectImportPreviewDigest(bytes("{}"), "p", 2)]) expect(b).not.toBe(a); });
  it("reads one bounded multipart file", async () => { const form = new FormData(); form.append("file", new Blob(["{}"]), "project.json"); expect(await readProjectImportFile(new Request("https://gantt.example.com/import", { method: "POST", body: form }))).toEqual(bytes("{}")); });
  it.each(["duplicate", "unknown", "text"])("rejects all invalid multipart parts %s", async (kind) => { const form = new FormData(); form.append("file", kind === "text" ? "{}" : new Blob(["{}"])); if (kind !== "text") form.append(kind === "duplicate" ? "file" : "unknown", new Blob(["{}"])); await expect(readProjectImportFile(new Request("https://gantt.example.com/import", { method: "POST", body: form }))).rejects.toThrow("Exactly one file"); });
  it("rejects oversize Content-Length before buffering", async () => { await expect(readProjectImportFile(request("{}", "application/json", { "Content-Length": String(IMPORT_FILE_LIMIT_BYTES + 1) }))).rejects.toThrow("too large"); });
  it("enforces actual streamed bytes without Content-Length", async () => { await expect(readProjectImportFile(request(new Uint8Array(IMPORT_FILE_LIMIT_BYTES + 1)))).rejects.toThrow("too large"); });
  it.each(["text/csv", "application/json; charset=latin1"])("rejects unsupported media %s", async (type) => { await expect(readProjectImportFile(request("{}", type))).rejects.toThrow(); });
  it("rejects encoded bodies", async () => { await expect(readProjectImportFile(request("{}", "application/json", { "Content-Encoding": "gzip" }))).rejects.toThrow(); });
});
