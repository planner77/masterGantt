import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const SCHEMA = "mastergantt-pr-batch-v1";
const OBSERVATION_SCHEMA = "mastergantt-pr-batch-observation-v1";
const LOCAL_SCOPE = "LOCAL_STRUCTURE_ONLY";
const observationBoundary = "입력 관측값을 비교한 결과이며 이 도구가 GitHub 인증·원격 상태를 직접 확인한 것은 아닙니다.";
const ciBoundary = "로컬 구조 비교는 Required PR CI·Preflight·Trusted QA·Owner 승인을 대체하지 않습니다.";

export class BatchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BatchError";
    this.code = code;
  }
}

function requireValue(condition, code, message) {
  if (!condition) throw new BatchError(code, message);
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function canonical(value, depth = 0) {
  requireValue(depth < 32, "INVALID_JSON", "JSON 구조가 지나치게 깊습니다.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((item) => canonical(item, depth + 1)).join(",") + "]";
  requireValue(record(value), "INVALID_JSON", "지원하지 않는 JSON 값입니다.");
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key], depth + 1)).join(",") + "}";
}

export function manifestDigest(manifest) {
  return createHash("sha256").update(canonical(manifest)).digest("hex");
}

function git(root, args, allowExitOne = false, input = undefined) {
  // 로컬 메타데이터 조회에는 네트워크·필터·훅·index 갱신·자격증명이나
  // 상위 프로세스의 Git 디렉터리 재지정이 필요하지 않습니다.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  env.GIT_OPTIONAL_LOCKS = "0";
  env.GIT_TERMINAL_PROMPT = "0";
  try {
    return execFileSync("git", ["--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args], {
      cwd: root, env, encoding: "buffer", stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], input,
      maxBuffer: 32 * 1024 * 1024, timeout: 15_000,
    });
  } catch (error) {
    if (allowExitOne && error.status === 1) return null;
    // 원문 stderr·명령 인자·로컬 Git 설정을 결과에 노출하지 않습니다.
    throw new BatchError("GIT_READ_FAILED", "로컬 Git 조회에 실패했습니다. 저장소 접근 권한과 객체 존재 여부를 확인하세요.");
  }
}

const gitText = (root, ...args) => git(root, args).toString("utf8").trim();
const isAncestor = (root, ancestor, head) => git(root, ["merge-base", "--is-ancestor", ancestor, head], true) !== null;

function sha(value, label) {
  requireValue(typeof value === "string" && SHA.test(value), "INVALID_SHA", `${label}은 소문자 40자리 Git SHA여야 합니다.`);
  return value;
}

function intent(root, options) {
  requireValue(record(options), "INVALID_INTENT", "게시 대상 설정이 필요합니다.");
  const { repository, issue, branch, method, mainSha, expectedHead } = options;
  requireValue(typeof repository === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) &&
    repository.split("/").every((part) => part !== "." && part !== ".."), "INVALID_REPOSITORY", "저장소는 owner/name 형식이어야 합니다.");
  requireValue(Number.isSafeInteger(issue) && issue > 0, "INVALID_ISSUE", "Issue 번호는 양의 정수여야 합니다.");
  requireValue(typeof branch === "string" && /^[A-Za-z0-9._/-]+$/.test(branch) &&
    !/^(?:main|master|HEAD|refs(?:\/|$)|tags(?:\/|$))$/.test(branch) &&
    !branch.startsWith("refs/") && !branch.startsWith("tags/"), "INVALID_BRANCH", "보호 브랜치·태그 또는 잘못된 게시 브랜치는 사용할 수 없습니다.");
  const issueMatches = [...branch.matchAll(/(?:^|\/)issue-([1-9][0-9]*)(?=-|\/|$)/g)];
  requireValue(issueMatches.length === 1 && Number(issueMatches[0][1]) === issue,
    "ISSUE_BRANCH_MISMATCH", "게시 브랜치는 대상 Issue의 issue-N 이름을 정확히 하나 포함해야 합니다.");
  gitText(root, "check-ref-format", "--branch", branch);
  requireValue(method === "api" || method === "git", "INVALID_METHOD", "게시 방식은 api 또는 git이어야 합니다.");
  sha(mainSha, "main SHA");
  requireValue(expectedHead === null || (typeof expectedHead === "string" && SHA.test(expectedHead)),
    "INVALID_EXPECTED_HEAD", "expected Head에는 정확한 SHA 또는 명시적인 ABSENT가 필요합니다.");
  return { repository, issue, branch, method, mainSha, expectedHead };
}

