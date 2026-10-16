#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { diagnosticSubset, e2eSafety, inferRisk, inventory, isPathWithin, selectImpact, sourceEvidence } from "./prepr-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const validModes = new Set(["fast", "targeted", "ci-like", "diagnose", "docker"]);
const reportOnly = [
  { check: "GitHub QA Preflight / Trusted QA / Owner", state: "DEFERRED", reason: "GitHub PR metadata, protected base validator and signed approval required" },
  { check: "PR Required Quality/E2E/Docker aggregates", state: "DEFERRED", reason: "Exact PR head/base/test-merge/run/attempt must be verified by GitHub Actions" },
  { check: "6 independent Chromium runners and fail-fast", state: "DEFERRED", reason: "Local worker=1 cannot reproduce six GitHub runners" },
  { check: "npm audit --omit=dev", state: "DEFERRED", reason: "Requires npm registry and CI environment; run explicitly if available" },
  { check: "remote Compose/transport/GHCR", state: "DEFERRED", reason: "Local test never accesses production runtime or registry" },
];

function options(argv) {
  const value = { mode: "fast", includes: [], excludes: [], dryRun: false, base: "", issue: null, pr: null, risk: "", reportDir: "", failureLog: "" };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--dry-run") { value.dryRun = true; continue; }
    const eq = arg.indexOf("=");
    if (!arg.startsWith("--") || eq < 3) throw new Error(`Invalid option: ${arg}. Use --name=value.`);
    const key = arg.slice(2, eq), val = arg.slice(eq + 1);
    if (!val) throw new Error(`Empty option ${key}`);
    if (key === "include") value.includes.push(val);
    else if (key === "exclude") value.excludes.push(val);
    else if (key === "mode") value.mode = val;
    else if (key === "base") value.base = val;
    else if (key === "risk") value.risk = val.toUpperCase();
    else if (key === "report-dir") value.reportDir = val;
    else if (key === "failure-log") value.failureLog = val;
    else if (key === "issue" || key === "pr") {
      if (!/^[1-9][0-9]*$/.test(val)) throw new Error(`Invalid ${key}: ${val}`);
      value[key] = Number(val);
    } else throw new Error(`Unknown option: --${key}`);
  }
  if (!validModes.has(value.mode)) throw new Error(`Unknown mode: ${value.mode}`);
  if (value.mode === "diagnose" && (!value.failureLog || !value.pr)) {
    throw new Error("--mode=diagnose requires --pr=N and --failure-log=local.json");
  }
  if (value.mode !== "diagnose" && value.failureLog) throw new Error("--failure-log is diagnose-only");
  if (value.includes.some((x) => !x.startsWith("tests/")) ||
      value.excludes.some((x) => !x.startsWith("tests/"))) {
    throw new Error("Only repository tests/ files may be included or excluded");
  }
  return value;
}

function help() {
  console.log(`Pre-PR verify — never replaces GitHub PR CI
Usage: npm run verify:prepr -- --mode=fast [--base=origin/main] [--risk=HIGH] [--issue=699]
       npm run verify:prepr -- --mode=targeted --include=tests/e2e/project-task-editor.spec.ts
       npm run verify:prepr -- --mode=ci-like
       npm run verify:prepr -- --mode=diagnose --pr=695 --failure-log=.prepr-history.json
       npm run verify:prepr -- --mode=docker
Options: --include=tests/... (repeat), --exclude=tests/...:reason (repeat)
         --dry-run (plan only; NOT TESTED), --report-dir=.prepr-reports/custom-name
Node 22; git checkout with current base ref; no automatic npm ci, git reset/clean, or remote QA.
`);
}

function safeReportDir(relativeDir) {
  const path = relativeDir || join(".prepr-reports", `${new Date().toISOString().replaceAll(":", "-")}-${process.pid}-${randomUUID().slice(0, 8)}`);
  const absolute = resolve(root, path);
  const parent = resolve(root, ".prepr-reports");
  if (!isPathWithin(parent, absolute) || parent === absolute) throw new Error("Report must be inside .prepr-reports/<run>");
  let walk = root;
  for (const item of relative(root, absolute).split(sep)) {
    walk = join(walk, item);
    if (existsSync(walk) && lstatSync(walk).isSymbolicLink()) throw new Error(`Report symlink refused: ${walk}`);
  }
  if (existsSync(absolute)) throw new Error(`Report directory exists: ${absolute}`);
  mkdirSync(absolute, { recursive: true });
  return absolute;
}

