import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { release } from "node:os";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (value) => value.replaceAll("\\", "/");

export function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 48 * 1024 * 1024 }).trim();
}

function gitRaw(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "buffer", maxBuffer: 48 * 1024 * 1024 });
}

function zFiles(value) {
  return value.toString("utf8").split("\0").filter(Boolean).map(normalize);
}

export function resolveBase(root, requested = "") {
  const candidates = requested ? [requested] : ["origin/main", "main"];
  for (const candidate of candidates) {
    try {
      const sha = git(root, "rev-parse", "--verify", candidate + "^{commit}");
      return { ref: candidate, sha };
    } catch { /* read-only fallback: explicit ref never falls back */ }
  }
  throw new Error(`Cannot resolve base ref (${candidates.join(", ")}). Fetch main or use --base=<sha>.`);
}

export function sourceEvidence(root, base = "") {
  const { ref, sha: baseSha } = resolveBase(root, base);
  const head = git(root, "rev-parse", "HEAD");
  const untracked = zFiles(gitRaw(root, "ls-files", "--others", "--exclude-standard", "-z")).sort();
  const changed = new Set(zFiles(gitRaw(root, "diff", "--no-renames", "--name-only", "-z", baseSha)));
  for (const path of untracked) changed.add(path);
  const workDiff = gitRaw(root, "diff", "--no-ext-diff", "--binary", "HEAD");
  // Hash actual bytes as well as Git's view: index-only changes, fixture edits,
  // and tracked files marked assume-unchanged must invalidate prior results.
  const flags = zFiles(gitRaw(root, "ls-files", "-v", "-z"));
  if (flags.some((entry) => /^[a-zS]/.test(entry))) throw new Error("BLOCKED: assume-unchanged/skip-worktree 플래그를 제거한 source checkout이 필요합니다.");
  const envFiles = [".env", ".env.local", ".env.development", ".env.development.local", ".env.test", ".env.test.local", ".env.production", ".env.production.local"];
  if (envFiles.some((file) => existsSync(resolve(root, file)))) throw new Error("BLOCKED: 격리 검증 checkout에는 .env 입력을 두지 마세요. 값은 출력하지 않았습니다.");
  const headFiles = new Map(zFiles(gitRaw(root, "ls-tree", "-r", "-z", "HEAD")).map((entry) => {
    const tab = entry.indexOf("\t");
    const [mode, type, object] = entry.slice(0, tab).split(" ");
    if (type !== "blob") throw new Error("BLOCKED: submodule source는 별도 검증이 필요합니다.");
    return [entry.slice(tab + 1), { mode, object }];
  }));
  const objectFormat = git(root, "rev-parse", "--show-object-format");
  let actualMatchesHead = true;
  const tracked = zFiles(gitRaw(root, "ls-files", "-z")).sort();
  const index = gitRaw(root, "ls-files", "--stage", "-z");
  const content = createHash("sha256");
  const fixtures = createHash("sha256");
  for (const name of [...new Set([...tracked, ...untracked])].sort()) {
    const full = resolve(root, name);
    if (!isPathWithin(root, full)) throw new Error(`Unsafe source file: ${name}`);
    let ancestor = root;
    for (const part of name.split("/").slice(0, -1)) {
      ancestor = resolve(ancestor, part);
      if (existsSync(ancestor) && lstatSync(ancestor).isSymbolicLink()) throw new Error("BLOCKED: source ancestor symlink는 허용하지 않습니다.");
    }
    let payload;
    let actualBlob = null;
    let actualMode = null;
    try {
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) throw new Error("BLOCKED: source symlink는 별도 검증이 필요합니다.");
      else if (stat.isFile()) { actualBlob = readFileSync(full); actualMode = stat.mode & 0o111 ? "100755" : "100644"; payload = Buffer.concat([Buffer.from(`file:${stat.mode & 0o111}:`), actualBlob]); }
      else throw new Error(`Special source file requires manual handling: ${name}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      payload = Buffer.from("missing");
    }
    const expected = headFiles.get(name);
    const actualObject = actualBlob === null ? null : createHash(objectFormat).update(`blob ${actualBlob.length}\0`).update(actualBlob).digest("hex");
    if (!expected || expected.mode !== actualMode || expected.object !== actualObject) actualMatchesHead = false;
    const record = JSON.stringify([name, sha256(payload)]);
    content.update(record);
    if (name.startsWith("tests/fixtures/") || name.startsWith("tests/e2e/fixtures/")) fixtures.update(record);
  }
  const contentSha256 = content.digest("hex");
  const indexSha256 = sha256(index);
  const fixtureSha256 = fixtures.digest("hex");
  const packageLockSha256 = existsSync(resolve(root, "package-lock.json")) ? sha256(readFileSync(resolve(root, "package-lock.json"))) : null;
  const stagedDiff = gitRaw(root, "diff", "--cached", "--no-ext-diff", "--binary", "HEAD");
  return {
    baseRef: ref, baseSha, headSha: head,
    workingDiffSha256: sha256(Buffer.concat([workDiff, stagedDiff, Buffer.from(untracked.join("\0"))])),
    fingerprint: sha256(JSON.stringify({ baseSha, head, contentSha256, indexSha256 })),
    contentSha256, indexSha256, fixtureSha256, packageLockSha256, actualMatchesHead,
    dirty: !actualMatchesHead || workDiff.length > 0 || stagedDiff.length > 0 || untracked.length > 0,
    changed: [...changed].sort(),
  };
}

export function e2eSafety({ env = {}, existing = [], portFree = true } = {}) {
  const reasons = [];
  for (const name of ["PLAYWRIGHT_BASE_URL", "APP_BASE_URL", "DATABASE_PATH", "PLAYWRIGHT_CHROMIUM_EXECUTABLE"]) {
    if (env[name]) reasons.push(`External/operational variable set: ${name}`);
  }
  for (const path of existing) reasons.push(`Existing E2E resource: ${path}`);
  if (!portFree) reasons.push("E2E server port 3100 is occupied or cannot be inspected");
  return { state: reasons.length ? "BLOCKED" : "READY", reasons };
}

export function isPathWithin(root, target) {
  const remainder = relative(resolve(root), resolve(target));
  return remainder === "" || (remainder !== ".." && !remainder.startsWith(".." + sep) && !remainder.startsWith(sep));
}

function inventoryFiles(root, subdir, suffix) {
  const names = [];
  const base = resolve(root, subdir);
  function walk(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const full = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(suffix)) names.push(normalize(relative(root, full)));
    }
  }
  walk(base);
  return names.sort();
}

export function inventory(root) {
  const unit = inventoryFiles(root, "tests", ".test.ts");
  const e2e = inventoryFiles(root, "tests/e2e", ".spec.ts");
  const directBySource = Object.create(null);
  // Index only statically referenced source modules, without running any test
  // file or traversing outside the repository. Do not infer coverage from
  // similarly named tests or from unrelated generic HTTP smoke tests.
  for (const file of unit) {
    const body = readFileSync(resolve(root, file), "utf8");
    for (const match of body.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g)) {
      const specifier = match[1] ?? match[2];
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
      const absolute = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(root, dirname(file), specifier);
      if (!isPathWithin(root, absolute)) continue;
      const path = normalize(relative(root, absolute)).replace(/\.js$/, "");
      for (const candidate of [path, path + ".ts", path + ".tsx", path + "/index.ts"]) {
        if (candidate.startsWith("src/")) {
          (directBySource[candidate] ??= []).push(file);
        }
      }
    }
  }
  for (const [path, files] of Object.entries(directBySource)) directBySource[path] = [...new Set(files)].sort();
  return { unit, e2e, directBySource };
}

// These are representative direct + adjacent + negative consumer mappings for #697.
// A path with no known contract is BLOCKED, never treated as "no affected tests".
const RULES = [
  {
    id: "gantt-shared", risk: "HIGH",
    re: /^src\/(features\/gantt|domain\/gantt|lib\/gantt|components\/gantt)\/(.*canonical|.*viewport|.*projection|.*state|.*core|.*axis|.*command|.*svar|.*sync|.*recovery)/i,
    unit: ["canonical-recovery", "canonical-recovery-runtime", "state-consistency-harness", "viewport-coordinator", "axis-transaction", "copy-viewport-continuity"],
    browser: ["project-task-delete-context", "project-task-editor-persistence", "project-multi-task-copy-paste", "milestone-dashboard-state", "project-search-filter", "resource-drill-ui", "project-gantt-fullscreen", "viewport-coordinator"],
    reason: "shared Gantt/Core/viewport → Task CRUD, Copy/Paste, Milestone, Resource, Search, Fullscreen and error recovery",
  },
  {
    id: "gantt-editor", risk: "MEDIUM",
    re: /^src\/.*(task-editor|task-context|task-delete|task-selection|task-link)/i,
    unit: ["task-editor-model", "task-delete-model", "task-selection-model", "task-link-scope"],
    browser: ["project-task-editor", "project-task-editor-persistence", "project-task-delete-context", "project-links-persistence"],
    reason: "editor/Task direct behavior, persistence, authorization and adjacent negative actions",
  },
  {
    id: "resource-calendar", risk: "HIGH",
    re: /^src\/.*(resource|calendar|milestone)/i,
    unit: ["date-adapter", "axis-transaction", "milestone-timeline-adapter"],
    browser: ["project-resource-calendar-persistence", "resource-drill-ui", "milestone-stage-editor", "project-work-calendar-preview", "project-task-persistence"],
    reason: "shared resource/calendar/milestone consumers and persisted state",
  },
  {
    id: "http-sqlite", risk: "HIGH",
    re: /^(?:src\/(?:app\/api|server|lib\/security)|db\/)/i,
    unitPaths: ["tests/server/projects/task-handler-integration.test.ts", "tests/server/projects/edit-authorization-handlers.test.ts", "tests/server/db/database.test.ts"],
    browser: ["project-edit-authorization", "project-task-persistence", "project-create-isolation", "resource-drill-api", "project-json-import"],
    reason: "actual HTTP/SQLite/session/401/409/412/422/500, persistence and failure recovery; confirm actual assertions manually",
  },
  {
    id: "historical-capture", risk: "HIGH",
    re: /^tests\/fixtures\/gantt-state-consistency\/capture-install\.ts$/,
    unitPaths: [
      "tests/features/gantt/axis-transaction-runtime-fixture.test.ts",
      "tests/features/gantt/canonical-recovery-runtime.test.ts",
      "tests/features/gantt/state-consistency-runtime-fixture.test.ts",
      "tests/scripts/prepr-verifier.test.ts",
    ],
    browser: [],
    reason: "Historical Core capture comparison: exact package metadata/lock provenance plus narrow development-tool alias",
  },
  {
    id: "issue-552-locked-dependencies", risk: "HIGH",
    re: /^package-lock\.json$/,
    unitPaths: [
      "tests/scripts/prepr-verifier.test.ts",
      "tests/features/gantt/canonical-recovery-runtime.test.ts",
      "tests/features/gantt/state-consistency-runtime-fixture.test.ts",
      "tests/features/gantt/axis-transaction-runtime-fixture.test.ts",
    ],
    browser: ["gantt-state-product-integration"],
    reason: "locked dependencies and installed-Core capture provenance → strict manifests, Core runtime and browser compatibility",
  },
  {
    id: "issue-552-gantt-presentation", risk: "HIGH",
    re: /^src\/features\/gantt\/(?:project-gantt\.tsx|gantt-scale-toolbar\.css)$/,
    unitPaths: ["tests/features/gantt/axis-transaction.test.ts", "tests/features/gantt/milestone-visibility.test.ts"],
    browser: [
      "milestone-visibility", "project-notifications", "project-gantt-scale",
      "project-gantt-fullscreen", "project-gantt-stability", "projection-row-alignment",
      "project-context-toolbar-responsive", "viewport-coordinator",
    ],
    reason: "Gantt entry and layout → marker-OFF geometry, visible projection, axis, fullscreen, notification and viewport consumers",
  },
  {
    id: "issue-822-gantt-density", risk: "HIGH",
    re: /^src\/features\/gantt\/gantt-density\.ts$/,
    unitPaths: ["tests/features/gantt/gantt-density.test.ts"],
    browser: [
      "project-gantt-scale", "project-summary-bar-visual", "projection-row-alignment",
      "project-task-delete-context", "project-task-hover-tooltip",
    ],
    reason: "Gantt 밀도 단계·휠 입력 → 실제 Grid/Chart geometry·행 정렬·진행률 적중·읽기 전용 tooltip 회귀",
  },
  {
    id: "issue-552-project-workspace", risk: "HIGH",
    re: /^src\/features\/projects\/(?:project-readonly-view|project-copy-membership-confirm)\.tsx$/,
    browser: [
      "project-notifications", "project-task-quick-view", "project-task-delete-context",
      "project-edit-authorization", "milestone-visibility", "milestone-dashboard-state",
      "project-multi-task-copy-paste",
    ],
    reason: "project workspace and canonical Copy guard → error/readonly/selection/Milestone Dashboard/hidden-subtree negative paths",
  },
  {
    id: "issue-552-milestone-test-helper", risk: "HIGH",
    re: /^tests\/e2e\/helpers\/milestone-ui\.ts$/,
    browser: [
      "milestone-management-persistence", "milestone-stage-grid", "milestone-timeline-lane",
      "milestone-visibility", "milestone-stage-dashboard", "milestone-stage-editor",
      "milestone-visibility-persistence",
    ],
    reason: "shared Milestone browser helper → persistence, native-row absence, date/timeline and Dashboard negative contracts",
  },
  {
    id: "pr-batch-tooling", risk: "HIGH",
    re: /^(?:scripts\/pr-batch-core\.(?:mjs|d\.mts)|scripts\/verify-pr-batch\.mjs|tests\/scripts\/pr-batch-verifier\.test\.ts)$/,
    unitPaths: ["tests/scripts/pr-batch-verifier.test.ts"],
    browser: [],
    reason: "PR 변경 묶음의 manifest·로컬 tree·expected ref와 읽기 전용 게시 증거 검증",
  },
  {
    id: "local-agent-policy", risk: "HIGH",
    re: /^\.codex\/agents\/[^/]+\.toml$/,
    unitPaths: ["tests/scripts/agent-qa-contract.test.ts", "tests/scripts/agent-model-selection.test.ts"],
    reason: "로컬 Agent 정책/역할·모델 계약 직접 검증",
  },
  {
    id: "local-issue-ledger", risk: "HIGH",
    re: /^(?:scripts\/verify-issue-ledger\.mjs|scripts\/issue-ledger-core\.(?:mjs|d\.mts)|tests\/scripts\/issue-ledger-verifier\.test\.ts)$/,
    unitPaths: ["tests/scripts/issue-ledger-verifier.test.ts"],
    reason: "Issue 실패 원장·회귀 인덱스의 로컬 schema/출처·누적 이력 검증",
  },
  {
    id: "prepr-docker-build", risk: "HIGH",
    re: /^(?:scripts\/prepr-docker\.(?:mjs|d\.mts)|tests\/scripts\/prepr-docker\.test\.ts)$/,
    unitPaths: ["tests/scripts/prepr-docker.test.ts", "tests/scripts/prepr-verifier.test.ts"],
    reason: "단일 로컬 Buildx OCI·SBOM/provenance·검증 이미지 ID 출처 검증",
  },
  {
    id: "prepr-browser-snapshot", risk: "HIGH",
    re: /^(?:scripts\/prepr-snapshot\.(?:mjs|d\.mts)|tests\/scripts\/prepr-snapshot\.test\.ts)$/,
    unitPaths: ["tests/scripts/prepr-verifier.test.ts", "tests/scripts/prepr-snapshot.test.ts"],
    browser: ["gantt-demo"],
    reason: "브라우저 exact source snapshot·Next 생성 metadata·실제 Chromium 실행 경계",
  },
  {
    id: "prepr-tooling", risk: "HIGH",
    re: /^(?:scripts\/prepr-core\.(?:mjs|d\.mts)|scripts\/verify-prepr\.mjs|tests\/scripts\/prepr-verifier\.test\.ts|docs\/LOCAL_PREPR\.md|package\.json|\.gitignore|\.dockerignore)$/,
    unitPaths: ["tests/scripts/prepr-verifier.test.ts"],
    browser: [],
    reason: "Local tool parser, source provenance, failure and safety regression",
  },
];
const DOCUMENT_PATH = /^(?:\.github\/(?:ISSUE_TEMPLATE\/|pull_request_template\.md$)|docs\/|AGENTS\.md$|CHANGELOG\.md$|README\.md$|DESIGN\.md$)/;
const INFRA_PATH = /^(?:scripts\/|\.github\/|deploy\/|package(?:-lock)?\.json$|\.gitignore$)/;

export function inferRisk(paths) {
  let level = "LOW";
  for (const path of paths) {
    if (RULES.some((rule) => rule.risk === "HIGH" && rule.re.test(path)) ||
        /^(?:AGENTS\.md|docs\/ISSUE_LIFECYCLE\.md|docs\/TEST_PLAN\.md|\.github\/|db\/|tests\/(?:config\/|fixtures\/|e2e\/(?:helpers\/|fixtures\/)))/.test(path)) return "HIGH";
    if (path.startsWith("src/") || INFRA_PATH.test(path)) level = "MEDIUM";
  }
  return level;
}

export function selectImpact({ changed, tests, risk, includes = [], excludes = [] }) {
  const order = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  const floor = inferRisk(changed);
  if (!(risk in order)) throw new Error(`Unknown risk: ${risk}`);
  if (order[risk] < order[floor]) throw new Error(`Declared risk ${risk} is below path floor ${floor}`);
  const existing = new Set([...tests.unit, ...tests.e2e]);
  const selected = new Map();
  const unknown = [];
  const missing = [];
  const matched = [];
  const exclusions = [];
  const add = (path, why) => {
    if (!existing.has(path)) { missing.push({ path, reason: why }); return; }
    if (!selected.has(path)) selected.set(path, []);
    selected.get(path).push(why);
  };
  for (const path of changed) {
    if (existing.has(path)) { add(path, "Changed test itself"); continue; }
    // Renamed/deleted test files appear as absent via --no-renames diff.
    // A harness/fixture/config change is not a harmless unselected asset.
    if (/^tests\/.*\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) {
      missing.push({ path, reason: "Deleted, renamed or undiscoverable test coverage (old path retained)" });
      continue;
    }
    let found = false;
    for (const rule of RULES) {
      if (!rule.re.test(path)) continue;
      found = true;
      matched.push({ path, rule: rule.id, reason: rule.reason });
      for (const name of rule.unit ?? []) add(`tests/features/gantt/${name}.test.ts`, rule.reason);
      for (const name of rule.browser ?? []) add(`tests/e2e/${name}.spec.ts`, rule.reason);
      for (const name of rule.unitPaths ?? []) add(name, rule.reason);
    }
    // Direct server consumers must be selected from their actual static
    // imports. Generic integration checks alone never prove a service change.
    if (path.startsWith("src/server/")) {
      const direct = tests.directBySource?.[path] ?? [];
      if (direct.length) {
        matched.push({ path, rule: "actual-server-imports", reason: "Actual unit/integration test imports changed server module" });
        for (const testPath of direct) add(testPath, "Direct import of changed server module");
      } else {
        unknown.push({ path, reason: "No actual direct server-module test import found; generic smoke tests are insufficient" });
      }
    }
    if (found || DOCUMENT_PATH.test(path)) continue;
    // Test harness and removed/renamed coverage must never quietly disappear.
    if (!DOCUMENT_PATH.test(path)) {
      unknown.push({ path, reason: "No verified producer→consumer test map. Manager must map/verify." });
    }
  }
  for (const name of includes) {
    if (!existing.has(name)) missing.push({ path: name, reason: "Manual include is not an existing test file" });
    else add(name, "Manager manual include");
  }
  for (const entry of excludes) {
    const index = entry.indexOf(":");
    if (index <= 0 || !entry.slice(index + 1).trim()) throw new Error(`--exclude requires existing-test:reason: ${entry}`);
    const file = entry.slice(0, index);
    const reason = entry.slice(index + 1).trim();
    if (!existing.has(file)) throw new Error(`Cannot exclude missing test: ${file}`);
    if (selected.delete(file)) exclusions.push({ path: file, reason });
    else exclusions.push({ path: file, reason, notRecommended: true });
  }
  return {
    risk, inferredRisk: floor, matched, unknown, missing, excluded: exclusions,
    selected: [...selected].sort(([a], [b]) => a.localeCompare(b)).map(([path, reasons]) => ({
      path, kind: path.startsWith("tests/e2e/") ? "chromium" : "unit", reasons: [...new Set(reasons)],
    })),
    state: unknown.length || missing.length ? "BLOCKED" : "READY",
    notSelectedReason: "Not a mapped direct/adjacent consumer for this change; unselected local tests are not claimed as executed",
  };
}

export function diagnosticSubset(history, existingFiles, expectedPr) {
  if (!history || !Array.isArray(history.failures)) throw new Error("diagnose requires JSON failures[]");
  const failures = history.failures;
  if (failures.length < 2) throw new Error("diagnose requires >=2 real failed run/attempt entries");
  const valid = new Set(existingFiles);
  const seenRuns = new Set();
  const seenFiles = new Set();
  const evidence = [];
  for (const entry of failures) {
    if (!Number.isInteger(entry.pr) || (expectedPr && entry.pr !== expectedPr) ||
        !entry.runId || !Number.isInteger(entry.attempt) || entry.attempt < 1 ||
        !/^[0-9a-f]{40}$/.test(entry.headSha || "") || entry.status !== "FAIL") {
      throw new Error("Missing PR/run/attempt/head/status=FAIL provenance in diagnose input");
    }
    if (!valid.has(entry.file) || !entry.file.startsWith("tests/e2e/")) {
      throw new Error(`Diagnosis has a missing/non-browser test: ${entry.file}`);
    }
    const runKey = `${entry.pr}/${entry.runId}/${entry.attempt}`;
    seenRuns.add(runKey);
    seenFiles.add(entry.file);
    evidence.push({ ...entry, classification: entry.classification || "UNKNOWN" });
  }
  if (new Set(failures.map((x) => x.pr)).size !== 1 || seenRuns.size < 2 || seenFiles.size < 2) {
    throw new Error("Diagnosis needs one PR and failures across two runs and distinct consumers");
  }
  if (seenFiles.size > 12) throw new Error("Diagnosis >12 files requires narrower Owner-approved evidence");
  return { files: [...seenFiles].sort(), evidence, status: "READY", attempts: seenRuns.size };
}

export const COMMON_CHECKS = {
  "Version contract": ["node", "scripts/verify-release-version.mjs"],
  "Test discovery": ["node", "scripts/verify-test-discovery.mjs"],
  "Markdown links": ["node", "scripts/check-markdown-links.mjs"],
  "Issue ledger": ["node", "scripts/verify-issue-ledger.mjs"],
  Dependencies: ["npm", "ls", "--depth=0", "--offline"],
  Typecheck: ["npm", "run", "typecheck"],
  Lint: ["npm", "run", "lint"],
  Unit: ["npm", "test", "--", "--maxWorkers=2"],
  "Production build": ["npm", "run", "build"],
};

export function reportChecksum(report) {
  const value = { ...report };
  delete value.integritySha256;
  return sha256(JSON.stringify(value));
}

export function environmentEvidence(root, env = process.env) {
  // Values can contain credentials; persist only hashes, never raw environment.
  const transient = new Set(["PWD", "OLDPWD", "SHLVL", "_", "COLUMNS", "LINES", "TERM", "COLORTERM"]);
  const environmentSha256 = sha256(JSON.stringify(Object.entries(env).filter(([key]) => !transient.has(key)).sort(([a], [b]) => a.localeCompare(b))));
  const files = ["package.json", "package-lock.json", "node_modules/.package-lock.json", "node_modules/@playwright/test/package.json", "node_modules/playwright-core/browsers.json", "node_modules/next/package.json", "node_modules/next/dist/lib/typescript/writeAppTypeDeclarations.js"];
  const inputs = Object.fromEntries(files.map((file) => [file, existsSync(resolve(root, file)) ? sha256(readFileSync(resolve(root, file))) : null]));
  const npm = spawnSync("npm", ["--version"], { cwd: root, encoding: "utf8", timeout: 10000 });
  const evidence = { node: process.version, npm: npm.status === 0 ? npm.stdout.trim() : null, osRelease: release(), abi: process.versions.modules, platform: process.platform, architecture: process.arch, environmentSha256, inputs };
  return { ...evidence, fingerprint: sha256(JSON.stringify(evidence)) };
}

export function publicationRequirements(source, selection) {
  const code = source.changed.some((path) => !DOCUMENT_PATH.test(path) && !/^\.github\/(?:ISSUE_TEMPLATE\/|pull_request_template\.md$)/.test(path) && !/^\.codex\//.test(path));
  return { common: Object.keys(COMMON_CHECKS), tests: selection.selected.map((item) => item.path), docker: code };
}

export function evaluateAdmission({ reports, source, environment, selection, issue, now = Date.now() }) {
  const reasons = [];
  const require = (condition, reason) => { if (!condition) reasons.push(reason); };
  const requirement = publicationRequirements(source, selection);
  require(Number.isInteger(issue) && issue > 0, "게시에는 명시적인 Primary Issue 번호가 필요합니다.");
  require(source.changed.length > 0 && source.baseSha !== source.headSha, "게시에는 변경 범위를 고정한 이전 baseline SHA가 필요합니다.");
  require(!source.dirty, "게시에는 깨끗한 exact HEAD checkout이 필요합니다.");
  require(selection.state === "READY" && !selection.unknown.length && !selection.missing.length, "영향 테스트 매핑이 불완전합니다.");
  require(!selection.excluded.length, "필수 영향 테스트 제외는 게시 근거로 사용할 수 없습니다.");
  const candidates = [];
  for (const report of reports) {
    // Other source receipts are history, not evidence for this checkout.
    if (report?.sourceStart?.fingerprint !== source.fingerprint) continue;
    require(report.issue === issue, "같은 source의 보고서 Primary Issue가 현재 Issue와 다릅니다.");
    require(report.schemaVersion === 2 && report.tool === "mastergantt-local-verify", "로컬 보고서 schema/tool이 일치하지 않습니다.");
    require(report.integritySha256 === reportChecksum(report), "로컬 보고서 checksum이 일치하지 않습니다.");
    require(report.sourceStart.headSha === source.headSha && report.sourceStart.baseSha === source.baseSha && report.sourceStart.contentSha256 === source.contentSha256, "보고서 source/head/base가 현재 입력과 다릅니다.");
    const timestamp = Date.parse(report.completedAt);
    require(Number.isFinite(timestamp) && timestamp <= now && Date.parse(report.startedAt) <= timestamp, "보고서 실행 시각이 유효하지 않습니다.");
    require(Array.isArray(report.steps) && ["fast", "targeted", "docker", "ci-like"].includes(report.mode), "보고서 실행 모드 또는 단계가 유효하지 않습니다.");
    if (!Array.isArray(report.steps)) continue;
    candidates.push(report);
  }
  const latest = new Map();
  for (const report of candidates.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))) latest.set(report.mode, report);
  const valid = [];
  for (const report of latest.values()) {
    require(report.status === "PASS" && !report.dryRun && !report.interrupted && report.errors?.length === 0, `${report.mode} 최신 실행은 완료 성공이 아닙니다.`);
    require(report.sourceStable && report.sourceEnd?.fingerprint === source.fingerprint && report.sourceEnd?.fixtureSha256 === source.fixtureSha256 && report.sourceEnd?.packageLockSha256 === source.packageLockSha256, `${report.mode} 실행 중 source/fixture/lock이 변경되었습니다.`);
    require(report.environmentStable && report.environmentStart?.fingerprint === environment.fingerprint && report.environmentEnd?.fingerprint === environment.fingerprint, `${report.mode} 실행 환경 또는 설치 입력이 현재 환경과 다릅니다.`);
    require(report.selection?.state === "READY" && report.selection.excluded?.length === 0 && JSON.stringify(report.selection.selected?.map((item) => item.path).sort()) === JSON.stringify(selection.selected.map((item) => item.path).sort()), `${report.mode} 영향 테스트 선택이 현재 계획과 다릅니다.`);
    require(report.steps.length > 0 && report.steps.every((step) => step.status === "PASS" && step.exitCode === 0 && !step.signal && /^[a-f0-9]{64}$/.test(step.logSha256 ?? "")), `${report.mode} 실행 단계/exit/log 근거가 불완전합니다.`);
    valid.push(report);
  }
  const steps = valid.flatMap((report) => report.steps);
  for (const [label, command] of Object.entries(COMMON_CHECKS)) {
    require(steps.some((step) => step.label === label && (label === "Unit" ? approvedTestCommand(label, step.command) && step.caseCount > 0 : JSON.stringify(step.command) === JSON.stringify(command))), `공통 필수 검사가 없습니다: ${label}`);
  }
  for (const path of requirement.tests) {
    require(steps.some((step) => step.caseCount > 0 && step.runner?.fileResults?.some((file) => file.path === path && file.passed > 0 && file.failed === 0) && step.coveredTests?.includes(path) && approvedTestCommand(step.label, step.command) && (path.startsWith("tests/e2e/") ? step.label === "Chromium E2E" && step.command[0] === "npm" && step.command.includes("test:e2e") && step.command.includes("--retries=0") : ["Unit", "Targeted Unit"].includes(step.label) && step.command[0] === "npm" && step.command[1] === "test")), `영향 소비자 실행 근거가 없습니다: ${path}`);
  }
  if (requirement.tests.some((path) => path.startsWith("tests/e2e/"))) require(valid.some((report) => report.browserSnapshot?.status === "PASS" && report.browserSnapshot.verification?.status === "PASS"), "브라우저 snapshot source 검증 근거가 없습니다.");
  if (requirement.docker) {
    const dockerReport = valid.find((report) => report.mode === "docker");
    const image = dockerReport?.dockerImage;
    require(image?.sourceHead === source.headSha && image?.sourceContentSha256 === source.contentSha256 && image?.platform === "linux/amd64" && /^sha256:[a-f0-9]{64}$/.test(image?.id ?? "") && /^mastergantt-prepr-[a-z0-9-]+:check$/.test(image?.tag ?? "") && image?.attestations?.includes("provenance") && image?.attestations?.includes("sbom") && /^[a-f0-9]{64}$/.test(image?.ociArchiveSha256 ?? "") && image?.configDigest === image?.id, "Docker 검증 이미지의 정확 source/ID/platform/OCI 근거가 없습니다.");
    const dockerSteps = dockerReport?.steps ?? [];
    require(dockerSteps.some((step) => step.label === "Docker build" && JSON.stringify(step.command.slice(0, 3)) === JSON.stringify(["docker", "buildx", "build"]) && step.command.includes("--platform=linux/amd64") && step.command.includes("--provenance=mode=max") && step.command.some((part) => part.startsWith("--attest=type=sbom,generator=")) && step.command.includes(`org.opencontainers.image.revision=${source.headSha}`) && step.command.includes("deploy/docker/Dockerfile") && step.command.filter((part) => part === "--output").length === 1 && step.command.some((part) => part.startsWith("type=oci,dest=")) && step.command.at(-1) === "."), "Docker build 명령 근거가 다릅니다.");
    require(dockerSteps.some((step) => step.label === "Docker runtime import" && step.command.length === 4 && JSON.stringify(step.command.slice(0, 3)) === JSON.stringify(["docker", "load", "--input"]) && typeof image?.runtimeLoadArchive === "string" && step.command[3].endsWith("/" + image.runtimeLoadArchive) && /^[a-f0-9]{64}$/.test(image.runtimeLoadArchiveSha256 ?? "")), "Docker runtime import 명령 근거가 다릅니다.");
    require(dockerSteps.some((step) => step.label === "Docker image policy" && JSON.stringify(step.command) === JSON.stringify(["sh", "scripts/verify-image-policy.sh", image?.tag])), "Docker image policy 명령 근거가 다릅니다.");
    require(dockerSteps.some((step) => step.label === "Docker runtime start" && step.command[0] === "docker" && step.command[1] === "run" && step.command.includes("127.0.0.1::3000") && step.command.at(-1) === image?.tag), "Docker runtime 명령 근거가 다릅니다.");
    require(dockerSteps.some((step) => step.label === "Docker API/SQLite persistence" && step.command[0] === "node" && step.command[1] === "scripts/verify-registry-api-smoke.mjs" && /^http:\/\/127\.0\.0\.1:[0-9]+$/.test(step.command[2]) && step.command[3] === "mastergantt-w22-local"), "Docker API/SQLite 명령 근거가 다릅니다.");
    for (const label of ["Docker build", "Docker OCI evidence", "Docker runtime import", "Docker image policy", "Docker runtime start", "Docker readiness", "Docker API/SQLite persistence", "Docker SQLite integrity"]) require(steps.some((step) => step.label === label), `필수 Docker 검사가 없습니다: ${label}`);
  }
  require(candidates.length > 0, "현재 source에 연결된 로컬 실행 보고서가 없습니다.");
  return { status: reasons.length ? "BLOCKED" : "PASS", publishAllowed: reasons.length === 0, requirements: requirement, reasons: [...new Set(reasons)], source, environment, reportCount: candidates.length, notice: "로컬 Owner 검토 보조이며 인증된 서버 Gate나 게시/배포 승인이 아닙니다." };
}

export function runnerCoverage(kind, payload, root) {
  const files = new Map();
  const add = (file, status) => {
    const path = normalize(relative(root, resolve(root, file)));
    if (!isPathWithin(root, resolve(root, path)) || !path.startsWith("tests/")) throw new Error("BLOCKED: runner 결과 경로가 tests 밖입니다.");
    const value = files.get(path) ?? { path, passed: 0, failed: 0, skipped: 0 };
    if (status === "passed") value.passed++;
    else if (["pending", "skipped", "todo", "disabled"].includes(status)) value.skipped++;
    else value.failed++;
    files.set(path, value);
  };
  if (kind === "vitest") {
    if (!Array.isArray(payload?.testResults)) throw new Error("BLOCKED: Vitest JSON testResults가 없습니다.");
    for (const file of payload.testResults) {
      if (!Array.isArray(file.assertionResults)) throw new Error("BLOCKED: Vitest assertionResults가 없습니다.");
      for (const test of file.assertionResults) add(file.name, test.status);
    }
  } else if (kind === "playwright") {
    if (!Array.isArray(payload?.suites)) throw new Error("BLOCKED: Playwright JSON suites가 없습니다.");
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
        if (typeof spec.file !== "string" || spec.file.includes("\\") || spec.file.split("/").includes("..")) throw new Error("BLOCKED: Playwright 결과 source 경로가 유효하지 않습니다.");
        const path = isAbsolute(spec.file) || spec.file.startsWith("tests/") ? spec.file : "tests/e2e/" + spec.file;
        const status = test.results?.at(-1)?.status;
        add(path, status === "passed" && test.expectedStatus === "passed" ? "passed" : status === "skipped" ? "skipped" : "failed");
      }
      for (const child of suite.suites ?? []) walk(child);
    };
    for (const suite of payload.suites) walk(suite);
  } else throw new Error("BLOCKED: 알 수 없는 test runner입니다.");
  return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function runnerCompletion(files, expectedTests, requiredTests = expectedTests, { allowDependencyBenchmarkSkip = false } = {}) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const expected = new Set(expectedTests);
  const required = new Set(requiredTests);
  const benchmark = "tests/server/projects/task-dependency-performance.test.ts";
  const permittedSkip = (path) => allowDependencyBenchmarkSkip && path === benchmark && expected.has(path) && !required.has(path) && byPath.get(path)?.passed === 0 && byPath.get(path)?.failed === 0 && byPath.get(path)?.skipped === 3;
  const missingFiles = expectedTests.filter((path) => !byPath.has(path));
  const requiredNotPassed = [...new Set([...expectedTests, ...requiredTests])].filter((path) => !expected.has(path) || (!(byPath.get(path)?.passed > 0) || byPath.get(path).failed > 0) && !permittedSkip(path));
  return {
    status: missingFiles.length || requiredNotPassed.length ? "BLOCKED" : "PASS",
    missingFiles, requiredNotPassed,
    notTestedFiles: files.filter((file) => file.passed === 0 && file.failed === 0 && file.skipped > 0).map((file) => ({ path: file.path, skippedCases: file.skipped, status: "NOT TESTED", reason: permittedSkip(file.path) ? "미선정된 기존 5,000 Task opt-in benchmark 3건, RUN_TASK_DEPENDENCY_BENCHMARK!=1" : "필수 실행 대상의 skip-only 결과는 통과 근거가 아닙니다." })),
    allowDependencyBenchmarkSkip,
    counts: files.reduce((sum, file) => ({ passed: sum.passed + file.passed, failed: sum.failed + file.failed, skipped: sum.skipped + file.skipped }), { passed: 0, failed: 0, skipped: 0 }),
  };
}

export function approvedTestCommand(label, command) {
  if (!Array.isArray(command)) return false;
  const unitPrefix = JSON.stringify(command.slice(0, 4)) === JSON.stringify(["npm", "test", "--", "--maxWorkers=2"]);
  if (label === "Unit") return command.length === 7 && unitPrefix && command[4] === "--reporter=default" && command[5] === "--reporter=json" && /^--outputFile=.*[/\\]\.prepr-reports[/\\].+[/\\]vitest-results\.json$/.test(command[6]);
  if (label === "Targeted Unit") return command.length > 7 && unitPrefix && command.slice(4, -3).every((path) => /^tests\/.+\.test\.ts$/.test(path)) && command.at(-3) === "--reporter=default" && command.at(-2) === "--reporter=json" && /^--outputFile=.*[/\\]\.prepr-reports[/\\].+[/\\]vitest-results\.json$/.test(command.at(-1));
  return label === "Chromium E2E" && JSON.stringify(command.slice(0, 8)) === JSON.stringify(["npm", "run", "test:e2e", "--", "--project=chromium", "--workers=1", "--retries=0", "--reporter=list,json,html"]) && command.slice(8).every((path) => /^tests\/e2e\/.+\.spec\.ts$/.test(path));
}