function rejectActiveFilters(root) {
  // status도 내용을 비교하면서 clean/process 프로그램을 실행할 수 있습니다.
  // 명령 본문 대신 설정 이름과 실제 추적 파일의 attribute만 조회합니다.
  const names = git(root, ["config", "--null", "--name-only", "--get-regexp", "^filter\\..*\\.(clean|process)$"], true);
  if (names === null || names.length === 0) return;
  const configured = new Set(names.toString("utf8").split("\0").filter(Boolean));
  const files = git(root, ["ls-files", "-z"]);
  if (files.length === 0) return;
  const raw = git(root, ["check-attr", "--stdin", "-z", "filter"], false, files);
  const fields = raw.toString("utf8").split("\0");
  requireValue(fields.pop() === "" && fields.length % 3 === 0,
    "ATTRIBUTE_READ_FAILED", "Git filter attribute를 안전하게 확인할 수 없습니다.");
  for (let index = 0; index < fields.length; index += 3) {
    requireValue(fields[index + 1] === "filter", "ATTRIBUTE_READ_FAILED", "예상하지 않은 Git attribute 결과입니다.");
    const driver = fields[index + 2];
    // unset/unspecified라는 실제 driver 이름도 가능하므로, 이 문자열만으로
    // 외부 프로그램 연결이 없다고 판단하지 않습니다.
    requireValue(!configured.has(`filter.${driver}.clean`) && !configured.has(`filter.${driver}.process`),
      "ACTIVE_GIT_FILTER", "추적 파일에 외부 clean/process filter가 연결되어 있습니다. 필터가 없는 검증 환경에서 다시 준비하세요.");
  }
}

function cleanHead(root, branch) {
  const top = gitText(root, "rev-parse", "--show-toplevel");
  requireValue(realpathSync(top) === realpathSync(root), "INVALID_ROOT", "저장소 최상위 경로에서 실행해야 합니다.");
  requireValue(gitText(root, "rev-parse", "--show-object-format") === "sha1", "OBJECT_FORMAT", "GitHub SHA-1 저장소만 지원합니다.");
  requireValue(gitText(root, "symbolic-ref", "--quiet", "--short", "HEAD") === branch,
    "LOCAL_BRANCH_MISMATCH", "로컬 작업 브랜치와 게시 대상 브랜치가 다릅니다.");
  for (const name of ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "index.lock"]) {
    const path = resolve(root, gitText(root, "rev-parse", "--git-path", name));
    requireValue(!existsSync(path), "IN_PROGRESS_OPERATION", "진행 중인 Git 작업 또는 잠금이 있습니다.");
  }
  requireValue(gitText(root, "for-each-ref", "--format=%(refname)", "refs/replace") === "" &&
    !existsSync(resolve(root, gitText(root, "rev-parse", "--git-path", "info/grafts"))),
  "UNTRUSTED_GIT_HISTORY", "replace ref 또는 graft로 변경된 로컬 이력을 게시 증거로 사용할 수 없습니다.");
  const indexFlags = git(root, ["ls-files", "-v", "-z"]).toString("utf8").split("\0").filter(Boolean);
  requireValue(!indexFlags.some((entry) => /^[a-zS] /.test(entry)), "HIDDEN_INDEX_CHANGES",
    "assume-unchanged·skip-worktree 표시는 실제 파일 변경을 숨길 수 있으므로 게시 전에 해제·재검증해야 합니다.");
  rejectActiveFilters(root);
  // `git diff HEAD`만 보면 stage 뒤 worktree를 HEAD 내용으로 복원한
  // 경우의 index 변경을 놓칩니다. index와 worktree를 모두 확인합니다.
  requireValue(git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).length === 0,
    "DIRTY_SOURCE", "staged·unstaged·untracked 변경을 포함해 커밋되지 않은 파일이 있습니다.");
  return sha(gitText(root, "rev-parse", "HEAD"), "로컬 Head");
}

function committed(root, object) {
  requireValue(gitText(root, "cat-file", "-t", object) === "commit", "NOT_COMMIT", "입력 SHA가 commit 객체가 아닙니다.");
}

function treeEntries(root, tree) {
  const entries = new Map();
  const raw = git(root, ["ls-tree", "-r", "-z", tree]);
  const decoded = raw.toString("utf8");
  requireValue(Buffer.from(decoded, "utf8").equals(raw), "PATH_ENCODING", "UTF-8로 정확히 표현되지 않는 Git 경로는 지원하지 않습니다.");
  for (const line of decoded.split("\0").filter(Boolean)) {
    const tab = line.indexOf("\t");
    const [mode, type, object] = line.slice(0, tab).split(" ");
    const path = line.slice(tab + 1);
    requireValue(tab > 0 && SHA.test(object) && !entries.has(path), "INVALID_TREE", "Git tree 항목을 안전하게 해석할 수 없습니다.");
    entries.set(path, { mode, type, sha: object });
  }
  return entries;
}

