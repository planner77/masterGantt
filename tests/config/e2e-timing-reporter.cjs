/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

class E2ETimingReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || process.env.E2E_TIMING_OUTPUT || "";
    this.entries = [];
    this.receipts = [];
    // Keep the 8-shard selector's skipped-case accounting distinct from passed-only timing.
    this.skippedFiles = new Set();
    this.skippedCaseCount = 0;
    this.runnerReadyMs = 0;
  }

  onBegin() {
    const startedMs = Number(process.env.E2E_RUN_STARTED_MS || 0);
    if (Number.isFinite(startedMs) && startedMs > 0) {
      this.runnerReadyMs = Math.max(0, Date.now() - startedMs);
    }
  }

  onTestEnd(test, result) {
    if (!this.outputFile) return;
    // #751 F-010: optional onTestEnd fields are absent in the #770/CI policy
    // replay. An absent attachment is not a timing receipt or a failed test.
    const attachments = Array.isArray(result.attachments) ? result.attachments : [];
    for (const attachment of attachments) {
      if (attachment?.name !== "issue-751-isolated-performance") continue;
      try {
        const raw = attachment.body || (attachment.path ? fs.readFileSync(attachment.path) : null);
        if (!raw || raw.length > 262144) continue;
        const receipt = JSON.parse(raw.toString("utf8"));
        if (receipt.schemaVersion !== 2 || !Array.isArray(receipt.stages) || !Array.isArray(receipt.requests)) continue;
        // Do not fabricate a phase duration when Playwright did not supply steps.
        if (!Array.isArray(result.steps)) continue;
        const beforeHooksMs = result.steps.filter(step => step.title === "Before Hooks").reduce((total, step) => total + step.duration, 0);
        const afterHooksMs = result.steps.filter(step => step.title === "After Hooks").reduce((total, step) => total + step.duration, 0);
        this.receipts.push({ ...receipt, resultStatus: result.status, testDurationMs: result.duration,
          beforeHooksMs, afterHooksMs,
          bodyResidualEstimateMs: Math.max(0, result.duration - beforeHooksMs - afterHooksMs),
          bodyResidualIsEstimate: true,
        });
      } catch { /* Diagnostic errors never change test outcomes. */ }
    }
    if (result.status !== "passed" && result.status !== "skipped") return;
    const relativeFile = path.relative(process.cwd(), test.location.file).split(path.sep).join("/");
    if (result.status === "skipped") {
      this.skippedFiles.add(relativeFile);
      this.skippedCaseCount += 1;
      return;
    }
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
      runnerReadyMs: this.runnerReadyMs,
      entries: this.entries,
      skippedFiles: [...this.skippedFiles].sort(),
      skippedCaseCount: this.skippedCaseCount,
      environment: {os:process.platform, node:process.versions.node, fullyParallel:process.env.CI_E2E_FULLY_PARALLEL==="true",
        imageOS:process.env.ImageOS || "", imageVersion:process.env.ImageVersion || "",\n        runnerArch:process.env.RUNNER_ARCH || "", runnerOS:process.env.RUNNER_OS || ""},
      receipts: this.receipts,
    };
    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
    fs.writeFileSync(this.outputFile, JSON.stringify(payload, null, 2) + "\n", "utf8");
  }
}

module.exports = E2ETimingReporter;
