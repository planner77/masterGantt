#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createConnection } from "node:net";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMON_CHECKS, diagnosticSubset, e2eSafety, environmentEvidence, evaluateAdmission, inferRisk, inventory, isPathWithin, reportChecksum, runnerCompletion, runnerCoverage, selectImpact, sourceEvidence } from "./prepr-core.mjs";
import { createBrowserSnapshot, inspectBrowserSnapshot, removeBrowserSnapshot, snapshotRunnerRoot, validateSnapshotAudit } from "./prepr-snapshot.mjs";
import { buildLocalImage, validateLocalImageEvidence } from "./prepr-docker.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const validModes = new Set(["fast", "targeted", "ci-like", "diagnose", "docker", "admit"]);
const reportOnly = [
  { check: "운영 배포/백업·격리 복원/Owner 제품 수용", state: "NOT TESTED", reason: "로컬 검사와 실제 운영·사람의 수용은 별도 증거입니다." },
];

function options(argv) {
  const value = { mode: "fast", includes: [], excludes: [], dryRun: false, base: "", issue: null, pr: null, risk: "", reportDir: "", failureLog: "", reports: [] };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--dry-run") { value.dryRun = true; continue; }
    const eq = arg.indexOf("=");
    if (!arg.startsWith("--") || eq < 3) throw new Error(`Invalid option: ${arg}. Use --name=value.`);
    const key = arg.slice(2, eq), val = arg.slice(eq + 1);
    if (!val) throw new Error(`Empty option ${key}`);
    if (key === "reports") value.reports.push(val);
    else if (key === "include") value.includes.push(val);
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
  if (value.mode === "admit" && (value.dryRun || value.excludes.length || value.failureLog)) throw new Error("admit 모드는 실행 결과만 검증하며 테스트 제외를 허용하지 않습니다.");
  if (value.mode !== "admit" && value.reports.length) throw new Error("--reports는 admit 전용입니다.");
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
  console.log(`로컬 Issue 검증 — PR/원격 CI를 실행하지 않습니다
Usage: npm run verify:prepr -- --mode=fast [--base=origin/main] [--risk=HIGH] [--issue=699]
       npm run verify:prepr -- --mode=targeted --include=tests/e2e/project-task-editor.spec.ts
       npm run verify:prepr -- --mode=ci-like
       npm run verify:prepr -- --mode=diagnose --pr=695 --failure-log=.prepr-history.json
       npm run verify:prepr -- --mode=docker
       npm run verify:prepr -- --mode=admit [--reports=.prepr-reports/<run>/report.json]
Options: --include=tests/... (repeat), --exclude=tests/...:reason (repeat)
         --dry-run (plan only; NOT TESTED), --report-dir=.prepr-reports/custom-name
Node >=22; 고정 base의 격리 checkout을 사용합니다. npm ci는 먼저 직접 실행합니다.
fast/targeted/docker의 PASS는 해당 범위 결과입니다. 게시 전 admit는 동일 clean Head/source/env의 공통·영향·Docker 결과를 합쳐 검사합니다.
ci-like는 로컬 모드입니다. diagnose는 과거 실패 자료의 읽기 전용 조사이며 게시 근거가 아닙니다.
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
    requiredNode: pkg.engines.node, pinnedPlaywright: pkg.devDependencies["@playwright/test"],
    chromiumExecutable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? "UNVERIFIED_OVERRIDE_BLOCKED_FOR_E2E" : "Playwright-managed (expected revision; actual browser launch is tested only by E2E)",
    e2e: { fullyParallel: true, workers: 1, shardsLocal: 1, config: "tests/config/playwright.config.ts" },
  };
}

function assertInstall(versions) {
  if (Number(process.versions.node.split(".")[0]) < 22) {
    throw new Error(`BLOCKED: Node ${process.version}; package.json engines의 Node >=22를 사용하세요`);
  }
  if (versions.packageVersion !== versions.lockVersion) throw new Error("BLOCKED: package.json and package-lock.json versions differ");
  if (!existsSync(resolve(root, "node_modules", ".package-lock.json"))) throw new Error("BLOCKED: node_modules not installed by npm; manually run npm ci in a disposable worktree");
  if (versions.playwright !== versions.pinnedPlaywright) throw new Error("BLOCKED: installed Playwright differs from pinned package.json");
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
  for (const name of [".next", ".runtime-tools"]) {
    if (existsSync(resolve(root, name))) throw new Error(`BLOCKED: existing build output ${name}; use a clean worktree.`);
  }
  return [".next", ".runtime-tools"];
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

function keepE2eArtifacts(reportDir, executionRoot) {
  for (const name of ["test-results", "playwright-report"]) {
    const src = resolve(executionRoot, name);
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

async function execute(label, cmd, args, env, records, reportDir, plannedTests = [], executionRoot = root, requiredTests = plannedTests) {
  const runner = ["Unit", "Targeted Unit"].includes(label) ? "vitest" : label === "Chromium E2E" ? "playwright" : null;
  const resultFile = runner === "vitest" ? "vitest-results.json" : "chromium-results.json";
  if (runner === "vitest") args = [...args, ...(args.includes("--") ? [] : ["--"]), "--reporter=default", "--reporter=json", `--outputFile=${join(reportDir, resultFile)}`];
  if (runner === "playwright") {
    args = [...args.slice(0, 6), "--reporter=list,json,html", ...args.slice(6)];
    env = { ...env, PLAYWRIGHT_JSON_OUTPUT_FILE: join(reportDir, resultFile) };
  }
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  console.log(`\n[prepr] ${label}: ${cmd} ${args.join(" ")}`);
  let tail = "";
  const logFile = `step-${records.length + 1}.log`;
  const outputHash = createHash("sha256");
  writeFileSync(join(reportDir, logFile), "");
  const outcome = await new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: executionRoot, env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    activeChild = child;
    for (const [stream, target] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      stream.on("data", (data) => {
        target.write(data);
        appendFileSync(join(reportDir, logFile), data);
        outputHash.update(data);
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
    plannedTests, requiredTests, coveredTests: [], executionRoot,
    logFile,
    logSha256: outputHash.digest("hex"),
    status: outcome.error ? "BLOCKED" : outcome.exitCode === 0 && !interrupted ? "PASS" : "FAIL",
    caseCount: caseCount(label, tail),
    ...(outcome.error ? { reason: outcome.error } : {}),
  };
  if (runner) {
    try {
      const bytes = readFileSync(join(reportDir, resultFile));
      const fileResults = runnerCoverage(runner, JSON.parse(bytes.toString("utf8")), executionRoot);
      const completion = runnerCompletion(fileResults, plannedTests, requiredTests, { allowDependencyBenchmarkSkip: label === "Unit" && env.RUN_TASK_DEPENDENCY_BENCHMARK !== "1" });
      record.runner = { kind: runner, resultFile, resultSha256: createHash("sha256").update(bytes).digest("hex"), fileResults, completion };
      record.coveredTests = fileResults.filter((file) => file.passed > 0 && file.failed === 0).map((file) => file.path);
      record.caseCount = fileResults.reduce((sum, file) => sum + file.passed, 0);
      if (record.status === "PASS" && completion.status !== "PASS") { record.status = "BLOCKED"; record.reason = "전체 실행 대상의 보고가 누락됐거나 필수 영향 test file이 통과하지 않았습니다(skip-only 포함)."; }
    } catch (error) {
      if (record.status === "PASS") record.status = "BLOCKED";
      record.reason = `Runner JSON 근거를 읽지 못했습니다: ${error.message}`;
    }
  }
  records.push(record);
  return record.status === "PASS";
}

function markdown(report) {
  const table = report.steps.map((step) =>
    `| ${step.label.replaceAll("|", "/")} | ${step.status} | ${step.exitCode ?? "N/A"} | ${step.caseCount ?? "NOT TESTED"}${step.runner?.completion ? ` PASS / ${step.runner.completion.counts.failed} FAIL / ${step.runner.completion.counts.skipped} SKIP` : ""} | ${step.durationMs} |`).join("\n");
  return `# 로컬 Issue 검증 — ${report.status}

- Issue: ${report.issue ?? "N/A"}, PR: ${report.pr ?? "N/A"}, mode: ${report.mode}, risk: ${report.risk}
- Base: ${report.sourceStart?.baseRef} (${report.sourceStart?.baseSha})
- Head: ${report.sourceStart?.headSha}; working fingerprint: ${report.sourceStart?.fingerprint}
- End source: ${report.sourceEnd?.fingerprint || "NOT TESTED"}; source stable: ${report.sourceStable}
- Platform: ${report.versions?.os}/${report.versions?.release}, Node ${report.versions?.node}, npm ${report.versions?.npm}
- Playwright: ${report.versions?.playwright || "NOT TESTED"}, Chromium *expected metadata revision*: ${report.versions?.chromiumRevision || "NOT TESTED"}, executable: ${report.versions?.chromiumExecutable || "NOT TESTED"}
- Changed paths: ${report.sourceStart?.changed.length ?? "NOT TESTED"}
- Selection: ${report.selection?.state ?? "NOT TESTED"}, selected ${report.selection?.selected.length ?? "NOT TESTED"} tests, UNKNOWN ${report.selection?.unknown.length ?? 0}, missing ${report.selection?.missing.length ?? 0}
- Residual risks: ${report.errors.length ? report.errors.join("; ") : "실행한 로컬 범위만 PASS; 게시 적격성은 admit에서 별도 검사"}

| Command | State | Exit | Unique cases (if parsable) | ms |
| --- | --- | --- | --- | --- |
${table || "| (none; NOT TESTED) | NOT TESTED | N/A | N/A | N/A |"}

## 실행되지 않은 테스트
${report.steps.flatMap((step) => (step.runner?.completion?.notTestedFiles ?? []).map((file) => `- ${file.path}: NOT TESTED (${file.skippedCases} SKIP) — ${file.reason}`)).join("\n") || "- 없음"}

## 별도 환경/수용 증거
${report.deferred.map((x) => `- ${x.check}: ${x.state} — ${x.reason}`).join("\n")}

## Selected tests and reasons
${(report.selection?.selected ?? []).map((x) => `- ${x.path} [${x.kind}]: ${x.reasons.join("; ")}`).join("\n") || "- NOT TESTED / no file selected"}

## Excluded, unknown and missing
${[...(report.selection?.excluded ?? []).map((x) => `excluded ${x.path}: ${x.reason}`), ...(report.selection?.unknown ?? []).map((x) => `UNKNOWN ${x.path}: ${x.reason}`), ...(report.selection?.missing ?? []).map((x) => `MISSING ${x.path}: ${x.reason}`)].map((x) => "- " + x).join("\n") || "- None"}

- Playwright traces/report: ${report.artifacts.length ? report.artifacts.join(", ") : "NOT TESTED"}
- Manager/Owner acceptance: NOT TESTED. 범위별 로컬 PASS는 게시 또는 운영 배포 승인이 아닙니다.
`;
}

async function main() {
  let opt;
  try { opt = options(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 2; return; }
  if (opt.help) { help(); return; }
  const result = {
    schemaVersion: 2, tool: "mastergantt-local-verify", issue: opt.issue, pr: opt.pr, mode: opt.mode,
    status: "NOT TESTED", dryRun: opt.dryRun, interrupted: false, startedAt: new Date().toISOString(),
    sourceStart: null, sourceEnd: null, sourceStable: false,
    environmentStart: null, environmentEnd: null, environmentStable: false,
    versions: null, risk: null, selection: null, diagnostic: null,
    steps: [], deferred: [...reportOnly], errors: [], artifacts: [],
  };
  let reportDir = null;
  let buildResources = [];
  let browserStarted = false;
  let browserSnapshot = null;
  try {
    reportDir = safeReportDir(opt.reportDir);
    result.sourceStart = sourceEvidence(root, opt.base);
    result.versions = localVersions();
    result.environmentStart = environmentEvidence(root);
    const tests = inventory(root);
    result.risk = opt.risk || inferRisk(result.sourceStart.changed);
    result.selection = selectImpact({ changed: result.sourceStart.changed, tests, risk: result.risk, includes: opt.includes, excludes: opt.excludes });
    if (opt.mode === "admit") {
      if (spawnSync("git", ["merge-base", "--is-ancestor", result.sourceStart.baseSha, result.sourceStart.headSha], { cwd: root, stdio: "ignore" }).status !== 0) throw new Error("BLOCKED: base는 검증 Head의 ancestor여야 합니다.");
      const paths = new Set(opt.reports);
      // Inspect saved receipts as well: a newer failed/cancelled same-source run
      // must not be hidden by explicitly selecting an older green report.
      const walk = (directory) => {
        if (!existsSync(directory)) return;
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          if (entry.isSymbolicLink()) continue;
          const path = join(directory, entry.name);
          if (entry.isDirectory() && !["test-results", "playwright-report", "browser-source"].includes(entry.name)) walk(path);
          else if (entry.isFile() && entry.name === "report.json") paths.add(relative(root, path));
        }
      };
      walk(resolve(root, ".prepr-reports"));
      const checkedFile = (file) => {
        if (!isPathWithin(resolve(root, ".prepr-reports"), file)) throw new Error("BLOCKED: 보고서 artifact 경로가 허용 범위를 벗어났습니다.");
        let current = root;
        for (const part of relative(root, file).split(sep)) {
          current = join(current, part);
          if (lstatSync(current).isSymbolicLink()) throw new Error("BLOCKED: 보고서/artifact symlink는 허용하지 않습니다.");
        }
        if (!lstatSync(file).isFile()) throw new Error("BLOCKED: 보고서 artifact는 일반 파일이어야 합니다.");
        return readFileSync(file);
      };
      const reports = [];
      const receipts = [];
      for (const path of paths) {
        const absolute = resolve(root, path);
        if (!isPathWithin(resolve(root, ".prepr-reports"), absolute) || lstatSync(absolute).isSymbolicLink()) throw new Error("BLOCKED: 보고서는 .prepr-reports 내부의 일반 파일이어야 합니다.");
        const report = JSON.parse(checkedFile(absolute).toString("utf8"));
        if (report.mode !== "admit" && report.mode !== "diagnose") { reports.push(report); receipts.push({ report, absolute }); }
      }
      // Every historical report still goes through schema/checksum/source/time
      // validation below. Only the latest successful attempt per mode supplies
      // artifacts; cancelled older attempts legitimately may have no runner JSON.
      const latest = new Map();
      for (const receipt of receipts.filter(({ report }) => report.sourceStart?.fingerprint === result.sourceStart.fingerprint).sort((a, b) => Date.parse(a.report.completedAt) - Date.parse(b.report.completedAt))) latest.set(receipt.report.mode, receipt);
      for (const { report, absolute } of latest.values()) {
        if (report.status !== "PASS") continue;
          for (const step of report.steps ?? []) {
            if (!/^step-[0-9]+\.log$/.test(step.logFile ?? "")) throw new Error("BLOCKED: 실행 로그 경로가 유효하지 않습니다.");
            const log = checkedFile(resolve(dirname(absolute), step.logFile));
            if (createHash("sha256").update(log).digest("hex") !== step.logSha256) throw new Error("BLOCKED: 실행 로그 bytes/checksum이 다릅니다.");
            if (["Unit", "Targeted Unit", "Chromium E2E"].includes(step.label)) {
              const runner = step.runner;
              const expectedFile = step.label === "Chromium E2E" ? "chromium-results.json" : "vitest-results.json";
              if (!runner || runner.resultFile !== expectedFile || runner.kind !== (step.label === "Chromium E2E" ? "playwright" : "vitest")) throw new Error("BLOCKED: test runner 근거가 없습니다.");
              const bytes = checkedFile(resolve(dirname(absolute), expectedFile));
              const executionRoot = step.label === "Chromium E2E" ? snapshotRunnerRoot(dirname(absolute), step.executionRoot) : root;
              const files = runnerCoverage(runner.kind, JSON.parse(bytes.toString("utf8")), executionRoot);
              const coverage = files.filter((file) => file.passed > 0 && file.failed === 0).map((file) => file.path);
              if (runner.resultSha256 !== createHash("sha256").update(bytes).digest("hex") || JSON.stringify(files) !== JSON.stringify(runner.fileResults) || JSON.stringify(coverage) !== JSON.stringify(step.coveredTests) || step.caseCount !== files.reduce((sum, file) => sum + file.passed, 0)) throw new Error("BLOCKED: 실제 runner 결과/통과 coverage가 보고서와 다릅니다.");
              const requiredTests = result.selection.selected.filter((test) => test.kind === (step.label === "Chromium E2E" ? "chromium" : "unit")).map((test) => test.path);
              const expectedTests = step.label === "Unit" ? tests.unit : step.label === "Chromium E2E" && report.mode === "ci-like" ? tests.e2e : requiredTests;
              const completion = runnerCompletion(files, expectedTests, requiredTests, { allowDependencyBenchmarkSkip: step.label === "Unit" && process.env.RUN_TASK_DEPENDENCY_BENCHMARK !== "1" });
              if (JSON.stringify(step.plannedTests) !== JSON.stringify(expectedTests) || JSON.stringify(step.requiredTests) !== JSON.stringify(requiredTests) || completion.status !== "PASS" || JSON.stringify(runner.completion) !== JSON.stringify(completion)) throw new Error("BLOCKED: 전체 runner 파일 보고/필수 영향 검사/미실행 근거가 현재 계획과 다릅니다.");
            }
          }
          if ((report.steps ?? []).some((step) => step.label === "Chromium E2E")) {
            if (report.browserSnapshot?.auditFile !== "browser-source-audit.json") throw new Error("BLOCKED: browser snapshot audit가 없습니다.");
            const bytes = checkedFile(resolve(dirname(absolute), report.browserSnapshot.auditFile));
            if (createHash("sha256").update(bytes).digest("hex") !== report.browserSnapshot.auditSha256) throw new Error("BLOCKED: browser snapshot audit bytes가 다릅니다.");
            const verification = validateSnapshotAudit(JSON.parse(bytes.toString("utf8")), result.sourceStart);
            if (report.browserSnapshot.status !== "PASS" || JSON.stringify(report.browserSnapshot.verification) !== JSON.stringify(verification)) throw new Error("BLOCKED: browser snapshot 생성 metadata 검증 결과가 다릅니다.");
          }
      }
      result.admission = evaluateAdmission({ reports, source: result.sourceStart, environment: result.environmentStart, selection: result.selection, issue: opt.issue });
      if (result.admission.publishAllowed && result.admission.requirements.docker) {
        const receipt = reports.filter((report) => report.sourceStart?.fingerprint === result.sourceStart.fingerprint && report.mode === "docker").sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))[0];
        const proof = receipt?.dockerImage;
        const checked = spawnSync("docker", ["image", "inspect", "--format", "{{json .}}", proof.id, proof.tag], { cwd: root, encoding: "utf8", timeout: 12000 });
        let identityValid = checked.status === 0;
        if (identityValid) {
          try {
            const images = checked.stdout.trim().split("\n").map((line) => JSON.parse(line));
            identityValid = images.length === 2 && images.every((image) => image.Id === proof.id && image.Os === "linux" && image.Architecture === "amd64" && image.Config.Labels["org.opencontainers.image.revision"] === result.sourceStart.headSha && image.Config.Labels["org.opencontainers.image.source"] === "https://github.com/planner77/masterGantt");
          } catch { identityValid = false; }
        }
        if (!identityValid) {
          result.admission.status = "BLOCKED"; result.admission.publishAllowed = false;
          result.admission.reasons.push("검증한 로컬 Docker image ID/tag/platform/revision/source를 현재 daemon에서 확인하지 못했습니다.");
        }
        try { validateLocalImageEvidence({ root, image: proof, source: result.sourceStart, version: result.versions.packageVersion }); }
        catch (error) { result.admission.status = "BLOCKED"; result.admission.publishAllowed = false; result.admission.reasons.push(error.message); }
      }
      result.status = result.admission.status;
      result.errors.push(...result.admission.reasons);
      return;
    }
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
    const environmentSafety = e2eSafety({ env: process.env });
    if (environmentSafety.state === "BLOCKED") throw new Error(`BLOCKED: ${environmentSafety.reasons.join("; ")}`);
    if (result.selection.state === "BLOCKED") {
      throw new Error("BLOCKED: unknown/missing impacted tests; Manager must map scope before local PASS");
    }
    const env = safeChildEnvironment();
    const run = (label, cmd, args, additions = {}, plannedTests = [], requiredTests = plannedTests) => execute(label, cmd, args, { ...env, ...additions }, result.steps, reportDir, plannedTests, root, requiredTests);
    if (opt.mode === "fast" || opt.mode === "ci-like") {
      for (const [label, [cmd, ...args]] of Object.entries(COMMON_CHECKS)) {
        if (label === "Production build") continue;
        if (!await run(label, cmd, args, {}, label === "Unit" ? tests.unit : [], label === "Unit" ? result.selection.selected.filter((test) => test.kind === "unit").map((test) => test.path) : [])) throw new Error(`FAILED: ${label}`);
      }
      buildResources = assertBuildSafe();
      if (!await run("Production build", "npm", ["run", "build"], { NEXT_DIST_DIR: "" })) throw new Error("FAILED: Production build");
    }
    if (["targeted", "ci-like", "diagnose"].includes(opt.mode)) {
      if (opt.mode === "targeted" && result.selection.selected.some((x) => x.kind === "unit")) {
        const units = result.selection.selected.filter((x) => x.kind === "unit").map((x) => x.path);
        if (!await run("Targeted Unit", "npm", ["test", "--", "--maxWorkers=2", ...units], {}, units)) throw new Error("FAILED: Targeted Unit");
      }
      const e2e = opt.mode === "diagnose" ? result.diagnostic.files
        : opt.mode === "ci-like" ? []
        : result.selection.selected.filter((x) => x.kind === "chromium").map((x) => x.path);
      if (opt.mode !== "targeted" || e2e.length) {
        assertE2eSafe();
        if (e2eSafety({ portFree: await isPortAvailable(3100) }).state === "BLOCKED") throw new Error("BLOCKED: port 3100 in use/unknown; refusing to stop an existing server");
        browserSnapshot = createBrowserSnapshot(root, reportDir, result.sourceStart);
        browserStarted = true;
        const args = ["run", "test:e2e", "--", "--project=chromium", "--workers=1", "--retries=0",
          ...(opt.mode === "diagnose" ? ["--max-failures=0"] : []), ...e2e];
        const requiredTests = opt.mode === "diagnose" ? e2e : result.selection.selected.filter((test) => test.kind === "chromium").map((test) => test.path);
        if (!await execute("Chromium E2E", "npm", args, env, result.steps, reportDir, e2e.length ? e2e : tests.e2e, browserSnapshot.snapshotRoot, requiredTests)) throw new Error("FAILED: Chromium E2E");
      } else {
        result.deferred.push({ check: "Chromium E2E", state: "NOT TESTED", reason: "No browser file selected by mapped changes" });
      }
    }
    if (opt.mode === "docker") {
      const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { cwd: root, encoding: "utf8", timeout: 12_000 });
      if (docker.status !== 0) throw new Error("BLOCKED: Docker daemon not available for local build");
      const containerName = "mastergantt-w22-local";
      if (spawnSync("docker", ["container", "inspect", containerName], { cwd: root, stdio: "ignore" }).status === 0) throw new Error("BLOCKED: 기존 smoke container를 재사용하거나 중단하지 않습니다.");
      let ownedContainer = false;
      let dockerVerified = false;
      const ownerLabel = `mastergantt.local-verify=${randomUUID()}`;
      let tag = null;
      try {
        const builtImage = await buildLocalImage({ root, reportDir, source: result.sourceStart, version: result.versions.packageVersion, run });
        tag = builtImage.tag;
        if (!await run("Docker image policy", "sh", ["scripts/verify-image-policy.sh", tag])) throw new Error("FAILED: Docker image policy");
        const started = await run("Docker runtime start", "docker", ["run", "--detach", "--name", containerName, "--label", ownerLabel, "--env", "APP_BASE_URL=https://gantt.example.invalid", "--publish", "127.0.0.1::3000", tag]);
        ownedContainer = started;
        if (!started) throw new Error("FAILED: Docker runtime start");
        const published = spawnSync("docker", ["port", containerName, "3000/tcp"], { cwd: root, encoding: "utf8" });
        const address = published.stdout?.trim();
        if (published.status !== 0 || !/^127\.0\.0\.1:[0-9]+$/.test(address)) throw new Error("BLOCKED: 격리 smoke 포트를 확인하지 못했습니다.");
        const baseUrl = `http://${address}`;
        const readiness = `const url=${JSON.stringify(baseUrl + "/api/health/ready")}; let ready=false; for(let i=0;i<90;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(2000)}); if(r.ok){ready=true;break;}}catch{} await new Promise(r=>setTimeout(r,1000));} if(!ready)process.exit(1);`;
        if (!await run("Docker readiness", "node", ["--input-type=module", "-e", readiness])) throw new Error("FAILED: Docker readiness");
        if (!await run("Docker API/SQLite persistence", "node", ["scripts/verify-registry-api-smoke.mjs", baseUrl, containerName])) throw new Error("FAILED: Docker API/SQLite persistence");
        const sqlite = "const D=require('better-sqlite3'); const db=new D(process.env.DATABASE_PATH,{readonly:true}); if(db.pragma('integrity_check',{simple:true})!=='ok'||db.pragma('foreign_key_check').length)process.exit(1); db.close();";
        if (!await run("Docker SQLite integrity", "docker", ["exec", containerName, "node", "-e", sqlite])) throw new Error("FAILED: Docker SQLite integrity");
        const identity = spawnSync("docker", ["image", "inspect", "--format", "{{json .}}", tag], { cwd: root, encoding: "utf8" });
        if (identity.status !== 0) throw new Error("BLOCKED: 검증 이미지 ID를 확인하지 못했습니다.");
        const image = JSON.parse(identity.stdout);
        if (image.Os !== "linux" || image.Architecture !== "amd64" || image.Config.Labels["org.opencontainers.image.revision"] !== result.sourceStart.headSha) throw new Error("BLOCKED: 검증 이미지 platform/revision이 다릅니다.");
        validateLocalImageEvidence({ root, image: builtImage, source: result.sourceStart, version: result.versions.packageVersion });
        result.dockerImage = builtImage;
        dockerVerified = true;
      } finally {
        const owner = spawnSync("docker", ["container", "inspect", "--format", '{{index .Config.Labels "mastergantt.local-verify"}}', containerName], { cwd: root, encoding: "utf8" });
        ownedContainer = owner.status === 0 && owner.stdout.trim() === ownerLabel.slice(ownerLabel.indexOf("=") + 1);
        if (ownedContainer && spawnSync("docker", ["rm", "--force", "--volumes", containerName], { cwd: root, stdio: "ignore" }).status !== 0) throw new Error("BLOCKED: 본 실행의 격리 container 정리에 실패했습니다.");
        if (tag) {
          const inspect = spawnSync("docker", ["image", "inspect", tag], { cwd: root, stdio: "ignore" });
          if (inspect.status === 0 && !dockerVerified) spawnSync("docker", ["image", "rm", tag], { cwd: root, stdio: "ignore" });
        }
      }
    }
    result.status = result.steps.length && result.steps.every((x) => x.status === "PASS") ? "PASS" : "NOT TESTED";
  } catch (error) {
    result.errors.push(error.message);
    result.status = error.message.startsWith("FAILED:") && result.steps.at(-1)?.status !== "BLOCKED" ? "FAIL" : "BLOCKED";
  } finally {
    if (reportDir) {
      try { if (browserStarted) keepE2eArtifacts(reportDir, browserSnapshot.snapshotRoot); } catch (error) { result.errors.push(`Artifact move failed: ${error.message}`); result.status = "BLOCKED"; }
      if (browserSnapshot) {
        try {
          const { audit, verification } = inspectBrowserSnapshot(browserSnapshot, result.sourceStart);
          const bytes = JSON.stringify(audit, null, 2) + "\n";
          writeFileSync(join(reportDir, "browser-source-audit.json"), bytes);
          result.browserSnapshot = { status: "PASS", auditFile: "browser-source-audit.json", auditSha256: createHash("sha256").update(bytes).digest("hex"), verification };
        } catch (error) { result.errors.push(error.message); result.status = "BLOCKED"; }
        try { removeBrowserSnapshot(browserSnapshot); } catch (error) { result.errors.push(`Snapshot cleanup failed: ${error.message}`); result.status = "BLOCKED"; }
      }
      for (const name of ["playwright-report", "test-results"]) if (existsSync(join(reportDir, name))) result.artifacts.push(join(reportDir, name));
    }
    safeCleanup(buildResources);
    if (result.sourceStart) {
      try {
        result.sourceEnd = sourceEvidence(root, opt.base);
        result.sourceStable = result.sourceEnd.fingerprint === result.sourceStart.fingerprint;
        if (!result.sourceStable) { result.errors.push("STALE: working source/base/head changed during local verification"); result.status = "BLOCKED"; }
      } catch (error) { result.errors.push(`Cannot prove source stability: ${error.message}`); result.status = "BLOCKED"; }
    }
    if (result.environmentStart) {
      result.environmentEnd = environmentEvidence(root);
      result.environmentStable = result.environmentEnd.fingerprint === result.environmentStart.fingerprint;
      if (!result.environmentStable) { result.errors.push("STALE: 환경/설치 입력이 검사 중 변경되었습니다."); result.status = "BLOCKED"; }
    }
    result.interrupted = interrupted;
    if (interrupted) { result.status = "BLOCKED"; result.errors.push("Interrupted: unfinished checks are NOT TESTED"); }
    result.completedAt = new Date().toISOString();
    result.integritySha256 = reportChecksum(result);
    if (reportDir) {
      writeFileSync(join(reportDir, "report.json"), JSON.stringify(result, null, 2) + "\n");
      writeFileSync(join(reportDir, "SUMMARY.md"), markdown(result));
      console.log(`\n[prepr] ${result.status}. Report: ${join(reportDir, "SUMMARY.md")}`);
    } else console.error(`[prepr] ${result.status}: ${result.errors.join("; ")}`);
    if (result.status !== "PASS" && !(opt.dryRun && result.status === "NOT TESTED")) process.exitCode = 1;
  }
}
await main();
