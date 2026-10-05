/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

class E2ETimingReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || process.env.E2E_TIMING_OUTPUT || "";
    this.entries = [];
  }

  onTestEnd(test, result) {
    if (!this.outputFile || result.status !== "passed") return;
    const relativeFile = path.relative(process.cwd(), test.location.file).split(path.sep).join("/");
    this.entries.push({
      file: relativeFile,
      durationMs: Math.max(0, Number(result.duration) || 0),
    });
  }

  onEnd(result) {
    if (!this.outputFile) return;
    const payload = {
      schemaVersion: 1,
      runId: process.env.GITHUB_RUN_ID || "",
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT || 0),
      headSha: process.env.GITHUB_SHA || "",
      eventName: process.env.GITHUB_EVENT_NAME || "",
      shard: Number(process.env.E2E_TIMING_SHARD || 0),
      shardCount: Number(process.env.E2E_TIMING_SHARD_COUNT || 0),
      status: result.status,
      entries: this.entries,
    };
    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
    fs.writeFileSync(this.outputFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
}

module.exports = E2ETimingReporter;
