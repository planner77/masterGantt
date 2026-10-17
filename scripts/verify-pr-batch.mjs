#!/usr/bin/env node
import { lstatSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BatchError, prepareBatch, verifyBatch } from "./pr-batch-core.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function help() {
  console.log(`PR 변경 묶음 준비·대조 — 원격 쓰기·CI 실행을 수행하지 않습니다.

준비:
  node scripts/verify-pr-batch.mjs prepare --issue=679 --repository=planner77/masterGantt \\
    --branch=ci/issue-679-batch-publish --main-sha=<40자리SHA> \\
    --expected-head=<40자리SHA|ABSENT> --method=<api|git>

게시 직전/직후 관측값 비교:
  node scripts/verify-pr-batch.mjs verify --phase=<before|after> \\
    --manifest=<prepare.json> --manifest-sha256=<준비시별도기록한64자리hash> \\
    --observation=<observation.json>

prepare stdout의 manifestSha256은 게시 작업 전에 별도 보존하세요.
원격 관측 JSON: {"schema":"mastergantt-pr-batch-observation-v1",
  "repository":"owner/name","branch":"ci/issue-679-example","mainSha":"...",
  "remote":{"state":"PRESENT|ABSENT|UNKNOWN","headSha":null,"treeSha":null},
  "candidate":{"headSha":"...","treeSha":"...","parentShas":["..."]}}
PRESENT에는 실제 Head/tree SHA를, 확인된 ABSENT에는 null을 입력합니다.
관측값은 호출자가 인증된 도구에서 수집해야 하며 이 CLI는 입력 대조만 합니다.
PASS는 로컬 구조 비교 결과입니다. Required CI·Trusted QA·Owner 승인은 별도입니다.
JSON 출력 파일은 저장소 밖 또는 ignored .prepr-reports/에 보존하세요.
`);
}

function parse(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) return { help: true };
  const operation = argv[0];
  if (!["prepare", "verify"].includes(operation)) throw new BatchError("INVALID_OPERATION", "prepare 또는 verify 작업만 지원합니다.");
  const allowed = operation === "prepare"
    ? ["issue", "repository", "branch", "main-sha", "expected-head", "method"]
    : ["phase", "manifest", "manifest-sha256", "observation"];
  const values = {};
  for (const arg of argv.slice(1)) {
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/.exec(arg);
    if (!match || !allowed.includes(match[1]) || Object.hasOwn(values, match[1])) {
      throw new BatchError("INVALID_OPTION", "알 수 없거나 중복된 옵션입니다. --이름=값 형식을 사용하세요.");
    }
    values[match[1]] = match[2];
  }
  if (allowed.some((name) => !Object.hasOwn(values, name))) throw new BatchError("MISSING_OPTION", "필수 옵션이 누락되었습니다. --help를 확인하세요.");
  return { operation, values };
}

function jsonFile(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw new Error("invalid file");
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new BatchError("JSON_INPUT", "JSON 입력은 4MiB 이하의 읽을 수 있는 일반 파일이어야 합니다. symlink는 지원하지 않습니다.");
  }
}

try {
  const options = parse(process.argv.slice(2));
  if (options.help) help();
  else {
    const v = options.values;
    let result;
    if (options.operation === "prepare") {
      if (!/^[1-9][0-9]*$/.test(v.issue)) throw new BatchError("INVALID_ISSUE", "Issue 번호는 양의 정수여야 합니다.");
      result = prepareBatch(root, {
        issue: Number(v.issue), repository: v.repository, branch: v.branch, method: v.method,
        mainSha: v["main-sha"], expectedHead: v["expected-head"] === "ABSENT" ? null : v["expected-head"],
      });
    } else {
      result = verifyBatch(root, jsonFile(v.manifest), jsonFile(v.observation), {
        phase: v.phase, manifestSha256: v["manifest-sha256"],
      });
    }
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  const known = error instanceof BatchError;
  console.log(JSON.stringify({
    status: "BLOCKED", scope: "LOCAL_STRUCTURE_ONLY", code: known ? error.code : "LOCAL_READ_FAILED",
    reason: known ? error.message : "로컬 자료를 안전하게 읽지 못했습니다. 입력 파일과 Git 상태를 확인하세요.",
    requiredCi: "NOT TESTED", approval: "NOT TESTED",
  }, null, 2));
  process.exitCode = 1;
}
