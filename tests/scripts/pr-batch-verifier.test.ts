import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceEvidence } from "../../scripts/prepr-core.mjs";
import {
  BatchError, manifestDigest, prepareBatch, verifyBatch,
  type BatchIntent, type BatchObservation, type PreparedBatch,
} from "../../scripts/pr-batch-core.mjs";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const branch = "ci/issue-679-batch-publish";
const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function repository() {
  const dir = mkdtempSync(resolve(tmpdir(), "mastergantt-batch-"));
  created.push(dir);
  const git = (...args: string[]) => execFileSync("git", ["--no-optional-locks", ...args], {
    cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_OPTIONAL_LOCKS: "0" },
  }).trim();
  const write = (path: string, content: string) => {
    const absolute = resolve(dir, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  };
  const commit = (message: string) => {
    git("add", ".");
    git("commit", "-m", message);
    return git("rev-parse", "HEAD");
  };
  git("init", "--object-format=sha1", "--template=", "-b", "main");
  git("config", "user.name", "Batch Fixture");
  git("config", "user.email", "batch@example.invalid");
  git("config", "core.hooksPath", "/dev/null");
  git("config", "core.filemode", "true");
  write(".gitignore", ".prepr-reports/\n");
  write("src/code.ts", "export const value = 1;\n");
  write("tests/case.test.ts", "// fixture test v1\n");
  write("docs/guide.md", "# fixture v1\n");
  write("docs/obsolete.md", "obsolete\n");
  const mainSha = commit("fixture baseline");
  git("switch", "-c", branch);
  const options: BatchIntent = { repository: "planner77/masterGantt", issue: 679, branch, method: "api", mainSha, expectedHead: mainSha };
  function batch() {
    write("src/code.ts", "export const value = 2; // FIXTURE_BODY_NOT_METADATA\n");
    write("tests/case.test.ts", "// fixture test v2\n");
    write("docs/guide.md", "# fixture v2\n");
    write("docs/new guide.md", "new document\n");
    rmSync(resolve(dir, "docs/obsolete.md"));
    return commit("fixture complete batch");
  }
  function snapshot() {
    return {
      refs: git("for-each-ref", "--format=%(refname) %(objectname)"),
      index: readFileSync(resolve(dir, git("rev-parse", "--git-path", "index"))).toString("base64"),
      status: git("status", "--porcelain=v1", "--untracked-files=all"),
      tracked: git("ls-files", "-s"),
      code: readFileSync(resolve(dir, "src/code.ts"), "utf8"),
    };
  }
  return { dir, git, write, commit, batch, options, snapshot };
}

function observation(prepared: PreparedBatch, phase: "before" | "after" = "before"): BatchObservation {
  const m = prepared.manifest;
  const candidateHead = m.method === "git" ? m.localHead : "f".repeat(40);
  const remoteHead = phase === "after" ? candidateHead : m.expectedHead;
  return {
    schema: "mastergantt-pr-batch-observation-v1", repository: m.repository, branch: m.branch, mainSha: m.mainSha,
    remote: {
      state: remoteHead === null ? "ABSENT" : "PRESENT", headSha: remoteHead,
      treeSha: remoteHead === null ? null : phase === "after" ? m.localTree : m.baseTree,
    },
    candidate: { headSha: candidateHead, treeSha: m.localTree, parentShas: [...m.publishParents] },
  };
}

function verify(dir: string, prepared: PreparedBatch, observed = observation(prepared), phase: "before" | "after" = "before") {
  return verifyBatch(dir, prepared, observed, { phase, manifestSha256: prepared.manifestSha256 });
}