function localVersions() {
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const installed = existsSync(resolve(root, "node_modules", "@playwright/test", "package.json"))
    ? JSON.parse(readFileSync(resolve(root, "node_modules", "@playwright/test", "package.json"), "utf8")).version
    : null;
  let browserRevision = null;
  const browsers = resolve(root, "node_modules", "playwright-core", "browsers.json");
  if (existsSync(browsers)) {
    const entries = JSON.parse(readFileSync(browsers, "utf8")).browsers || [];
    browserRevision = entries.find((entry) => entry.name === "chromium-headless-shell")?.revision ?? null;
  }
  const npm = spawnSync("npm", ["--version"], { cwd: root, encoding: "utf8", timeout: 10_000 });
  return {
    os: platform(), release: release(), cpuCount: cpus().length,
    node: process.version, npm: npm.status === 0 ? npm.stdout.trim() : null,
    packageVersion: pkg.version, lockVersion: lock.version,
    playwright: installed, chromiumRevision: browserRevision,
    ciNode: "22", ciPlaywright: pkg.devDependencies["@playwright/test"],
    chromiumExecutable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? "UNVERIFIED_OVERRIDE_BLOCKED_FOR_E2E" : "Playwright-managed (expected revision; actual browser launch is tested only by E2E)",
    e2e: { fullyParallel: true, workers: 1, shardsLocal: 1, shardsGitHub: 6, config: "tests/config/playwright.config.ts" },
  };
}

function assertInstall(versions) {
  if (Number(process.versions.node.split(".")[0]) !== 22) {
    throw new Error(`BLOCKED: Node ${process.version}; use Node 22 as configured by .github/workflows/ci.yml`);
  }
  if (versions.packageVersion !== versions.lockVersion) throw new Error("BLOCKED: package.json and package-lock.json versions differ");
  if (!existsSync(resolve(root, "node_modules", ".package-lock.json"))) throw new Error("BLOCKED: node_modules not installed by npm; manually run npm ci in a disposable worktree");
  if (versions.playwright !== versions.ciPlaywright) throw new Error("BLOCKED: installed Playwright differs from pinned package.json");
}

function safeChildEnvironment(extra = {}) {
  const env = { ...process.env, ...extra, CI_E2E_FULLY_PARALLEL: "true" };
  delete env.PLAYWRIGHT_BASE_URL;
  return env;
}

async function isPortAvailable(port) {
  return await new Promise((resolvePromise) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    const done = (free) => { socket.destroy(); resolvePromise(free); };
    socket.once("connect", () => done(false));
    socket.once("error", (error) => done(error.code === "ECONNREFUSED"));
    socket.setTimeout(1500, () => done(false));
  });
}

function assertE2eSafe() {
  const reserved = [
    ".data/playwright.sqlite3", ".data/playwright.sqlite3-wal", ".data/playwright.sqlite3-shm",
    ".next-e2e", "test-results", "playwright-report",
  ];
  const decision = e2eSafety({
    env: process.env, existing: reserved.filter((name) => existsSync(resolve(root, name))),
  });
  if (decision.state === "BLOCKED") throw new Error(`BLOCKED: ${decision.reasons.join("; ")}. Use an isolated worktree.`);
  return reserved;
}

function assertBuildSafe() {
  for (const name of [".next-prepr", ".runtime-tools"]) {
    if (existsSync(resolve(root, name))) throw new Error(`BLOCKED: existing build output ${name}; use a clean worktree.`);
  }
  return [".next-prepr", ".runtime-tools"];
}

function safeCleanup(paths) {
  for (const relativePath of paths) {
    const full = resolve(root, relativePath);
    if (!isPathWithin(root, full) || !relativePath || relativePath.startsWith("..")) continue;
    try {
      if (existsSync(full) && !lstatSync(full).isSymbolicLink()) rmSync(full, { recursive: true, force: true });
    } catch (error) { console.error(`Cleanup of own resource failed: ${relativePath}: ${error.message}`); }
  }
}