function safePath(path) {
  requireValue(path.length > 0 && !path.startsWith("/") && !/[\\\u0000-\u001f\u007f]/.test(path) &&
    path.split("/").every((part) => part !== "." && part !== ".." && part.toLowerCase() !== ".git" && part !== ""),
  "UNSAFE_PATH", "변경 경로에 허용되지 않는 경로 요소나 제어 문자가 있습니다.");
  requireValue(!path.split("/").some((part) => /^\.env(?:\.|$)/i.test(part) && part !== ".env.example"),
    "SENSITIVE_PATH", "실제 환경 설정 파일은 배치 게시 대상에 포함할 수 없습니다.");
}

function changesBetween(root, baseTree, localTree) {
  const before = treeEntries(root, baseTree);
  const after = treeEntries(root, localTree);
  const changes = [];
  for (const path of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const oldEntry = before.get(path);
    const newEntry = after.get(path);
    if (canonical(oldEntry ?? null) === canonical(newEntry ?? null)) continue;
    safePath(path);
    for (const entry of [oldEntry, newEntry].filter(Boolean)) {
      requireValue(entry.type === "blob" && ["100644", "100755"].includes(entry.mode),
        "UNSUPPORTED_MODE", "변경된 symlink·submodule·특수 모드는 별도 검토가 필요합니다.");
    }
    const size = newEntry ? Number(gitText(root, "cat-file", "-s", newEntry.sha)) : null;
    requireValue(size === null || (Number.isSafeInteger(size) && size >= 0), "INVALID_BLOB_SIZE", "Blob 크기를 확인할 수 없습니다.");
    changes.push({
      path, action: newEntry ? "upsert" : "delete",
      mode: newEntry?.mode ?? oldEntry.mode, sha: newEntry?.sha ?? null,
      previousMode: oldEntry?.mode ?? null, previousSha: oldEntry?.sha ?? null, size,
    });
  }
  // 파일/디렉터리 교체에는 별도 tree 구성 검토가 필요합니다.
  // 서로 겹치는 경로 변경을 API 게시 담당자에게 그대로 전달하지 않습니다.
  const paths = new Set(changes.map((change) => change.path));
  for (const path of paths) {
    const parts = path.split("/");
    parts.pop();
    while (parts.length) {
      requireValue(!paths.has(parts.join("/")), "PATH_TYPE_CHANGE", "파일과 디렉터리 간 교체는 별도 tree 검토가 필요합니다.");
      parts.pop();
    }
  }
  requireValue(changes.length > 0, "EMPTY_BATCH", "게시할 파일 변경이 없습니다.");
  return changes;
}

export function prepareBatch(root, options) {
  const target = intent(root, options);
  const localHead = cleanHead(root, target.branch);
  committed(root, target.mainSha);
  requireValue(isAncestor(root, target.mainSha, localHead), "MAIN_NOT_INCLUDED", "로컬 후보에 지정한 최신 main의 이력이 포함되어 있지 않습니다.");
  if (target.expectedHead !== null) {
    committed(root, target.expectedHead);
    requireValue(isAncestor(root, target.expectedHead, localHead), "REMOTE_NOT_INCLUDED", "로컬 후보에 기존 원격 Head의 이력이 포함되어 있지 않습니다.");
  }
  const base = target.expectedHead ?? target.mainSha;
  const localTree = gitText(root, "rev-parse", `${localHead}^{tree}`);
  const baseTree = gitText(root, "rev-parse", `${base}^{tree}`);
  let publishParents;
  if (target.method === "git") {
    publishParents = gitText(root, "show", "--no-patch", "--format=%P", localHead).split(" ").filter(Boolean);
  } else {
    publishParents = [base];
    if (target.expectedHead !== null && !isAncestor(root, target.mainSha, target.expectedHead)) publishParents.push(target.mainSha);
  }
  // working diff·untracked가 모두 없는 소스에서 prepr-core가 만드는
  // fingerprint와 같습니다. 호환성 테스트로 이 좁은 연결을 검증하며
  // 기존 Pre-PR 동작이나 전체 선정 정책은 변경하지 않습니다.
  const sourceFingerprint = createHash("sha256").update(JSON.stringify({ baseSha: target.mainSha, head: localHead })).digest("hex");
  const manifest = {
    schema: SCHEMA, ...target, localHead, localTree, baseTree, publishParents,
    sourceFingerprint, changes: changesBetween(root, baseTree, localTree),
  };
  requireValue(cleanHead(root, target.branch) === localHead, "STALE_SOURCE", "준비 도중 로컬 소스가 바뀌었습니다.");
  return {
    status: "PASS", scope: LOCAL_SCOPE, operation: "prepare", manifestSha256: manifestDigest(manifest), manifest,
    remoteEvidence: observationBoundary, requiredCi: "NOT TESTED", approval: "NOT TESTED", boundary: ciBoundary,
  };
}

