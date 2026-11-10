import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const LOCAL_STAGES = ["LOCAL_PREP", "STATIC", "UNIT", "INTEGRATION", "PLAYWRIGHT", "VISUAL", "DOCKER", "SQLITE", "GIT_PUSH", "GHCR_BUILD", "GHCR_PUSH", "GHCR_PULL", "DEPLOY", "SMOKE", "OPERATION", "BACKUP", "RESTORE", "ROLLBACK"];
const HISTORICAL_STAGES = ["PR_CI", "MAIN_CI", "RELEASE", "FINALIZER"];
const STATES = ["PASS", "FAIL", "BLOCKED", "NOT TESTED"];
const sha = (s) => typeof s === "string" && /^[a-f0-9]{40}$/.test(s);
const digest = (s) => s === null || (typeof s === "string" && /^sha256:[a-f0-9]{64}$/.test(s));
const nonempty = (s) => typeof s === "string" && s.trim().length > 0;
const stable = (v) => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x);
const inside = (root, file) => { const p = relative(root, file); return p !== ".." && !p.startsWith(".." + sep) && !isAbsolute(p); };

export function validateLedger(index, { root, previous = null, expectedSource = null, expectedEnvironment = null } = {}) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const list = (v) => Array.isArray(v) ? v : [];
  const file = (path, prefix) => {
    if (!nonempty(path) || isAbsolute(path) || path.includes("\\") || path.split("/").includes("..") || !path.startsWith(prefix)) { errors.push(`허용되지 않은 경로: ${path}`); return null; }
    const full = resolve(root, path);
    if (!inside(resolve(root), full) || !existsSync(full)) { errors.push(`누락된 경로: ${path}`); return null; }
    if (!inside(realpathSync(root), realpathSync(full)) || lstatSync(full).isSymbolicLink() || !lstatSync(full).isFile()) { errors.push(`일반 저장소 파일이 아님: ${path}`); return null; }
    return full;
  };
  const text = stable(index);
  check(!/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|Authorization:\s*Bearer\s+[^ ]+|https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.))/i.test(text), "공개 인덱스에 비밀값/내부 주소로 보이는 자료가 있습니다.");
  check(index?.schemaVersion === 1, "schemaVersion은 1이어야 합니다.");
  check(Array.isArray(index?.issues) && Array.isArray(index?.failures), "issues/failures 배열이 필요합니다.");
  const issues = new Map();
  for (const item of list(index?.issues)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) { errors.push("Issue object 필요"); continue; }
    check(Number.isSafeInteger(item.issue) && item.issue > 0 && !issues.has(item.issue), `Issue 중복/오류: ${item.issue}`);
    check(item.ledger === `docs/ISSUE_${item.issue}_FAILURE_ANALYSIS.md`, `Issue 단일 원장 경로 오류: ${item.issue}`);
    file(item.ledger, "docs/");
    issues.set(item.issue, item);
  }
  for (const item of issues.values()) {
    check(issues.has(item.primaryIssue), `Primary Issue 누락: ${item.issue}`);
    if (item.primaryIssue !== item.issue) {
      const primary = issues.get(item.primaryIssue);
      check(primary?.primaryIssue === item.primaryIssue, `Primary alias 순환/중첩: ${item.issue}`);
      const body = existsSync(resolve(root, item.ledger)) ? readFileSync(resolve(root, item.ledger), "utf8") : "";
      check(body.includes(`ISSUE_${item.primaryIssue}_FAILURE_ANALYSIS.md`), `연결 원장에 Primary 링크가 없습니다: ${item.issue}`);
    }
  }
  const failures = new Map();
  const eventIds = new Set();
  for (const failure of list(index?.failures)) {
    if (!failure || typeof failure !== "object" || Array.isArray(failure)) { errors.push("Failure object 필요"); continue; }
    check(nonempty(failure.id) && /^[A-Z][A-Z0-9-]+$/.test(failure.id) && !failures.has(failure.id), `Failure ID 중복/오류: ${failure.id}`);
    failures.set(failure.id, failure);
    const issue = issues.get(failure.issue);
    check(issue?.primaryIssue === failure.issue, `Failure는 Primary 원장에만 등록합니다: ${failure.id}`);
    check(failure.ledger === issue?.ledger, `Failure 원장 불일치: ${failure.id}`);
    const ledgerPath = file(failure.ledger, "docs/");
    if (ledgerPath) check(readFileSync(ledgerPath, "utf8").includes(`## ${failure.id} `) || readFileSync(ledgerPath, "utf8").includes(`## ${failure.id} ·`), `원장 Failure heading 누락: ${failure.id}`);
    for (const key of ["domain", "layer", "cause", "residualRisk"]) check(nonempty(failure[key]), `${failure.id}: ${key} 필요`);
    check(list(failure.keywords).length > 0 && failure.keywords.every(nonempty), `${failure.id}: 증상 키워드 필요`);
    check(list(failure.relatedIssues).every((n) => Number.isSafeInteger(n) && n > 0), `${failure.id}: relatedIssues 오류`);
    check(list(failure.tests).length > 0, `${failure.id}: 재사용 테스트 필요`);
    for (const test of list(failure.tests)) {
      check(nonempty(test.case), `${failure.id}: 테스트 case 필요`);
      if (test.historical === true) check(failure.historyOnly === true && sha(test.sourceSha) && nonempty(test.reason), `${failure.id}: 낡은 테스트는 과거 source/reason이 필요합니다.`);
      else file(test.path, "tests/");
    }
    check(list(failure.events).length > 0, `${failure.id}: 원본 event 필요`);
    let lastTime = -Infinity;
    for (const event of list(failure.events)) {
      if (!event || typeof event !== "object" || Array.isArray(event)) { errors.push("Event object 필요"); continue; }
      const name = `${failure.id}/${event.id}`;
      check(nonempty(event.id) && !eventIds.has(name), `${name}: event ID 중복/오류`);
      eventIds.add(name);
      check(STATES.includes(event.status), `${name}: 상태 오류`);
      check(LOCAL_STAGES.includes(event.stage) || (failure.historyOnly === true && HISTORICAL_STAGES.includes(event.stage)), `${name}: 신규 원격 stage 또는 알 수 없는 stage`);
      const time = event.at === null ? null : Date.parse(event.at);
      check(time === null ? nonempty(event.timeNote) : Number.isFinite(time) && time >= lastTime, `${name}: 시각 또는 미수집 사유 오류`);
      if (time !== null && Number.isFinite(time)) lastTime = time;
      check(sha(event.sourceSha), `${name}: source SHA 필요`);
      check(event.fixSourceSha === null || sha(event.fixSourceSha), `${name}: 수정 SHA 오류`);
      check(nonempty(event.environment) && nonempty(event.environmentVersion), `${name}: 환경/버전 필요`);
      check(Array.isArray(event.command) && event.command.length > 0 && event.command.every(nonempty), `${name}: 실제 명령 배열 필요`);
      check(event.exit === null ? nonempty(event.exitNote) : Number.isSafeInteger(event.exit), `${name}: exit 또는 미수집 사유 필요`);
      for (const key of ["expected", "actual", "input", "classification", "recovery", "residualRisk"]) check(nonempty(event[key]), `${name}: ${key} 필요`);
      check(["EXACT", "SCOPED", "HISTORICAL"].includes(event.evidenceScope), `${name}: evidenceScope 오류`);
      check(typeof event.synthetic === "boolean", `${name}: synthetic 여부 필요`);
      check(digest(event.imageDigest) && (event.backupId === null || nonempty(event.backupId)), `${name}: image digest/backup ID 오류`);
      check(event.remoteCi === "N/A" || (failure.historyOnly === true && nonempty(event.remoteCi)), `${name}: 신규 원격 CI authority 금지`);
      if (event.status === "PASS") {
        check(event.exit === 0, `${name}: PASS는 실제 exit 0 필요`);
        if (["GHCR_PUSH", "GHCR_PULL", "DEPLOY", "RESTORE", "ROLLBACK"].includes(event.stage)) check(event.imageDigest !== null, `${name}: 해당 단계 PASS image digest 필요`);
        if (["BACKUP", "RESTORE"].includes(event.stage)) check(event.backupId !== null, `${name}: 해당 단계 PASS backup ID 필요`);
        check(event.verification?.sourceSha === event.sourceSha && event.verification?.environment === event.environment, `${name}: PASS source/환경 결속 불일치`);
        check(event.verification?.imageDigest === event.imageDigest && event.verification?.backupId === event.backupId, `${name}: PASS image/backup 결속 불일치`);
        check(event.evidenceScope !== "EXACT" || /^[a-f0-9]{64}$/.test(event.sourceFingerprint ?? ""), `${name}: EXACT PASS source fingerprint 필요`);
        if (expectedSource) check(event.sourceSha === expectedSource, `${name}: 현재 source와 다른 PASS`);
        if (expectedEnvironment) check(event.environment === expectedEnvironment, `${name}: 현재 환경과 다른 PASS`);
      }
      for (const evidence of list(event.evidence)) {
        if (evidence.kind === "DOCUMENT") file(evidence.reference, "docs/");
        else if (evidence.kind === "PUBLIC_URL") check(/^https:\/\/github\.com\/planner77\/masterGantt\/(?:issues|actions\/runs)\//.test(evidence.reference), `${name}: 공개 근거 URL 오류`);
        else check(evidence.kind === "LOCAL_ONLY" && /^LOCAL:[A-Za-z0-9_.:/-]+$/.test(evidence.reference), `${name}: 근거 종류/로컬 참조 오류`);
      }
      check(list(event.evidence).length > 0, `${name}: 실제 근거 필요`);
    }
  }
  if (previous !== null) {
    check(previous?.schemaVersion === 1 && Array.isArray(previous.failures) && Array.isArray(previous.issues), "이전 인덱스 schema 오류");
    for (const [i, item] of list(previous.issues).entries()) check(stable(index.issues?.[i]) === stable(item), `append-only Issue 이력 변경/삭제/순서 변경: ${item.issue}`);
    for (const [i, old] of list(previous.failures).entries()) {
      const current = index.failures?.[i];
      check(current?.id === old.id, `append-only Failure 삭제/순서 변경: ${old.id}`);
      if (!current) continue;
      const { events: oldEvents, ...oldInfo } = old;
      const { events: newEvents, ...newInfo } = current;
      check(stable(oldInfo) === stable(newInfo), `append-only Failure 원본 변경: ${old.id}`);
      for (const [j, event] of list(oldEvents).entries()) check(stable(newEvents?.[j]) === stable(event), `append-only event 변경/삭제/순서 변경: ${old.id}/${event.id}`);
    }
  }
  return { status: errors.length ? "FAIL" : "PASS", errors: [...new Set(errors)], issueCount: issues.size, failureCount: failures.size, eventCount: eventIds.size, publicationEvidence: false };
}