function keepE2eArtifacts(reportDir) {
  for (const name of ["test-results", "playwright-report"]) {
    const src = resolve(root, name);
    if (existsSync(src) && !lstatSync(src).isSymbolicLink()) renameSync(src, join(reportDir, name));
  }
}

function caseCount(label, output) {
  const patterns = label.includes("Chromium")
    ? [/\b(\d+) passed(?: \(|\b)/, /Total:\s*(\d+) tests?/]
    : [/Tests\s+(\d+) passed/, /Test Files\s+(\d+) passed/];
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

let activeChild = null;
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interrupted = true;
    if (activeChild && !activeChild.killed) activeChild.kill(signal);
  });
}

async function execute(label, cmd, args, env, records) {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  console.log(`\n[prepr] ${label}: ${cmd} ${args.join(" ")}`);
  let tail = "";
  const outcome = await new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: root, env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    activeChild = child;
    for (const [stream, target] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on("data", (data) => {
        target.write(data);
        tail = (tail + data.toString("utf8")).slice(-12_000);
      });
    }
    child.once("error", (error) => resolvePromise({ exitCode: null, error: error.message }));
    child.once("close", (code, signal) => resolvePromise({ exitCode: code, signal }));
  });
  activeChild = null;
  const record = {
    label, command: [cmd, ...args], startedAt, durationMs: Date.now() - startedMs,
    exitCode: outcome.exitCode, signal: outcome.signal ?? null,
    status: outcome.error ? "BLOCKED" : outcome.exitCode === 0 && !interrupted ? "PASS" : "FAIL",
    caseCount: caseCount(label, tail),
    ...(outcome.error ? { reason: outcome.error } : {}),
  };
  records.push(record);
  return record.status === "PASS";
}

function markdown(report) {
  const table = report.steps.map((step) =>
    `| ${step.label.replaceAll("|", "/")} | ${step.status} | ${step.exitCode ?? "N/A"} | ${step.caseCount ?? "NOT TESTED"} | ${step.durationMs} |`).join("\n");
  return `# Local Pre-PR Verify — ${report.status}

- Issue: ${report.issue ?? "N/A"}, PR: ${report.pr ?? "N/A"}, mode: ${report.mode}, risk: ${report.risk}
- Base: ${report.sourceStart?.baseRef} (${report.sourceStart?.baseSha})
- Head: ${report.sourceStart?.headSha}; working fingerprint: ${report.sourceStart?.fingerprint}
- End source: ${report.sourceEnd?.fingerprint || "NOT TESTED"}; source stable: ${report.sourceStable}
- Platform: ${report.versions?.os}/${report.versions?.release}, Node ${report.versions?.node}, npm ${report.versions?.npm}
- Playwright: ${report.versions?.playwright || "NOT TESTED"}, Chromium *expected metadata revision*: ${report.versions?.chromiumRevision || "NOT TESTED"}, executable: ${report.versions?.chromiumExecutable || "NOT TESTED"}
- Changed paths: ${report.sourceStart?.changed.length ?? "NOT TESTED"}
- Selection: ${report.selection?.state ?? "NOT TESTED"}, selected ${report.selection?.selected.length ?? "NOT TESTED"} tests, UNKNOWN ${report.selection?.unknown.length ?? 0}, missing ${report.selection?.missing.length ?? 0}
- Residual risks: ${report.errors.length ? report.errors.join("; ") : "Exact-head remote checks remain deferred"}

| Command | State | Exit | Unique cases (if parsable) | ms |
| --- | --- | --- | --- | --- |
${table || "| (none; NOT TESTED) | NOT TESTED | N/A | N/A | N/A |"}

## CI-only / deferred
${report.deferred.map((x) => `- ${x.check}: ${x.state} — ${x.reason}`).join("\n")}

## Selected tests and reasons
${(report.selection?.selected ?? []).map((x) => `- ${x.path} [${x.kind}]: ${x.reasons.join("; ")}`).join("\n") || "- NOT TESTED / no file selected"}

## Excluded, unknown and missing
${[...(report.selection?.excluded ?? []).map((x) => `excluded ${x.path}: ${x.reason}`), ...(report.selection?.unknown ?? []).map((x) => `UNKNOWN ${x.path}: ${x.reason}`), ...(report.selection?.missing ?? []).map((x) => `MISSING ${x.path}: ${x.reason}`)].map((x) => "- " + x).join("\n") || "- None"}

- Playwright traces/report: ${report.artifacts.length ? report.artifacts.join(", ") : "NOT TESTED"}
- Manager/Owner acceptance: NOT TESTED. Local PASS does not approve a merge.
`;
}