export function verifyBatch(root, prepared, observation, options) {
  requireValue(record(options) && ["before", "after"].includes(options.phase), "INVALID_PHASE", "검증 시점은 before 또는 after여야 합니다.");
  requireValue(typeof options.manifestSha256 === "string" && DIGEST.test(options.manifestSha256),
    "INVALID_MANIFEST_DIGEST", "준비 시 별도 기록한 64자리 manifest SHA-256이 필요합니다.");
  requireValue(record(prepared) && prepared.status === "PASS" && prepared.scope === LOCAL_SCOPE &&
    record(prepared.manifest) && prepared.manifest.schema === SCHEMA, "INVALID_MANIFEST", "유효한 prepare 결과가 필요합니다.");
  const manifest = prepared.manifest;
  requireValue(manifestDigest(manifest) === options.manifestSha256 && prepared.manifestSha256 === options.manifestSha256,
    "MANIFEST_CHANGED", "준비 시 기록한 manifest와 다릅니다. 게시를 중단하세요.");
  const rebuilt = prepareBatch(root, manifest);
  requireValue(canonical(rebuilt.manifest) === canonical(manifest), "STALE_MANIFEST", "manifest가 현재 로컬 소스·tree·변경 목록과 일치하지 않습니다.");
  requireValue(record(observation) && observation.schema === OBSERVATION_SCHEMA,
    "INVALID_OBSERVATION", "지원하는 원격 관측 JSON 형식이 아닙니다.");
  requireValue(observation.repository === manifest.repository && observation.branch === manifest.branch,
    "REMOTE_TARGET_MISMATCH", "관측한 저장소·브랜치가 준비한 게시 대상과 다릅니다.");
  requireValue(observation.mainSha === manifest.mainSha, "MAIN_CHANGED", "관측한 최신 main SHA가 준비 시점과 다릅니다.");
  const candidate = observation.candidate;
  requireValue(record(candidate), "CANDIDATE_UNKNOWN", "실제 생성한 게시 후보의 commit·tree·parent 관측값이 필요합니다.");
  sha(candidate.headSha, "후보 Head");
  requireValue(candidate.treeSha === manifest.localTree, "CANDIDATE_TREE_MISMATCH", "후보의 전체 tree가 로컬 검증 tree와 다릅니다.");
  requireValue(Array.isArray(candidate.parentShas) && canonical(candidate.parentShas) === canonical(manifest.publishParents),
    "CANDIDATE_PARENTS_MISMATCH", "후보 commit의 부모 목록이 기대한 기존 Head·main 이력을 보존하지 않습니다.");
  requireValue(!candidate.parentShas.includes(candidate.headSha), "INVALID_CANDIDATE", "후보 commit과 부모 SHA가 같을 수 없습니다.");
  if (manifest.method === "git") {
    requireValue(candidate.headSha === manifest.localHead, "GIT_HEAD_MISMATCH", "Git push 후보는 검증한 로컬 Head와 같아야 합니다.");
  }
  const remote = observation.remote;
  requireValue(record(remote) && ["PRESENT", "ABSENT"].includes(remote.state),
    "REMOTE_UNKNOWN", "인증 실패·권한 미확인·응답 유실을 브랜치 부재로 판단할 수 없습니다.");
  const expected = options.phase === "before" ? manifest.expectedHead : candidate.headSha;
  if (expected === null) {
    requireValue(remote.state === "ABSENT" && remote.headSha === null && remote.treeSha === null,
      "REMOTE_HEAD_MISMATCH", "신규 게시 전 브랜치가 명시적으로 부재인지 확인해야 합니다.");
  } else {
    requireValue(remote.state === "PRESENT" && remote.headSha === expected,
      "REMOTE_HEAD_MISMATCH", "원격 Head가 기대값과 다릅니다. 경합·게시 거부·응답 유실을 먼저 확인하세요.");
    requireValue(remote.treeSha === (options.phase === "before" ? manifest.baseTree : manifest.localTree),
      "REMOTE_TREE_MISMATCH", "원격 전체 tree가 기대값과 다릅니다.");
  }
  requireValue(cleanHead(root, manifest.branch) === manifest.localHead,
    "STALE_SOURCE", "관측값을 대조하는 동안 로컬 소스가 바뀌었습니다.");
  return {
    status: "PASS", scope: LOCAL_SCOPE, operation: "verify", phase: options.phase,
    manifestSha256: options.manifestSha256, repository: manifest.repository, branch: manifest.branch,
    localHead: manifest.localHead, candidateHead: candidate.headSha, remoteHead: remote.headSha, treeSha: manifest.localTree,
    remoteEvidence: observationBoundary, requiredCi: "NOT TESTED", approval: "NOT TESTED", boundary: ciBoundary,
  };
}