function fails(code: string, action: () => unknown) {
  try { action(); } catch (error) {
    expect(error).toBeInstanceOf(BatchError);
    expect((error as BatchError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe("Issue #679 — committed batch identity and read-only evidence", () => {
  it("preserves multiple code/test/docs edits, deletion and exact tree without publishing content", () => {
    const r = repository();
    r.batch();
    const before = r.snapshot();
    const prepared = prepareBatch(r.dir, r.options);
    const m = prepared.manifest;
    expect(m.localHead).toBe(r.git("rev-parse", "HEAD"));
    expect(m.localTree).toBe(r.git("rev-parse", "HEAD^{tree}"));
    expect(m.sourceFingerprint).toBe(sourceEvidence(r.dir, r.options.mainSha).fingerprint);
    expect(m.changes.map((item) => item.path)).toEqual([
      "docs/guide.md", "docs/new guide.md", "docs/obsolete.md", "src/code.ts", "tests/case.test.ts",
    ]);
    expect(m.changes.find((item) => item.path === "docs/obsolete.md")).toMatchObject({ action: "delete", sha: null, size: null });
    expect(m.changes.find((item) => item.path === "docs/new guide.md")).toMatchObject({ action: "upsert", previousSha: null });
    expect(m.changes.find((item) => item.path === "src/code.ts")?.sha).toBe(r.git("rev-parse", "HEAD:src/code.ts"));
    expect(JSON.stringify(prepared)).not.toContain("FIXTURE_BODY_NOT_METADATA");
    expect(verify(r.dir, prepared).candidateHead).not.toBe(m.localHead);
    expect(verify(r.dir, prepared, observation(prepared, "after"), "after")).toMatchObject({
      status: "PASS", requiredCi: "NOT TESTED", approval: "NOT TESTED", scope: "LOCAL_STRUCTURE_ONLY",
    });
    expect(r.snapshot()).toEqual(before);
  });

  it("supports explicit new-branch absence and distinguishes API commit identity from Git push", () => {
    const r = repository();
    r.batch();
    const prepared = prepareBatch(r.dir, { ...r.options, expectedHead: null });
    expect(verify(r.dir, prepared).remoteHead).toBeNull();
    expect(prepared.manifest.publishParents).toEqual([r.options.mainSha]);
    const gitBatch = prepareBatch(r.dir, { ...r.options, method: "git" });
    expect(verify(r.dir, gitBatch).candidateHead).toBe(gitBatch.manifest.localHead);
    const wrong = observation(gitBatch);
    wrong.candidate.headSha = "e".repeat(40);
    fails("GIT_HEAD_MISMATCH", () => verify(r.dir, gitBatch, wrong));
  });

  it("keeps current main as a second API parent when the existing PR head is behind", () => {
    const r = repository();
    r.write("src/code.ts", "export const remoteWork = 3;\n");
    const remoteHead = r.commit("remote branch work");
    r.git("switch", "main");
    r.write("docs/guide.md", "# main advanced\n");
    const mainSha = r.commit("main advanced");
    r.git("switch", branch);
    r.git("merge", "--no-ff", "-m", "preserve latest main", "main");
    r.write("tests/case.test.ts", "// complete repair\n");
    r.commit("complete repair");
    const prepared = prepareBatch(r.dir, { ...r.options, expectedHead: remoteHead, mainSha });
    expect(prepared.manifest.publishParents).toEqual([remoteHead, mainSha]);
    expect(verify(r.dir, prepared).status).toBe("PASS");
    const wrong = observation(prepared);
    wrong.candidate.parentShas = [remoteHead];
    fails("CANDIDATE_PARENTS_MISMATCH", () => verify(r.dir, prepared, wrong));
  });

  it("rejects missing main and competing remote ancestry", () => {
    const r = repository();
    r.batch();
    r.git("switch", "main");
    r.write("docs/independent.md", "independent\n");
    const competing = r.commit("competing history");
    r.git("switch", branch);
    fails("MAIN_NOT_INCLUDED", () => prepareBatch(r.dir, { ...r.options, mainSha: competing }));
    fails("REMOTE_NOT_INCLUDED", () => prepareBatch(r.dir, { ...r.options, expectedHead: competing }));
  });

  it("handles rename as delete/add and retains executable mode changes", () => {
    const r = repository();
    r.git("mv", "docs/obsolete.md", "docs/renamed.md");
    chmodSync(resolve(r.dir, "src/code.ts"), 0o755);
    r.commit("rename and mode change");
    const prepared = prepareBatch(r.dir, r.options);
    expect(prepared.manifest.changes.find((item) => item.path === "docs/obsolete.md")?.action).toBe("delete");
    expect(prepared.manifest.changes.find((item) => item.path === "docs/renamed.md")?.action).toBe("upsert");
    expect(prepared.manifest.changes.find((item) => item.path === "src/code.ts")).toMatchObject({ mode: "100755", previousMode: "100644" });
  });
});

describe("Issue #679 — stale source, unsupported objects and target guards", () => {
  it.each(["unstaged", "staged", "untracked", "staged-restored-worktree"])("blocks %s source without changing it", (kind) => {
    const r = repository();
    r.batch();
    const original = readFileSync(resolve(r.dir, "src/code.ts"), "utf8");
    r.write(kind === "untracked" ? "new.txt" : "src/code.ts", "uncommitted\n");
    if (kind.startsWith("staged")) r.git("add", "src/code.ts");
    if (kind === "staged-restored-worktree") {
      r.write("src/code.ts", original);
      expect(r.git("diff", "HEAD")).toBe("");
    }
    const before = r.snapshot();
    fails("DIRTY_SOURCE", () => prepareBatch(r.dir, r.options));
    expect(r.snapshot()).toEqual(before);
  });

  it("blocks source commits made after preparation even when a stored manifest remains unchanged", () => {
    const r = repository();
    r.batch();
    const prepared = prepareBatch(r.dir, r.options);
    r.write("docs/later.md", "later source\n");
    r.commit("later source");
    fails("STALE_MANIFEST", () => verify(r.dir, prepared));
  });

  it("blocks in-progress Git state and an empty batch", () => {
    const r = repository();
    fails("EMPTY_BATCH", () => prepareBatch(r.dir, r.options));
    r.batch();
    writeFileSync(resolve(r.dir, r.git("rev-parse", "--git-path", "MERGE_HEAD")), r.options.mainSha + "\n");
    fails("IN_PROGRESS_OPERATION", () => prepareBatch(r.dir, r.options));
  });

  it.each(["--assume-unchanged", "--skip-worktree"])("rejects hidden working source behind %s index flags", (flag) => {
    const r = repository();
    r.batch();
    r.git("update-index", flag, "src/code.ts");
    r.write("src/code.ts", "export const hiddenChange = true;\n");
    expect(r.git("status", "--porcelain=v1")).toBe("");
    const before = r.snapshot();
    fails("HIDDEN_INDEX_CHANGES", () => prepareBatch(r.dir, r.options));
    expect(r.snapshot()).toEqual(before);
  });

  it("rejects replace refs that make an unrelated main appear to be included", () => {
    const r = repository();
    const localHead = r.batch();
    const localTree = r.git("rev-parse", "HEAD^{tree}");
    r.git("switch", "main");
    r.write("docs/main-only.md", "main-only source\n");
    const advancedMain = r.commit("advanced main");
    r.git("switch", branch);
    fails("MAIN_NOT_INCLUDED", () => prepareBatch(r.dir, { ...r.options, mainSha: advancedMain }));
    const replacement = r.git("commit-tree", localTree, "-p", advancedMain, "-m", "fixture false ancestry");
    r.git("replace", localHead, replacement);
    expect(() => r.git("merge-base", "--is-ancestor", advancedMain, localHead)).not.toThrow();
    fails("UNTRUSTED_GIT_HISTORY", () => prepareBatch(r.dir, { ...r.options, mainSha: advancedMain }));
  });

  it("rejects local graft history instead of interpreting its ancestry", () => {
    const r = repository();
    const head = r.batch();
    const graft = resolve(r.dir, r.git("rev-parse", "--git-path", "info/grafts"));
    mkdirSync(dirname(graft), { recursive: true });
    writeFileSync(graft, head + "\n");
    fails("UNTRUSTED_GIT_HISTORY", () => prepareBatch(r.dir, r.options));
  });

  it.each(["clean", "process"])("blocks an active %s filter before it can run or write to the repository", (kind) => {
    const r = repository();
    r.batch();
    r.write(".gitattributes", "src/code.ts filter=fixture\n");
    r.commit("fixture active attribute");
    const code = readFileSync(resolve(r.dir, "src/code.ts"), "utf8");
    const index = readFileSync(resolve(r.dir, r.git("rev-parse", "--git-path", "index")));
    const refs = r.git("for-each-ref", "--format=%(refname) %(objectname)");
    const marker = resolve(r.dir, ".git/filter-ran");
    r.git("config", `filter.fixture.${kind}`, kind === "clean"
      ? "printf invoked >> .git/filter-ran; cat"
      : "printf invoked >> .git/filter-ran; exit 1");
    r.write("src/code.ts", code);
    fails("ACTIVE_GIT_FILTER", () => prepareBatch(r.dir, r.options));
    expect(existsSync(marker)).toBe(false);
    expect(readFileSync(resolve(r.dir, r.git("rev-parse", "--git-path", "index")))).toEqual(index);
    expect(r.git("for-each-ref", "--format=%(refname) %(objectname)")).toBe(refs);
    expect(readFileSync(resolve(r.dir, "src/code.ts"), "utf8")).toBe(code);
    if (kind === "clean") {
      // Guard 제거 시 실제 부수효과가 발생하는 fixture임을 독립 확인합니다.
      r.git("status", "--porcelain=v1");
      expect(readFileSync(marker, "utf8")).toContain("invoked");
    }
  });

  it("allows configured filters that no tracked file uses without executing them", () => {
    const r = repository();
    r.batch();
    r.git("config", "filter.fixture.clean", "printf invoked >> .git/filter-ran; cat");
    const before = r.snapshot();
    expect(prepareBatch(r.dir, r.options).status).toBe("PASS");
    expect(existsSync(resolve(r.dir, ".git/filter-ran"))).toBe(false);
    expect(r.snapshot()).toEqual(before);
  });

  it.each(["unset", "unspecified"])("does not mistake the literal filter driver %s for an inactive attribute", (driver) => {
    const r = repository();
    r.batch();
    r.write(".gitattributes", `src/code.ts filter=${driver}\n`);
    r.commit("fixture literal attribute value");
    r.git("config", `filter.${driver}.clean`, "printf invoked >> .git/filter-ran; cat");
    r.write("src/code.ts", readFileSync(resolve(r.dir, "src/code.ts"), "utf8"));
    fails("ACTIVE_GIT_FILTER", () => prepareBatch(r.dir, r.options));
    expect(existsSync(resolve(r.dir, ".git/filter-ran"))).toBe(false);
  });

  it.each(["main", "refs/heads/ci/issue-679-batch", "tags/issue-679-batch", "ci/issue-680-wrong", "ci/issue-679-$(echo injected)"])("rejects unsafe or mismatched target %s", (target) => {
    const r = repository();
    r.batch();
    expect(() => prepareBatch(r.dir, { ...r.options, branch: target })).toThrow(BatchError);
  });

  it("requires explicit valid repository, SHA, method and expected-absence intent", () => {
    const r = repository();
    r.batch();
    fails("INVALID_REPOSITORY", () => prepareBatch(r.dir, { ...r.options, repository: "https://token@github.com/owner/repo" }));
    fails("INVALID_SHA", () => prepareBatch(r.dir, { ...r.options, mainSha: "HEAD" }));
    fails("INVALID_EXPECTED_HEAD", () => prepareBatch(r.dir, { ...r.options, expectedHead: undefined } as unknown as BatchIntent));
    fails("INVALID_METHOD", () => prepareBatch(r.dir, { ...r.options, method: "force" } as unknown as BatchIntent));
    fails("LOCAL_BRANCH_MISMATCH", () => prepareBatch(r.dir, { ...r.options, branch: "ci/issue-679-other" }));
  });

  it("does not emit raw Git diagnostics on missing-object failure", () => {
    const r = repository();
    r.batch();
    fails("GIT_READ_FAILED", () => prepareBatch(r.dir, { ...r.options, mainSha: "a".repeat(40) }));
  });

  it.each(["symlink", "submodule", "sensitive", "control-path", "file-directory"])("blocks %s changes requiring separate review", (kind) => {
    const r = repository();
    if (kind === "symlink") symlinkSync("src/code.ts", resolve(r.dir, "linked.ts"));
    if (kind === "submodule") {
      r.git("clone", "--no-local", ".", "external");
      r.git("update-index", "--add", "--cacheinfo", `160000,${r.options.mainSha},external`);
    }
    if (kind === "sensitive") r.write(".env.local", "NOT_A_REAL_SECRET=fixture\n");
    if (kind === "control-path") r.write("docs/bad\npath.md", "fixture\n");
    if (kind === "file-directory") {
      rmSync(resolve(r.dir, "docs/obsolete.md"));
      r.write("docs/obsolete.md/nested.md", "fixture\n");
    }
    // `git add .` would remove the intentionally staged gitlink without a
    // checkout. Commit that fixture directly instead.
    if (kind === "submodule") r.git("commit", "-m", "unsupported gitlink");
    else r.commit("unsupported path or mode");
    const code = kind === "sensitive" ? "SENSITIVE_PATH" : kind === "control-path" ? "UNSAFE_PATH"
      : kind === "file-directory" ? "PATH_TYPE_CHANGE" : "UNSUPPORTED_MODE";
    fails(code, () => prepareBatch(r.dir, r.options));
  });
});

describe("Issue #679 — manifest tampering and remote observation failures", () => {
  it("uses a separately pinned digest and reconstructs source rather than trusting manifest fields", () => {
    const r = repository();
    r.batch();
    const prepared = prepareBatch(r.dir, r.options);
    const changed = structuredClone(prepared);
    changed.manifest.changes[0].sha = "b".repeat(40);
    fails("MANIFEST_CHANGED", () => verifyBatch(r.dir, changed, observation(prepared), {
      phase: "before", manifestSha256: prepared.manifestSha256,
    }));
    changed.manifestSha256 = manifestDigest(changed.manifest);
    fails("STALE_MANIFEST", () => verify(r.dir, changed));
    const forgedTree = structuredClone(prepared);
    forgedTree.manifest.localTree = "b".repeat(40);
    forgedTree.manifestSha256 = manifestDigest(forgedTree.manifest);
    fails("STALE_MANIFEST", () => verify(r.dir, forgedTree));
    fails("INVALID_MANIFEST_DIGEST", () => verifyBatch(r.dir, prepared, observation(prepared), { phase: "before", manifestSha256: "" }));
  });

  it.each([
    ["repository", "REMOTE_TARGET_MISMATCH"], ["branch", "REMOTE_TARGET_MISMATCH"],
    ["main", "MAIN_CHANGED"], ["candidate-tree", "CANDIDATE_TREE_MISMATCH"],
    ["candidate-parents", "CANDIDATE_PARENTS_MISMATCH"], ["unknown", "REMOTE_UNKNOWN"],
    ["third-head", "REMOTE_HEAD_MISMATCH"], ["remote-tree", "REMOTE_TREE_MISMATCH"],
  ])("blocks %s without accepting it as publication evidence", (kind, code) => {
    const r = repository();
    r.batch();
    const prepared = prepareBatch(r.dir, r.options);
    const seen = observation(prepared);
    if (kind === "repository") seen.repository = "other/repository";
    if (kind === "branch") seen.branch = "ci/issue-679-other";
    if (kind === "main") seen.mainSha = "c".repeat(40);
    if (kind === "candidate-tree") seen.candidate.treeSha = "c".repeat(40);
    if (kind === "candidate-parents") seen.candidate.parentShas.push("c".repeat(40));
    if (kind === "unknown") seen.remote.state = "UNKNOWN";
    if (kind === "third-head") seen.remote.headSha = "c".repeat(40);
    if (kind === "remote-tree") seen.remote.treeSha = "c".repeat(40);
    fails(code, () => verify(r.dir, prepared, seen));
  });

  it("distinguishes a rejected update from response loss confirmed at the intended head", () => {
    const r = repository();
    r.batch();
    const prepared = prepareBatch(r.dir, r.options);
    const unchangedRef = observation(prepared, "before");
    fails("REMOTE_HEAD_MISMATCH", () => verify(r.dir, prepared, unchangedRef, "after"));
    const confirmed = observation(prepared, "after");
    expect(verify(r.dir, prepared, confirmed, "after").status).toBe("PASS");
    confirmed.remote.headSha = "d".repeat(40);
    fails("REMOTE_HEAD_MISMATCH", () => verify(r.dir, prepared, confirmed, "after"));
  });

  it("never equates UNKNOWN or a present branch with explicit new-branch absence", () => {
    const r = repository();
    r.batch();
    const prepared = prepareBatch(r.dir, { ...r.options, expectedHead: null });
    const seen = observation(prepared);
    seen.remote.state = "UNKNOWN";
    fails("REMOTE_UNKNOWN", () => verify(r.dir, prepared, seen));
    seen.remote = { state: "PRESENT", headSha: r.options.mainSha, treeSha: prepared.manifest.baseTree };
    fails("REMOTE_HEAD_MISMATCH", () => verify(r.dir, prepared, seen));
  });
});

describe("Issue #679 — CLI contract", () => {
  it("round-trips stdout JSON through ignored evidence files and never changes refs or index", () => {
    const r = repository();
    mkdirSync(resolve(r.dir, "scripts"));
    for (const file of ["pr-batch-core.mjs", "verify-pr-batch.mjs"]) {
      copyFileSync(resolve(projectRoot, "scripts", file), resolve(r.dir, "scripts", file));
    }
    r.batch();
    const cli = (args: string[]) => spawnSync(process.execPath, [resolve(r.dir, "scripts/verify-pr-batch.mjs"), ...args], {
      cwd: r.dir, encoding: "utf8", timeout: 30_000,
    });
    const preparedOutput = cli(["prepare", "--issue=679", "--repository=planner77/masterGantt", `--branch=${branch}`,
      `--main-sha=${r.options.mainSha}`, `--expected-head=${r.options.expectedHead}`, "--method=api"]);
    expect(preparedOutput.status, preparedOutput.stdout + preparedOutput.stderr).toBe(0);
    expect(preparedOutput.stderr).toBe("");
    const prepared = JSON.parse(preparedOutput.stdout) as PreparedBatch;
    r.write(".prepr-reports/prepare.json", preparedOutput.stdout);
    r.write(".prepr-reports/observation.json", JSON.stringify(observation(prepared, "after")));
    const before = r.snapshot();
    const output = cli(["verify", "--phase=after", "--manifest=.prepr-reports/prepare.json",
      `--manifest-sha256=${prepared.manifestSha256}`, "--observation=.prepr-reports/observation.json"]);
    expect(output.status, output.stdout + output.stderr).toBe(0);
    expect(JSON.parse(output.stdout)).toMatchObject({ status: "PASS", requiredCi: "NOT TESTED", approval: "NOT TESTED" });
    expect(JSON.parse(output.stdout).remoteEvidence).toContain("직접 확인한 것은 아닙니다");
    expect(r.snapshot()).toEqual(before);
    const duplicate = cli(["prepare", "--issue=679", "--issue=680"]);
    expect(duplicate.status).toBe(1);
    expect(JSON.parse(duplicate.stdout).code).toBe("INVALID_OPTION");
    const mutation = cli(["publish", "--force=true"]);
    expect(mutation.status).toBe(1);
    expect(JSON.parse(mutation.stdout).code).toBe("INVALID_OPERATION");
    symlinkSync(resolve(r.dir, ".prepr-reports/prepare.json"), resolve(r.dir, ".prepr-reports/link.json"));
    const linked = cli(["verify", "--phase=after", "--manifest=.prepr-reports/link.json",
      `--manifest-sha256=${prepared.manifestSha256}`, "--observation=.prepr-reports/observation.json"]);
    expect(linked.status).toBe(1);
    expect(JSON.parse(linked.stdout).code).toBe("JSON_INPUT");
  });
});