export function gitLedgerBaseline(root, indexPath, base = "") {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const head = git("rev-parse", "HEAD");
  const read = (ref) => {
    const commit = git("rev-parse", "--verify", `${ref}^{commit}`);
    const found = git("ls-tree", "--name-only", commit, "--", indexPath);
    return { commit, index: found ? JSON.parse(git("show", `${commit}:${indexPath}`)) : null };
  };
  let selected = read(base || head);
  if (!base && selected.index !== null) {
    const working = JSON.parse(readFileSync(resolve(root, indexPath), "utf8"));
    if (stable(working) === stable(selected.index)) selected = read(`${head}^`);
  }
  return { previous: selected.index, baseSha: selected.commit, bootstrap: selected.index === null };
}

export function validateLedgerFilePrefixes(root, index, baseSha) {
  const errors = [];
  let compared = 0;
  for (const issue of Array.isArray(index?.issues) ? index.issues : []) {
    if (!issue || typeof issue.ledger !== "string" || !/^docs\/ISSUE_[1-9][0-9]*_FAILURE_ANALYSIS\.md$/.test(issue.ledger)) continue;
    const found = execFileSync("git", ["ls-tree", "--name-only", baseSha, "--", issue.ledger], { cwd: root, encoding: "utf8" }).trim();
    if (!found) continue;
    const old = execFileSync("git", ["show", `${baseSha}:${issue.ledger}`], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    const current = readFileSync(resolve(root, issue.ledger));
    compared += 1;
    if (current.length < old.length || !current.subarray(0, old.length).equals(old)) errors.push(`append-only Markdown 원본 변경/삭제: ${issue.ledger}`);
  }
  return { status: errors.length ? "FAIL" : "PASS", errors, compared };
}
