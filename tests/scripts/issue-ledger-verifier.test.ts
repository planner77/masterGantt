import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gitLedgerBaseline, LOCAL_STAGES, validateLedger, validateLedgerFilePrefixes } from "../../scripts/issue-ledger-core.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const allocated: string[] = [];
afterEach(() => allocated.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
function fixture() {
  const dir = mkdtempSync(resolve(tmpdir(), "mastergantt-ledger-")); allocated.push(dir);
  for (const path of ["docs", "tests/domain"]) mkdirSync(resolve(dir, path), { recursive: true });
  writeFileSync(resolve(dir, "docs/ISSUE_1_FAILURE_ANALYSIS.md"), "# 원장\n\n## F1-001 · 합성 실패\n\n최초 오류와 후속 결과를 보존.\n");
  writeFileSync(resolve(dir, "docs/ISSUE_2_FAILURE_ANALYSIS.md"), "# 연결\n[Primary](ISSUE_1_FAILURE_ANALYSIS.md)\n");
  writeFileSync(resolve(dir, "tests/domain/contract.test.ts"), "// 합성 계약 fixture\n");
  const source = "a".repeat(40);
  const failed = { id: "first", at: "2026-11-10T00:00:00Z", timeNote: null, stage: "UNIT", status: "FAIL", sourceSha: source, fixSourceSha: null as string | null, sourceFingerprint: null, environment: "synthetic-linux-node22", environmentVersion: "fixture-v1", command: ["npm", "test"], exit: 1, exitNote: null, expected: "계약 성공", actual: "합성 음성 계약 실패", input: "비운영 합성 값", classification: "FIXTURE", recovery: "후속 event 추가", residualRisk: "실제 운영 증거 아님", evidenceScope: "SCOPED", synthetic: true, imageDigest: null as string | null, backupId: null as string | null, remoteCi: "N/A", evidence: [{ kind: "DOCUMENT", reference: "docs/ISSUE_1_FAILURE_ANALYSIS.md" }] };
  const index = { schemaVersion: 1, issues: [{ issue: 1, primaryIssue: 1, ledger: "docs/ISSUE_1_FAILURE_ANALYSIS.md" }, { issue: 2, primaryIssue: 1, ledger: "docs/ISSUE_2_FAILURE_ANALYSIS.md" }], failures: [{ id: "F1-001", issue: 1, ledger: "docs/ISSUE_1_FAILURE_ANALYSIS.md", relatedIssues: [2], domain: "fixture", layer: "unit", keywords: ["append-only"], cause: "합성 검증 입력", historyOnly: false, tests: [{ path: "tests/domain/contract.test.ts", case: "합성 회귀", historical: false }], residualRisk: "운영 결과 아님", events: [failed] }] };
  return { dir, index, source };
}
function pass(f: ReturnType<typeof fixture>, stage = "UNIT") {
  const original = f.index.failures[0].events[0];
  const imageDigest = ["GHCR_PUSH", "GHCR_PULL", "DEPLOY", "RESTORE", "ROLLBACK"].includes(stage) ? "sha256:" + "f".repeat(64) : original.imageDigest;
  const backupId = ["BACKUP", "RESTORE"].includes(stage) ? "synthetic-backup-001" : original.backupId;
  return { ...structuredClone(original), imageDigest, backupId, id: "fixed", at: "2026-11-10T00:01:00Z", stage, status: "PASS", sourceSha: "b".repeat(40), fixSourceSha: "b".repeat(40), exit: 0, actual: "같은 수정 source를 실제 합성 실행", verification: { sourceSha: "b".repeat(40), environment: original.environment, imageDigest, backupId } };
}
function check(f: ReturnType<typeof fixture>, index: unknown = f.index, previous: unknown = null) { return validateLedger(index, { root: f.dir, previous }); }
function repo(f: ReturnType<typeof fixture>) {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: f.dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main"); git("config", "user.name", "Synthetic Ledger"); git("config", "user.email", "ledger@example.invalid"); git("add", "."); git("commit", "-m", "synthetic baseline without index");
  return git;
}

describe("Issue #907 — append-only 원본과 실제 결과 경계", () => {
  it("FAIL→수정 source PASS를 추가해도 원본 source/오류/시각을 그대로 보존한다", () => {
    const f = fixture(), previous = structuredClone(f.index);
    f.index.failures[0].events.push(pass(f));
    const r = check(f, f.index, previous);
    expect(r.status).toBe("PASS"); expect(r.publicationEvidence).toBe(false);
    expect(f.index.failures[0].events[0]).toEqual(previous.failures[0].events[0]);
  });
  it.each(["BLOCKED", "NOT TESTED"])("%s·미수집 시각/exit를 PASS로 바꾸지 않는다", (status) => {
    const f = fixture(), event = f.index.failures[0].events[0];
    Object.assign(event, { status, at: null, timeNote: "시각 미수집", exit: null, exitNote: "환경상 실행 불가/미실행" });
    expect(check(f).status).toBe("PASS");
    Object.assign(event, { status: "PASS" }); expect(check(f).status).toBe("FAIL");
  });
  it.each(["GHCR_PUSH", "OPERATION", "RESTORE"])("합성 %s 실패/재실행을 원본 손실 없이 검증하고 운영 결과와 구분한다", (stage) => {
    const f = fixture(); f.index.failures[0].events[0].stage = stage;
    const previous = structuredClone(f.index); f.index.failures[0].events.push(pass(f, stage));
    expect(check(f, f.index, previous).status).toBe("PASS");
    expect(f.index.failures[0].events.every((e) => e.synthetic)).toBe(true);
    expect(check(f).publicationEvidence).toBe(false);
  });
  it.each(["edit", "delete", "reorder", "metadata"])("기존 %s 변경을 append-only 위반으로 거부한다", (mutation) => {
    const f = fixture(); f.index.failures[0].events.push(pass(f)); const previous = structuredClone(f.index);
    if (mutation === "edit") f.index.failures[0].events[0].actual = "오류를 성공으로 교체";
    if (mutation === "delete") f.index.failures[0].events.shift();
    if (mutation === "reorder") f.index.failures[0].events.reverse();
    if (mutation === "metadata") f.index.failures[0].cause = "기존 원인 제거";
    expect(check(f, f.index, previous).errors.join(" ")).toMatch(/append-only/);
  });
  it("source/환경/image/backup 결속이 바뀐 PASS를 거부한다", () => {
    for (const field of ["sourceSha", "environment", "imageDigest", "backupId"]) {
      const f = fixture(); const event = pass(f);
      Object.assign(event.verification, { [field]: "다른 근거" }); f.index.failures[0].events.push(event);
      expect(check(f).status).toBe("FAIL");
    }
  });
  it("EXACT PASS에는 지문을 요구하고 현재 source/env 재사용 비교도 수행한다", () => {
    const f = fixture(); const event = pass(f); event.evidenceScope = "EXACT"; f.index.failures[0].events.push(event);
    expect(check(f).status).toBe("FAIL");
    Object.assign(event, { sourceFingerprint: "c".repeat(64) }); expect(check(f).status).toBe("PASS");
    expect(validateLedger(f.index, { root: f.dir, expectedSource: "d".repeat(40) }).status).toBe("FAIL");
    expect(validateLedger(f.index, { root: f.dir, expectedEnvironment: "other" }).status).toBe("FAIL");
  });
  it("단일 Primary 연결을 유지하고 중복 Failure/Issue/event ID를 거부한다", () => {
    for (const mutation of ["issue", "failure", "event", "primary"]) {
      const f = fixture();
      if (mutation === "issue") f.index.issues.push(structuredClone(f.index.issues[0]));
      if (mutation === "failure") f.index.failures.push(structuredClone(f.index.failures[0]));
      if (mutation === "event") f.index.failures[0].events.push(structuredClone(f.index.failures[0].events[0]));
      if (mutation === "primary") f.index.failures[0].issue = 2;
      expect(check(f).status).toBe("FAIL");
    }
  });
  it("현재 테스트 경로 삭제/원장 링크 누락/heading 누락/path escape를 거부한다", () => {
    const f = fixture(); rmSync(resolve(f.dir, "tests/domain/contract.test.ts"));
    expect(check(f).errors.join(" ")).toMatch(/누락된 경로/);
    const g = fixture(); writeFileSync(resolve(g.dir, "docs/ISSUE_2_FAILURE_ANALYSIS.md"), "연결 없음");
    expect(check(g).errors.join(" ")).toMatch(/Primary 링크/);
    const h = fixture(); h.index.failures[0].tests[0].path = "tests/../../secret"; expect(check(h).status).toBe("FAIL");
    const j = fixture(); writeFileSync(resolve(j.dir, "docs/ISSUE_1_FAILURE_ANALYSIS.md"), "원본 ID 없음"); expect(check(j).status).toBe("FAIL");
  });
  it("외부 symlink와 공개 인덱스의 명백한 Secret/내부 주소를 거부한다", () => {
    const f = fixture(); rmSync(resolve(f.dir, "tests/domain/contract.test.ts")); symlinkSync(resolve(root, "package.json"), resolve(f.dir, "tests/domain/contract.test.ts"));
    expect(check(f).status).toBe("FAIL");
    const g = fixture(); g.index.failures[0].cause = "http://192.168.1.2/private"; expect(check(g).status).toBe("FAIL");
  });
  it("원격 CI stage는 역사로만 허용하고 신규 가짜 PR/CI authority를 거부한다", () => {
    const f = fixture(); f.index.failures[0].events[0].stage = "PR_CI"; expect(check(f).status).toBe("FAIL");
    f.index.failures[0].historyOnly = true; f.index.failures[0].events[0].remoteCi = "historical run only"; expect(check(f).status).toBe("PASS");
    f.index.failures[0].historyOnly = false; f.index.failures[0].events[0].stage = "UNIT"; expect(check(f).status).toBe("FAIL");
  });
  it("모든 새 로컬/게시/복구 stage를 지원하고 알 수 없는 상태는 거부한다", () => {
    for (const stage of LOCAL_STAGES) { const f = fixture(); f.index.failures[0].events[0].stage = stage; expect(check(f).status).toBe("PASS"); }
    const f = fixture(); f.index.failures[0].events[0].status = "SKIPPED"; expect(check(f).status).toBe("FAIL");
    expect(check(f, { schemaVersion: 1, issues: [null], failures: [null] }).status).toBe("FAIL");
  });
  it("Git로 새 인덱스 부재 bootstrap과 이전 event prefix를 확인한다", () => {
    const f = fixture(), git = repo(f); const before = gitLedgerBaseline(f.dir, "docs/REGRESSION_INDEX.json"); expect(before.bootstrap).toBe(true);
    writeFileSync(resolve(f.dir, "docs/REGRESSION_INDEX.json"), JSON.stringify(f.index)); git("add", "."); git("commit", "-m", "introduce index");
    expect(gitLedgerBaseline(f.dir, "docs/REGRESSION_INDEX.json").bootstrap).toBe(true);
    f.index.failures[0].events.push(pass(f)); writeFileSync(resolve(f.dir, "docs/REGRESSION_INDEX.json"), JSON.stringify(f.index));
    const existing = gitLedgerBaseline(f.dir, "docs/REGRESSION_INDEX.json"); expect(existing.bootstrap).toBe(false); expect(check(f, f.index, existing.previous).status).toBe("PASS");
    f.index.failures[0].events[0].actual = "최초 실패 덮어쓰기"; expect(check(f, f.index, existing.previous).status).toBe("FAIL");
  });
  it("Git baseline이 없거나 옵션이 잘못되면 CLI는 BLOCKED이며 기록을 쓰지 않는다", () => {
    const f = fixture(); writeFileSync(resolve(f.dir, "docs/REGRESSION_INDEX.json"), JSON.stringify(f.index));
    const result = spawnSync(process.execPath, [resolve(root, "scripts/verify-issue-ledger.mjs"), `--root=${f.dir}`], { encoding: "utf8" });
    expect(result.status).toBe(1); expect(result.stderr).toContain("BLOCKED");
    expect(JSON.parse(readFileSync(resolve(f.dir, "docs/REGRESSION_INDEX.json"), "utf8"))).toEqual(f.index);
  });
  it("Git의 Markdown 원본 prefix도 검사하며 원장 overwrite와 fake previous 우회를 거부한다", () => {
    const f = fixture(), git = repo(f); const baseline = git("rev-parse", "HEAD");
    writeFileSync(resolve(f.dir, "docs/REGRESSION_INDEX.json"), JSON.stringify(f.index));
    expect(validateLedgerFilePrefixes(f.dir, f.index, baseline).status).toBe("PASS");
    writeFileSync(resolve(f.dir, "docs/ISSUE_1_FAILURE_ANALYSIS.md"), "# 최초 오류를 삭제한 원장\n## F1-001 · 합성 실패\n");
    expect(validateLedgerFilePrefixes(f.dir, f.index, baseline).status).toBe("FAIL");
    const r = spawnSync(process.execPath, [resolve(root, "scripts/verify-issue-ledger.mjs"), `--root=${f.dir}`], { encoding: "utf8" });
    expect(r.status).toBe(1); expect(r.stdout).toContain("Markdown 원본");
  });
  it("명시 previous 파일이 actual Git index event 원본을 대체하지 못한다", () => {
    const f = fixture(), git = repo(f);
    writeFileSync(resolve(f.dir, "docs/REGRESSION_INDEX.json"), JSON.stringify(f.index)); git("add", "."); git("commit", "-m", "index baseline");
    f.index.failures[0].events[0].actual = "원본 실패 숨김";
    writeFileSync(resolve(f.dir, "docs/REGRESSION_INDEX.json"), JSON.stringify(f.index));
    writeFileSync(resolve(f.dir, "empty.json"), JSON.stringify({ schemaVersion: 1, issues: [], failures: [] }));
    const r = spawnSync(process.execPath, [resolve(root, "scripts/verify-issue-ledger.mjs"), `--root=${f.dir}`, "--previous=empty.json"], { encoding: "utf8" });
    expect(r.status).toBe(1); expect(r.stdout).toContain("append-only event");
  });

  it("GHCR/복원 PASS에 실제 image/backup 결속이 없으면 거부한다", () => {
    const f = fixture(), event = pass(f, "RESTORE"); f.index.failures[0].events.push(event);
    expect(check(f).status).toBe("PASS");
    event.backupId = null; event.verification.backupId = null;
    expect(check(f).status).toBe("FAIL");
    event.backupId = "synthetic-backup-001"; event.verification.backupId = event.backupId;
    event.imageDigest = null; event.verification.imageDigest = null;
    expect(check(f).status).toBe("FAIL");
  });

});
