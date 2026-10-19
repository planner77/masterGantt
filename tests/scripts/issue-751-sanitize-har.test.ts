import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

describe("Issue #751 HAR privacy boundary", () => {
  it("retains HTTP latency and status without raw URL, token, or payload", () => {
    const dir = mkdtempSync(join(tmpdir(), "issue751-har-"));
    try {
      const input = join(dir, "input.har"), output = join(dir, "safe.json");
      writeFileSync(input, JSON.stringify({ log: { entries: [
        { startedDateTime: "2026-10-19T10:10:10.000Z", time: 3517,
          request: { method: "GET", url: "https://secret.host/api/projects/private123/logistics/process-context?token=SECRET" },
          response: { status: 503, content: { text: "COOKIE_SECRET" } } },
        { startedDateTime: "2026-10-19T10:10:11.000Z", time: 20,
          request: { method: "GET", url: "https://secret.host/api/projects/private123/assignment-targets" },
          response: { status: -1 } },
      ] } }));
      execFileSync(process.execPath, [resolve("scripts/issue-751-sanitize-har.mjs"), "--input", input, "--output", output]);
      const raw = readFileSync(output, "utf8"), report = JSON.parse(raw);
      expect(report.events).toMatchObject([
        { route: "process-context", startMs: 0, durationMs: 3517, status: 503, outcome: "http_error" },
        { route: "assignment-targets", startMs: 1000, status: null, outcome: "incomplete" },
      ]);
      expect(raw).not.toMatch(/secret\.host|private123|SECRET|token=|COOKIE/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
