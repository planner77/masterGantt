import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

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
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ baseSha, head }));
  hash.update(workDiff);
  for (const name of untracked) {
    const full = resolve(root, name);
    if (!isPathWithin(root, full)) throw new Error(`Unsafe untracked file: ${name}`);
    const stat = lstatSync(full);
    hash.update(name);
    if (stat.isSymbolicLink()) hash.update(readlinkSync(full));
    else if (stat.isFile()) hash.update(readFileSync(full));
    else throw new Error(`Untracked special file requires manual handling: ${name}`);
  }
  return {
    baseRef: ref, baseSha, headSha: head,
    workingDiffSha256: sha256(Buffer.concat([workDiff, Buffer.from(untracked.join("\0"))])),
    fingerprint: hash.digest("hex"),
    dirty: workDiff.length > 0 || untracked.length > 0,
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
    id: "prepr-tooling", risk: "HIGH",
    re: /^(?:scripts\/prepr-core\.(?:mjs|d\.mts)|scripts\/verify-prepr\.mjs|tests\/scripts\/prepr-verifier\.test\.ts|docs\/LOCAL_PREPR\.md|package\.json|\.gitignore)$/,
    unitPaths: ["tests/scripts/prepr-verifier.test.ts"],
    browser: [],
    reason: "Pre-PR tool parser, source provenance, failure and safety regression",
  },
];
const DOCUMENT_PATH = /^(?:docs\/|AGENTS\.md$|CHANGELOG\.md$|README\.md$|DESIGN\.md$)/;
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
    if (path.startsWith("src/") || path.startsWith("db/") || path.startsWith("tests/") || INFRA_PATH.test(path)) {
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
    notSelectedReason: "Not a mapped direct/adjacent consumer for this change; remote Required coverage unchanged",
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