async function main() {
  let opt;
  try { opt = options(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 2; return; }
  if (opt.help) { help(); return; }
  const result = {
    schemaVersion: 1, tool: "mastergantt-prepr", issue: opt.issue, pr: opt.pr, mode: opt.mode,
    status: "NOT TESTED", startedAt: new Date().toISOString(),
    sourceStart: null, sourceEnd: null, sourceStable: false,
    versions: null, risk: null, selection: null, diagnostic: null,
    steps: [], deferred: [...reportOnly], errors: [], artifacts: [],
  };
  let reportDir = null;
  let buildResources = [], browserResources = [];
  let browserStarted = false;
  try {
    reportDir = safeReportDir(opt.reportDir);
    result.sourceStart = sourceEvidence(root, opt.base);
    result.versions = localVersions();
    const tests = inventory(root);
    result.risk = opt.risk || inferRisk(result.sourceStart.changed);
    result.selection = selectImpact({ changed: result.sourceStart.changed, tests, risk: result.risk, includes: opt.includes, excludes: opt.excludes });
    if (opt.mode === "diagnose") {
      const file = resolve(root, opt.failureLog);
      if (!isPathWithin(root, file) || !existsSync(file)) throw new Error("BLOCKED: diagnose evidence file must be a local readable path inside repository");
      result.diagnostic = diagnosticSubset(JSON.parse(readFileSync(file, "utf8")), tests.e2e, opt.pr);
    }
    if (opt.dryRun) {
      result.errors.push("Dry run only; no tests executed");
      result.status = "NOT TESTED";
      return;
    }
    assertInstall(result.versions);
    if (result.selection.state === "BLOCKED") {
      throw new Error("BLOCKED: unknown/missing impacted tests; Manager must map scope before local PASS");
    }
    const env = safeChildEnvironment();
    const run = (label, cmd, args, additions = {}) => execute(label, cmd, args, { ...env, ...additions }, result.steps);
    if (opt.mode === "fast" || opt.mode === "ci-like") {
      const policy = [
        ["Version contract", "node", ["scripts/verify-release-version.mjs"]],
        ["Test discovery", "node", ["scripts/verify-test-discovery.mjs"]],
        ["Markdown links", "node", ["scripts/check-markdown-links.mjs"]],
        ["CI cache contract", "node", ["scripts/verify-ci-cache-contract.mjs"]],
        ["Local QA fixture policy", "python3", ["scripts/test_qa_preflight.py"]],
      ];
      for (const [label, cmd, args] of policy) if (!await run(label, cmd, args)) throw new Error(`FAILED: ${label}`);
      if (!await run("Dependencies", "npm", ["ls", "--depth=0", "--offline"])) throw new Error("FAILED: Dependencies");
      for (const [label, args] of [
        ["Typecheck", ["run", "typecheck"]],
        ["Lint", ["run", "lint"]],
        ["Unit", ["test"]],
      ]) if (!await run(label, "npm", args)) throw new Error(`FAILED: ${label}`);
      buildResources = assertBuildSafe();
      if (!await run("Production build", "npm", ["run", "build"], { NEXT_DIST_DIR: ".next-prepr" })) throw new Error("FAILED: Production build");
    }
    if (["targeted", "ci-like", "diagnose"].includes(opt.mode)) {
      if (opt.mode === "targeted" && result.selection.selected.some((x) => x.kind === "unit")) {
        const units = result.selection.selected.filter((x) => x.kind === "unit").map((x) => x.path);
        if (!await run("Targeted Unit", "npm", ["test", "--", ...units])) throw new Error("FAILED: Targeted Unit");
      }
      const e2e = opt.mode === "diagnose" ? result.diagnostic.files
        : opt.mode === "ci-like" ? []
        : result.selection.selected.filter((x) => x.kind === "chromium").map((x) => x.path);
      if (opt.mode !== "targeted" || e2e.length) {
        browserResources = assertE2eSafe();
        if (e2eSafety({ portFree: await isPortAvailable(3100) }).state === "BLOCKED") throw new Error("BLOCKED: port 3100 in use/unknown; refusing to stop an existing server");
        browserStarted = true;
        const args = ["run", "test:e2e", "--", "--project=chromium", "--workers=1", "--retries=0",
          ...(opt.mode === "diagnose" ? ["--max-failures=0"] : []), ...e2e];
        if (!await run("Chromium E2E", "npm", args)) throw new Error("FAILED: Chromium E2E");
      } else {
        result.deferred.push({ check: "Chromium E2E", state: "NOT TESTED", reason: "No browser file selected by mapped changes" });
      }
    }
    if (opt.mode === "docker") {
      const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { cwd: root, encoding: "utf8", timeout: 12_000 });
      if (docker.status !== 0) throw new Error("BLOCKED: Docker daemon not available for local build");
      const tag = `mastergantt-prepr-${process.pid}-${randomUUID().slice(0, 8)}:check`;
      try {
        if (!await run("Docker build", "docker", ["build", "-f", "deploy/docker/Dockerfile", "--build-arg", `VERSION=prepr-${result.sourceStart.headSha.slice(0, 12)}`, "-t", tag, "."])) throw new Error("FAILED: Docker build");
        if (!await run("Docker image policy", "sh", ["scripts/verify-image-policy.sh", tag])) throw new Error("FAILED: Docker image policy");
      } finally {
        const inspect = spawnSync("docker", ["image", "inspect", tag], { cwd: root, stdio: "ignore" });
        if (inspect.status === 0) spawnSync("docker", ["image", "rm", tag], { cwd: root, stdio: "ignore" });
      }
    }
    result.status = result.steps.length && result.steps.every((x) => x.status === "PASS") ? "PASS" : "NOT TESTED";
  } catch (error) {
    result.errors.push(error.message);
    result.status = error.message.startsWith("FAILED:") ? "FAIL" : "BLOCKED";
  } finally {
    if (reportDir) {
      try { if (browserStarted) keepE2eArtifacts(reportDir); } catch (error) { result.errors.push(`Artifact move failed: ${error.message}`); result.status = "BLOCKED"; }
      for (const name of ["playwright-report", "test-results"]) if (existsSync(join(reportDir, name))) result.artifacts.push(join(reportDir, name));
    }
    safeCleanup(browserResources.filter((x) => !["test-results", "playwright-report"].includes(x)));
    safeCleanup(buildResources);
    if (result.sourceStart) {
      try {
        result.sourceEnd = sourceEvidence(root, opt.base);
        result.sourceStable = result.sourceEnd.fingerprint === result.sourceStart.fingerprint;
        if (!result.sourceStable) { result.errors.push("STALE: working source/base/head changed during local verification"); result.status = "BLOCKED"; }
      } catch (error) { result.errors.push(`Cannot prove source stability: ${error.message}`); result.status = "BLOCKED"; }
    }
    if (interrupted) { result.status = "BLOCKED"; result.errors.push("Interrupted: unfinished checks are NOT TESTED"); }
    result.completedAt = new Date().toISOString();
    if (reportDir) {
      writeFileSync(join(reportDir, "report.json"), JSON.stringify(result, null, 2) + "\n");
      writeFileSync(join(reportDir, "SUMMARY.md"), markdown(result));
      console.log(`\n[prepr] ${result.status}. Report: ${join(reportDir, "SUMMARY.md")}`);
    } else console.error(`[prepr] ${result.status}: ${result.errors.join("; ")}`);
    if (result.status !== "PASS" && !(opt.dryRun && result.status === "NOT TESTED")) process.exitCode = 1;
  }
}
await main();
