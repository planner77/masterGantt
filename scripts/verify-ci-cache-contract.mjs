import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) throw new Error(`cache contract violation: ${label} must contain ${JSON.stringify(needle)}`);
};
const forbidText = (text, needle, label) => {
  if (text.includes(needle)) throw new Error(`cache contract violation: ${label} must not contain ${JSON.stringify(needle)}`);
};

const nodeSetup = read(".github/actions/node-setup/action.yml");
const playwrightSetup = read(".github/actions/playwright-setup/action.yml");
const ci = read(".github/workflows/ci.yml");
const release = read(".github/workflows/release-image.yml");
const readiness = read(".github/workflows/ci-setup-readiness.yml");

requireText(nodeSetup, "path: ~/.npm", "npm download cache");
for (const input of ["runner.os", "runner.arch", "inputs.node-version", "steps.lock-hash.outputs.value"]) {
  requireText(nodeSetup, input, "npm cache key");
}
requireText(nodeSetup, "npm ci --prefer-offline --no-audit", "npm cache miss fallback");
forbidText(nodeSetup, "path: node_modules", "npm cache");
forbidText(nodeSetup, "path: ./node_modules", "npm cache");

requireText(playwrightSetup, 'cache "not-enabled"', "Playwright Phase 2 gate");
forbidText(playwrightSetup, "actions/cache@", "Playwright browser cache before evidence");
forbidText(playwrightSetup, "ms-playwright", "Playwright browser cache before evidence");
requireText(playwrightSetup, "playwright install-deps chromium", "Playwright OS dependency fallback");
requireText(playwrightSetup, "playwright install --only-shell chromium", "Playwright browser fallback");

for (const token of [
  "path: .next/cache",
  "runner.os",
  "runner.arch",
  "steps.next-cache-version.outputs.node",
  "steps.next-cache-version.outputs.next",
  "hashFiles('package-lock.json')",
  "npm run build",
]) {
  requireText(ci, token, "Next build cache contract");
}
for (const token of [
  "cache-from: type=gha,scope=mastergantt-docker-${{ runner.os }}-${{ runner.arch }}",
  "cache-to: type=gha,mode=max,scope=mastergantt-docker-${{ runner.os }}-${{ runner.arch }}",
  "platforms: linux/amd64",
]) {
  requireText(ci, token, "Docker BuildKit cache contract");
}

for (const token of [
  'workflows: ["CI", "Publish release image"]',
  "github.event.workflow_run.conclusion == 'success'",
  "ref: main",
  "persist-credentials: false",
  'collect_runs "ci.yml" "pull_request"',
  'collect_runs "ci.yml" "push"',
  'collect_runs "release-image.yml" "workflow_dispatch"',
  "bind-ci-setup-artifact-provenance.mjs",
  '--workflow "$run_path"',
  '--run-id "$run_id"',
  '--head-sha "$head_sha"',
  "--min-samples 10",
  "--require-bound-provenance true",
  "<!-- mastergantt-ci-setup-readiness:v1 -->",
]) {
  requireText(readiness, token, "Phase 2 readiness automation");
}
requireText(readiness, "actions: read", "readiness permissions");
requireText(readiness, "contents: read", "readiness permissions");
requireText(readiness, "issues: write", "readiness permissions");
forbidText(readiness, "contents: write", "readiness permissions");
forbidText(readiness, "pull-requests: write", "readiness permissions");
forbidText(readiness, "ref: ${{ github.event.workflow_run.head", "trusted checkout");

for (const workflow of [["CI", ci], ["Release", release]]) {
  const [label, text] = workflow;
  requireText(text, "record-ci-setup-metric.mjs", `${label} setup metrics`);
  requireText(text, "retention-days: 30", `${label} setup metric retention`);
  for (const forbidden of [".env", "node_modules", ".sqlite", ".sqlite3", "test-results", "playwright-report"]) {
    const artifactBlocks = text.split(/uses: actions\/upload-artifact@/).slice(1).filter((block) => block.includes("setup-metrics"));
    for (const block of artifactBlocks) forbidText(block.slice(0, 900), forbidden, `${label} setup metric artifact`);
  }
}

process.stdout.write("CI cache contract PASS (#444)\n");
