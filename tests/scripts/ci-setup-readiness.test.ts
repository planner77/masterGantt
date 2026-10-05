import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("Issue #444 Phase 2 readiness automation", () => {
  it("renders collecting status and blockers without closing or auto-optimizing", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-readiness-"));
    tempDirs.push(dir);
    const input = join(dir, "analysis.json");
    const output = join(dir, "comment.md");
    writeFileSync(input, JSON.stringify({
      minSamples: 10,
      phase2Ready: false,
      metrics: [
        {
          lane: "PR",
          workflow: ".github/workflows/ci.yml",
          eventName: "pull_request",
          job: "build",
          metric: "npm-ci",
          successfulRuns: 10,
          enoughSamples: true,
        },
        {
          lane: "Main",
          workflow: ".github/workflows/ci.yml",
          eventName: "push",
          job: "build",
          metric: "npm-ci",
          successfulRuns: 7,
          enoughSamples: false,
        },
        {
          lane: "Release",
          workflow: ".github/workflows/release-image.yml",
          eventName: "workflow_dispatch",
          job: "static",
          metric: "npm-ci",
          successfulRuns: 3,
          enoughSamples: false,
        },
      ],
      candidates: [{
        rank: 1,
        lane: "PR",
        job: "build",
        metric: "npm-ci",
        medianMs: 2000,
        p90Ms: 3000,
        runnerMinutesPerSuccessfulRun: 0.05,
        cacheHitRate: 0.8,
      }],
    }));

    execFileSync(process.execPath, [
      "scripts/render-ci-setup-readiness.mjs",
      "--input", input,
      "--output", output,
      "--issue", "444",
      "--repository", "planner77/masterGantt",
      "--run-id", "12345",
    ], {
      cwd: root,
      env: { ...process.env, GITHUB_SERVER_URL: "https://github.com" },
      stdio: "pipe",
    });

    const comment = readFileSync(output, "utf8");
    expect(comment).toContain("<!-- mastergantt-ci-setup-readiness:v1 -->");
    expect(comment).toContain("Issue #444 Phase 2 readiness — COLLECTING");
    expect(comment).toContain("| PR | 1/1 | 10/10 | READY |");
    expect(comment).toContain("| Main | 0/1 | 7/10 | COLLECTING |");
    expect(comment).toContain("| Release | 0/1 | 3/10 | COLLECTING |");
    expect(comment).toContain("| Main | build | npm-ci | 7 | 3 |");
    expect(comment).toContain("신규 cache 최적화는 계속 보류");
    expect(comment).not.toContain("Issue close");
  });

  it("renders READY but requires explicit optimization restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "mastergantt-readiness-ready-"));
    tempDirs.push(dir);
    const input = join(dir, "analysis.json");
    const output = join(dir, "comment.md");
    const readyMetric = (lane: string, workflow: string, eventName: string) => ({
      lane,
      workflow,
      eventName,
      job: "build",
      metric: "npm-ci",
      successfulRuns: 10,
      enoughSamples: true,
    });
    writeFileSync(input, JSON.stringify({
      minSamples: 10,
      phase2Ready: true,
      metrics: [
        readyMetric("PR", ".github/workflows/ci.yml", "pull_request"),
        readyMetric("Main", ".github/workflows/ci.yml", "push"),
        readyMetric("Release", ".github/workflows/release-image.yml", "workflow_dispatch"),
      ],
      candidates: [],
    }));

    execFileSync(process.execPath, [
      "scripts/render-ci-setup-readiness.mjs",
      "--input", input,
      "--output", output,
    ], { cwd: root, stdio: "pipe" });

    const comment = readFileSync(output, "utf8");
    expect(comment).toContain("Phase 2 readiness — READY");
    expect(comment).toContain("자동으로 cache 변경이나 PR을 만들지는 않습니다.");
    expect(comment).toContain("명시적으로 재개");
  });

  it("keeps the write-capable workflow on trusted main and updates one marker comment", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/ci-setup-readiness.yml"), "utf8");

    expect(workflow).toContain('workflows: ["CI", "Publish release image"]');
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain('cron: "43 20 * * *"');
    expect(workflow).toContain("ref: main");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toContain("ref: ${{ github.event.workflow_run.head");
    expect(workflow).toContain("actions: read");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("issues: write");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("pull-requests: write");
    expect(workflow).toContain('collect_runs "ci.yml" "pull_request"');
    expect(workflow).toContain('collect_runs "ci.yml" "push"');
    expect(workflow).toContain('collect_runs "release-image.yml" "workflow_dispatch"');
    expect(workflow).toContain("--min-samples 10");
    expect(workflow).toContain("mastergantt-ci-setup-readiness:v1");
    expect(workflow).toContain("--method PATCH");
    expect(workflow).toContain("--method POST");
  });
});
