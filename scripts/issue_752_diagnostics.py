#!/usr/bin/env python3
"""Issue #752: non-authoritative PR failure triage and bounded manual diagnostics.

Runs only from trusted default-branch workflow_run / workflow_dispatch.
Historic CI events and diagnostic worker outputs are untrusted data.
Never derives PASS from cancellation, missing artifacts or an older head.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import statistics
import sys
import urllib.parse
import urllib.error

import qa_final_automated as qa

SHA = re.compile(r"^[0-9a-f]{40}$")
SPEC = re.compile(r"^tests/e2e/[A-Za-z0-9_./-]+\.spec\.ts$")
RUN_URL = "https://github.com/{repo}/actions/runs/{run}"
MARKER = "issue-752-diagnosis:v1"
AGGREGATES = {
    "Build, static checks, and unit tests",
    "Chromium end-to-end tests",
    "Docker build and runtime smoke test",
}
META = "PR metadata가 기존 전체 CI 증거를 보존하는지 검증"
PREFLIGHT = "QA Preflight — 정책·문서 사전 검사"
FAST_GATE = "PR 빠른 검사 판정"
DERIVED_JOBS = {"QA Final — Automated", "QA Final 신뢰 경계 확인",
                "변경 영향 Shadow 계획 · advisory only (#770)"}
ROOT_CAUSES = ("PRODUCT", "TEST_CONTRACT", "FIXTURE_OBSERVABILITY",
               "INIT_TRANSPORT", "ENVIRONMENT", "POLICY_CI", "UNKNOWN")
MAX_RUNS = 300
MAX_FILES = 24
PARTS = 4


class EvidenceError(Exception):
    def __init__(self, reason, status="BLOCKED"):
        self.reason, self.status = reason, status
        super().__init__(reason)


def ensure(test, reason):
    if not test:
        raise EvidenceError(reason)


def validate_spec(path):
    return (isinstance(path, str) and SPEC.fullmatch(path) is not None
            and "//" not in path and "/../" not in path and "/./" not in path
            and not path.startswith("/") and len(path) < 220)


def normalize_report_spec(value, allowed=None):
    """Canonicalize Playwright testDir-relative paths as data, not executable paths."""
    if not isinstance(value, str) or not value or len(value) > 1000:
        return None
    path = value.replace("\\", "/")
    if path.startswith("./"):
        path = path[2:]
    if "/tests/e2e/" in path:
        path = "tests/e2e/" + path.rsplit("/tests/e2e/", 1)[1]
    elif not path.startswith("tests/e2e/"):
        if path.startswith("/") or (len(path) > 1 and path[1] == ":"):
            return None
        path = "tests/e2e/" + path
    if not validate_spec(path):
        return None
    return path if allowed is None or path in allowed else None


def valid_sha(value):
    return isinstance(value, str) and SHA.fullmatch(value) is not None


def issue_from_pr(pr):
    title, body = str(pr.get("title") or ""), str(pr.get("body") or "")
    match = re.findall(r"(?i)Issue\s*#([1-9]\d*)", title)
    refs = re.findall(r"(?im)^\s*Refs\s+#([1-9]\d*)\s*$", body)
    ensure(len(match) == len(refs) == 1 and match[0] == refs[0],
           "정규 Issue #N과 PR 본문의 단일 Refs #N이 일치하지 않습니다")
    return int(match[0])


def valid_pr(pr, repo):
    ensure(pr.get("state") == "open" and pr.get("number") and
           (pr.get("base") or {}).get("ref") == "main" and
           ((pr.get("base") or {}).get("repo") or {}).get("full_name") == repo and
           ((pr.get("head") or {}).get("repo") or {}).get("full_name") == repo and
           valid_sha((pr.get("head") or {}).get("sha")) and
           valid_sha((pr.get("base") or {}).get("sha")),
           "열린 동일 저장소 PR 및 main 기준 브랜치가 필요합니다")
    issue = issue_from_pr(pr)
    return issue


def authentic_source(gh, run, attempt, *, pr_number=None):
    """Authenticate historical event without comparing past heads with mutable live PR.

    The source artifact was captured before PR checkout. Every attribute is
    independently checked against repository Git objects and workflow metadata.
    """
    run_id = run.get("id")
    ensure(type(run_id) is int and run_id > 0 and
           type(attempt) is int and attempt > 0 and attempt <= 10 and
           run.get("event") == "pull_request" and
           str(run.get("path") or "").split("@")[0] == ".github/workflows/ci.yml" and
           (run.get("repository") or {}).get("full_name") == gh.repo,
           "저장소의 원본 Full PR CI 실행 출처를 인증할 수 없습니다")
    try:
        p = qa.source_artifact(gh, run_id, attempt)
    except qa.Blocked as exc:
        raise EvidenceError("원본 Source Artifact가 누락·만료되었거나 권한이 없습니다", "INCOMPLETE_EVIDENCE") from exc
    ensure(p.get("schema") == "mastergantt-ci-pr-source-v1" and
           p.get("repository") == gh.repo and p.get("run_id") == run_id and
           p.get("run_attempt") == attempt and
           type(p.get("pr_number")) is int and p["pr_number"] > 0 and
           (pr_number is None or p["pr_number"] == pr_number) and
           all(valid_sha(p.get(k)) for k in ("head_sha", "base_sha", "test_merge_sha")) and
           p.get("base_repository") == gh.repo and p.get("base_ref") == "main" and
           p.get("head_repository") == gh.repo and
           p.get("head_ref") == run.get("head_branch") and
           run.get("head_sha") in (p["head_sha"], p["test_merge_sha"]),
           "CI Run과 Source Artifact의 출처가 일치하지 않습니다")
    # Merge commit belongs to this frozen historic head/base, not today's PR.
    commit = gh.get(f"{gh.prefix}/git/commits/{p['test_merge_sha']}")
    parents = [x.get("sha") for x in (commit.get("parents") or [])]
    ensure(parents == [p["base_sha"], p["head_sha"]],
           "과거 test-merge의 두 부모 SHA가 원본 HEAD/Base와 다릅니다")
    return p


def attempt_jobs(gh, run_id, attempt):
    jobs = gh.collection(f"{gh.prefix}/actions/runs/{run_id}/attempts/{attempt}/jobs", "jobs")
    ensure(bool(jobs), "원본 Run/Attempt의 Job이 누락되었습니다")
    by_name = {}
    for job in jobs:
        name = job.get("name")
        ensure(isinstance(name, str) and name and name not in by_name,
               "원본 Attempt에서 중복된 Job 이름이 발견되었습니다")
        by_name[name] = job
    return by_name


def iso_minutes(job):
    try:
        a = dt.datetime.fromisoformat(str(job["started_at"]).replace("Z", "+00:00"))
        b = dt.datetime.fromisoformat(str(job["completed_at"]).replace("Z", "+00:00"))
        diff = (b-a).total_seconds()/60
        return round(diff, 3) if 0 <= diff <= 24*60 else None
    except (KeyError, ValueError, TypeError):
        return None


def attempt_status(jobs):
    meta = jobs.get(META, {}).get("conclusion")
    preflight = jobs.get(PREFLIGHT, {}).get("conclusion")
    gate = jobs.get(FAST_GATE, {}).get("conclusion")
    if meta != "skipped" or (preflight == "skipped" and gate == "skipped"):
        return "METADATA_OR_DRAFT", [], []
    roots, shards = [], []
    for name, job in jobs.items():
        outcome = job.get("conclusion")
        if name.startswith("Chromium E2E shard ") and "· PR" in name:
            shards.append({"name": name, "conclusion": outcome or "UNKNOWN",
                           "minutes": iso_minutes(job), "jobId": job.get("id")})
        if (outcome == "failure" and name not in AGGREGATES
                and name not in (META, FAST_GATE) and name not in DERIVED_JOBS
                and not name.startswith("QA Final")):
            roots.append({"job": name, "jobId": job.get("id"),
                          "class": "UNKNOWN", "source": "direct-job"})
    if roots:
        return "FAILED", roots, shards
    if any(x.get("conclusion") == "cancelled" for x in jobs.values()):
        return "CANCELLED", [], shards
    if any(j.get("conclusion") == "failure" for n,j in jobs.items() if n in AGGREGATES):
        return "UNKNOWN_DERIVED_ONLY", [], shards
    return "NOT_FAILED", [], shards


def collect_history(gh, pr, *, limit=MAX_RUNS):
    """Bounded read; never count metadata-only or aggregate/QA derivative as failures."""
    repo = gh.repo
    branch = (pr.get("head") or {}).get("ref")
    ensure(isinstance(branch, str) and 0 < len(branch) <= 255
           and "\\x00" not in branch, "PR Head 브랜치 형식이 올바르지 않습니다")
    encoded_branch = urllib.parse.quote(branch, safe="")
    prn = pr["number"]
    matched = []
    defects = []
    seen = set()
    incomplete = False
    page_limit = math.ceil(limit/100)
    for page in range(1, page_limit+1):
        # Filter by exact PR head branch BEFORE pagination (GitHub REST API).
        route = (f"{gh.prefix}/actions/workflows/ci.yml/runs"
                 f"?event=pull_request&branch={encoded_branch}&per_page=100&page={page}")
        response = gh.get(route)
        items = response.get("workflow_runs")
        if page == 1 and type(response.get("total_count")) is int:
            incomplete = response["total_count"] > limit
        ensure(isinstance(items, list), "CI Workflow 실행 목록을 조회할 수 없습니다")
        for run in items:
            if run.get("head_branch") != branch or run.get("status") != "completed":
                continue
            for attempt in range(1, min(int(run.get("run_attempt") or 0), 10)+1):
                pair = (run.get("id"), attempt)
                if pair in seen:
                    continue
                seen.add(pair)
                try:
                    source = authentic_source(gh, run, attempt, pr_number=prn)
                    jobs = attempt_jobs(gh, run["id"], attempt)
                    state, roots, shards = attempt_status(jobs)
                    if state == "METADATA_OR_DRAFT":
                        continue
                    matched.append({
                        "runId": run["id"], "attempt": attempt,
                        "headSha": source["head_sha"], "baseSha": source["base_sha"],
                        "testMergeSha": source["test_merge_sha"], "status": state,
                        "runUrl": RUN_URL.format(repo=repo,run=run["id"]),
                        "roots": roots, "shards": shards,
                    })
                except (qa.Blocked, EvidenceError) as exc:
                    defects.append({"runId": run.get("id"), "attempt": attempt,
                                    "status": "INCOMPLETE_EVIDENCE", "reason": "SOURCE_OR_JOB_UNVERIFIED"})
        if len(items) < 100:
            break
    else:
        incomplete = True
    matched.sort(key=lambda r: (r["runId"], r["attempt"]))
    return matched, defects, incomplete


def classify(history, head_sha, current_run_id=None, current_attempt=None):
    failures = [r for r in history if r["status"] == "FAILED"]
    exact = [r for r in history if r["headSha"] == head_sha]
    recent = exact[-1] if exact else None
    # Do not send recommendations for stale completions or past HEADs.
    is_latest = (recent is not None and recent["runId"] == current_run_id and
                 recent["attempt"] == current_attempt)
    recommendation = (len(failures) >= 2 and is_latest and recent["status"] == "FAILED")
    return {
        "status": "DIAGNOSIS_RECOMMENDED" if recommendation else "NOT_RECOMMENDED",
        "failedAttempts": len(failures),
        "failureRunAttempts": [
            {"runId": r["runId"], "attempt": r["attempt"], "headSha": r["headSha"]}
            for r in failures],
        "recommended": recommendation,
    }


def parse_ledger(text):
    # Only recognised, bounded spec paths (a ledger can contain prose/code).
    files = re.findall(r"tests/e2e/[A-Za-z0-9_./-]+\.spec\.ts", text)
    return sorted(set(f for f in files if validate_spec(f)))


def select_files(ledger_files, changed_files, extras=()):
    files = set(ledger_files)
    for path in list(changed_files) + list(extras):
        if path.startswith("tests/e2e/") and path.endswith(".spec.ts"):
            ensure(validate_spec(path), "변경·명시된 E2E spec 경로가 안전하지 않습니다")
            files.add(path)
    ensure(files, "과거 실패·영향 E2E spec 선정 목록이 없습니다")
    ensure(len(files) <= MAX_FILES,
           "진단 24개 파일 상한을 초과했습니다. 전체 합집합을 보존한 분할 계획 승인 필요")
    ordered = sorted(files)
    batches = [[] for _ in range(PARTS)]
    for i, path in enumerate(ordered):
        batches[i % PARTS].append(path)
    return ordered, batches


def ledger_text(gh, issue, base_sha):
    route = f"{gh.prefix}/contents/docs/ISSUE_{issue}_FAILURE_ANALYSIS.md?ref={base_sha}"
    try:
        row = gh.get(route)
        ensure(row.get("encoding") == "base64" and
               int(row.get("size") or 0) <= 300_000, "누적 실패 원장 크기 또는 인코딩이 허용 범위를 벗어났습니다")
        return base64.b64decode(row["content"], validate=False).decode("utf-8")
    except (qa.Blocked, ValueError, UnicodeDecodeError) as exc:
        raise EvidenceError("이슈 누적 실패 원장이 없거나 형식이 올바르지 않습니다", "INCOMPLETE_EVIDENCE") from exc


def changed_files(gh, number):
    files = gh.pages(f"{gh.prefix}/pulls/{number}/files")
    ensure(len(files) <= 300, "변경 파일 수가 커 별도 영향 검토가 필요합니다")
    return [row.get("filename") or "" for row in files]


def stable_key(pr, head, failures):
    normalized = sorted(f"{r['runId']}:{r['attempt']}" for r in failures)
    digest = hashlib.sha256("|".join(normalized).encode()).hexdigest()[:16]
    return f"{pr}:{head}:{digest}"


def ensure_current(pr, source):
    ensure(pr.get("state") == "open" and
           (pr.get("head") or {}).get("sha") == source.get("headSha") and
           (pr.get("base") or {}).get("sha") == source.get("baseSha") and
           (pr.get("merge_commit_sha") or "") == source.get("testMergeSha"),
           "PR Head/Base/test-merge가 오래되었습니다. 진단 준비를 재인증하세요")


def authorized_actor(gh, actor):
    ensure(re.fullmatch(r"[A-Za-z0-9-]{1,39}", actor or "") is not None,
           "수동 진단 실행자 식별자가 올바르지 않습니다")
    row = gh.get(f"{gh.prefix}/collaborators/{actor}/permission")
    ensure(row.get("permission") in ("admin", "maintain", "write"),
           "수동 workflow_dispatch 실행 권한이 없습니다")


def prepare(gh, pr_number, issue, expected_head, actor, ref):
    ensure(ref == "refs/heads/main", "신뢰된 main 브랜치의 수동 실행만 허용합니다")
    authorized_actor(gh, actor)
    pr = gh.get(f"{gh.prefix}/pulls/{pr_number}")
    ensure(valid_pr(pr, gh.repo) == issue, "정규 Primary Issue와 대상 PR이 일치하지 않습니다")
    head = (pr["head"])["sha"]
    base = (pr["base"])["sha"]
    ensure(head == expected_head, "입력한 정확 HEAD가 현재 PR HEAD와 다릅니다")
    history, defects, truncated = collect_history(gh, pr)
    failures = [r for r in history if r["status"] == "FAILED"]
    ensure(len(failures) >= 2, "인증된 독립 Full 실패가 두 번 미만입니다")
    ensure(not defects and not truncated,
           "원본 이력이 만료·권한 거부·조회 상한 초과로 완전한 실패 합집합을 인증할 수 없습니다")
    latest = history[-1]
    ensure(latest["headSha"] == head, "최신 Full Run 출처가 현재 PR HEAD와 다릅니다")
    # Compare live GitHub synthetic test-merge with immutable source.
    ensure_current(pr, {"headSha": head, "baseSha": base, "testMergeSha": latest["testMergeSha"]})
    # The cumulative ledger is normally updated on the still-unmerged PR HEAD.
    # Treat HEAD Markdown only as untrusted path candidates, never as CI authority.
    raw_ledger = ledger_text(gh, issue, head)
    specs = parse_ledger(raw_ledger)
    changed = changed_files(gh, pr_number)
    all_files, batches = select_files(specs, changed)
    ensure(not any(p.startswith(".github/workflows/") for p in changed if p !=
                   ".github/workflows/issue-752-diagnostics.yml"),
           "보호된 Workflow 변경으로 별도 위험·영향 검토가 필요합니다")
    return {
        "schemaVersion": 1, "status": "APPROVED_BOUNDED_DIAGNOSIS",
        "issue": issue, "pr": pr_number, "repo": gh.repo,
        "headSha": head, "baseSha": base, "testMergeSha": latest["testMergeSha"],
        "sourceRunId": latest["runId"], "sourceAttempt": latest["attempt"],
        "history": history, "files": all_files, "parts": batches,
        "historicalFiles": specs, "failedAttempts": len(failures),
        "runKey": stable_key(pr_number, head, failures),
        "historyCompleteWithinLimit": True, "workflowDispatchActor": actor,
        "protection": "ADVISORY_ONLY_NOT_REQUIRED_CI",
        "impactLimitations": "실패 원장과 변경 E2E spec 기반 선정. 간접 소비자는 Owner 별도 검토 필요",
    }


def nearest_percentile(values, q):
    if not values:
        return None
    order = sorted(values)
    return round(order[max(0, math.ceil(len(order)*q)-1)], 3)


def performance(history):
    by_shard = {}
    for r in history:
        for j in r["shards"]:
            if j.get("minutes") is None:
                continue
            group = by_shard.setdefault(j["name"], {"minutes": [], "cancelled": 0, "count": 0})
            group["minutes"].append(j["minutes"])
            group["count"] += 1
            if j["conclusion"] == "cancelled":
                group["cancelled"] += 1
    return {name: {"n": v["count"], "p50Minutes": nearest_percentile(v["minutes"], .5),
                   "p95Minutes": nearest_percentile(v["minutes"], .95),
                   "cancelledRate": round(v["cancelled"]/v["count"], 4)}
            for name,v in sorted(by_shard.items())}


def report_output(report, root):
    root.mkdir(parents=True, exist_ok=True)
    (root/"diagnosis.json").write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n",encoding="utf-8")
    url = f"https://github.com/{report.get('repo','')}/actions/runs/{report.get('diagnosisRunId','')}"
    lines = ["# Issue #752 — PR 반복 실패 진단", "",
             f"- 판정: **{report.get('status','UNKNOWN')}**",
             f"- 관련 이슈 #{report.get('issue','?')} / PR #{report.get('pr','?')}",
             f"- 진단 실행: {url}", f"- 원본 HEAD: {report.get('headSha','UNKNOWN')}",
             f"- 인증된 과거 실제 실패 시도: {report.get('failedAttempts',0)}건",
             f"- PASS/FAIL/CANCELLED/NOT RUN 집계: {report.get('counts',{})}",
             "- 별도 진단은 권고 전용입니다. Full Required 3종·Trusted QA·Owner 승인을 대체하지 않습니다.",
             "- 출처 누락·만료·취소·Worker 미실행을 PASS로 간주하지 않습니다."]
    for item in report.get("failureRunAttempts", [])[:16]:
        lines.append(f"- 과거 실제 실패: Run {item['runId']}.{item['attempt']} · HEAD {item['headSha']}")
    for row in report.get("crossRun", [])[:24]:
        lines.append(f"- {row.get('file')}: {row.get('status')} (원인 {row.get('cause','UNKNOWN')})")
    if report.get("missing"):
        lines.append("- 추가 확인 필요: " + ", ".join(report["missing"][:16]))
    lines += ["", "기준: docs/PR_CI_FAILURE_TRIAGE.md",
              f"실패 원장: docs/ISSUE_{report.get('issue','N')}_FAILURE_ANALYSIS.md",
              "정제 진단 Artifact 보존기간 14일, 원본 PR CI 출처 Artifact 30일."]
    (root/"diagnosis.md").write_text("\n".join(lines)+"\n",encoding="utf-8")
    with open(os.environ.get("GITHUB_STEP_SUMMARY", os.devnull), "a", encoding="utf-8") as out:
        out.write("\n".join(lines)+"\n")

def parse_worker_report(path, allowed):
    """Allowlisted file/status/duration only; ignore raw trace, URL and error payload."""
    if path.stat().st_size > 3_000_000:
        raise EvidenceError("Worker 보고서가 최대 크기를 초과했습니다", "INCOMPLETE_EVIDENCE")
    raw = json.loads(path.read_text(encoding="utf-8"))
    records = []
    def walk(suite, inherited=None):
        file = normalize_report_spec(suite.get("file"), allowed) or inherited
        for spec in suite.get("specs", []):
            if not isinstance(spec, dict):
                continue
            spec_file = normalize_report_spec(spec.get("file"), allowed) or file
            if spec_file not in allowed:
                continue
            for test in spec.get("tests", []):
                if not isinstance(test, dict):
                    continue
                for result in test.get("results", []):
                    if not isinstance(result, dict):
                        continue
                    status = result.get("status")
                    if status not in ("passed","failed","skipped","timedOut","interrupted"):
                        status = "UNKNOWN"
                    duration = result.get("duration")
                    duration = duration if type(duration) in (int,float) and math.isfinite(duration) and 0 <= duration <= 7200000 else None
                    records.append({"file": spec_file, "testId": re.sub(
                        r"[^A-Za-z0-9._:-]", "_", str(test.get("id") or ""))[:90],
                        "status": status, "durationMs": duration})
        for child in suite.get("suites", []):
            if isinstance(child, dict):
                walk(child, file)
    for suite in raw.get("suites", []):
        if isinstance(suite, dict):
            walk(suite)
    return records

def finalize(gh, plan, root, run_id):
    result = {"schemaVersion": 1, "repo": gh.repo,
              "issue": plan.get("issue"), "pr": plan.get("pr"),
              "headSha": plan.get("headSha"), "diagnosisRunId": run_id,
              "diagnosisRunAttempt": int(os.environ.get("GITHUB_RUN_ATTEMPT", "1")),
              "sourceRunId": plan.get("sourceRunId"),
              "sourceAttempt": plan.get("sourceAttempt"),
              "runKey": plan.get("runKey"),
              "status": "DIAGNOSIS_INCOMPLETE", "missing": [],
              "counts": {"PASS":0,"FAIL":0,"CANCELLED":0,"NOT RUN":0},
              "crossRun": []}
    if plan.get("status") != "APPROVED_BOUNDED_DIAGNOSIS":
        result["status"] = "BLOCKED"
        result["missing"].append("PREPARATION_BLOCKED")
        return result
    try:
        pr = gh.get(f"{gh.prefix}/pulls/{plan['pr']}")
        ensure_current(pr, plan)
    except (qa.Blocked, EvidenceError):
        result["status"] = "BLOCKED"
        result["missing"].append("LIVE_PR_CHANGED")
        return result
    files = set(plan["files"])
    observations = []
    for n in range(PARTS):
        part = root/f"part-{n}"
        expected = set(plan["parts"][n])
        if not expected:
            continue
        manifest_file = part/"execution.json"
        if not manifest_file.is_file():
            result["missing"].append(f"PART_{n}_MISSING")
            continue
        try:
            m = json.loads(manifest_file.read_text(encoding="utf-8"))
            if (m.get("headSha") != plan["headSha"] or
                m.get("part") != n or m.get("files") != sorted(expected) or
                m.get("diagnosisRunId") != run_id):
                raise EvidenceError("Worker 실행 출처 정보가 승인된 계획과 일치하지 않습니다")
            if not expected:
                continue
            report = part/"playwright.json"
            if not report.is_file():
                raise EvidenceError("Playwright JSON 보고서가 누락되었습니다")
            observations.extend(parse_worker_report(report, expected))
            if m.get("exitCode") not in (0,1):
                raise EvidenceError("Playwright Runner 준비·실행 또는 제한시간 오류")
        except (ValueError, OSError, EvidenceError, KeyError, TypeError):
            result["missing"].append(f"PART_{n}_INVALID")
    by_file = {}
    for file in files:
        items = [r for r in observations if r["file"] == file]
        if not items:
            result["counts"]["NOT RUN"] += 1
            result["missing"].append(f"SPEC_NOT_OBSERVED:{file}")
            by_file[file] = "UNKNOWN"
            continue
        statuses = {r["status"] for r in items}
        if statuses & {"skipped", "interrupted", "UNKNOWN"}:
            result["missing"].append(f"SPEC_NOT_FULLY_EXECUTED:{file}")
        state = (("RECURRING" if file in set(plan.get("historicalFiles", [])) else "NEW")
                 if {"failed","timedOut"} & statuses else
                 ("RESOLVED_CANDIDATE" if statuses == {"passed"} else "UNKNOWN"))
        by_file[file] = state
        for status in statuses:
            key = {"passed":"PASS", "failed":"FAIL", "timedOut":"FAIL",
                   "interrupted":"CANCELLED","skipped":"NOT RUN"}.get(status, "NOT RUN")
            result["counts"][key] += sum(r["status"]==status for r in items)
    result["crossRun"] = [
        {"file": file, "status": by_file[file], "cause": "UNKNOWN",
         "source": f"docs/ISSUE_{plan['issue']}_FAILURE_ANALYSIS.md"}
        for file in sorted(files)]
    result["p50P95ByShardMinutes"] = performance(plan["history"])
    result["failureRunAttempts"] = [
        {"runId": x["runId"],"attempt":x["attempt"],"headSha":x["headSha"]}
        for x in plan["history"] if x["status"] == "FAILED"]
    result["failedAttempts"] = len(result["failureRunAttempts"])
    result["status"] = ("DIAGNOSIS_READY" if not result["missing"] and
                        len(observations)>0 else "DIAGNOSIS_INCOMPLETE")
    result["notAnApproval"] = True
    return result


def notify(gh, report):
    """Only trusted notifier job receives issues:write; deterministic exact-head upsert."""
    if report.get("status") not in ("DIAGNOSIS_RECOMMENDED",
                                    "DIAGNOSIS_READY", "DIAGNOSIS_INCOMPLETE", "BLOCKED"):
        return "NO_ALERT"
    if not report.get("runKey") or not valid_sha(report.get("headSha")):
        return "NO_VERIFIED_KEY"
    # A READY notification must be backed by a successfully uploaded report.
    # The finish job emits sanitized output first, then uploads it. Never claim
    # READY solely because the worker produced a local JSON.
    if report["status"] == "DIAGNOSIS_READY":
        try:
            run_id = report.get("diagnosisRunId")
            ensure(type(run_id) is int and run_id > 0, "진단 Run ID가 없습니다")
            artifacts = gh.collection(f"{gh.prefix}/actions/runs/{run_id}/artifacts", "artifacts")
            name = f"issue-752-diagnosis-{run_id}-{report.get('diagnosisRunAttempt', 1)}"
            matches = [a for a in artifacts if a.get("name") == name
                       and not a.get("expired") and int(a.get("size_in_bytes") or 0) > 0]
            ensure(len(matches) == 1, "정제된 보고서 Artifact가 인증되지 않았습니다")
        except (qa.Blocked, EvidenceError):
            report["status"] = "DIAGNOSIS_INCOMPLETE"
            report.setdefault("missing", []).append("REPORT_ARTIFACT_NOT_VERIFIED")
    prn = report["pr"]
    live = gh.get(f"{gh.prefix}/pulls/{prn}")
    if live.get("state") != "open" or (live.get("head") or {}).get("sha") != report["headSha"]:
        return "STALE_HEAD_NO_COMMENT"
    issue = issue_from_pr(live)
    if issue != report.get("issue"):
        return "ISSUE_CHANGED_NO_COMMENT"
    tag = f"<!-- {MARKER}:{report['runKey']} -->"
    base = f"https://github.com/{gh.repo}"
    diag_url = f"{base}/actions/workflows/issue-752-diagnostics.yml"
    run_url = f"{base}/actions/runs/{report.get('diagnosisRunId') or report.get('sourceRunId')}"
    ledger = f"{base}/blob/main/docs/ISSUE_{issue}_FAILURE_ANALYSIS.md"
    body = ("\n".join([
        tag, "### Issue #752 — " + report["status"],
        f"Primary Issue #{issue} / PR #{prn} / 정확한 HEAD {report['headSha']}",
        f"원본 증거: [실행·진단]({run_url}) · [이슈별 실패 원장]({ledger})",
        f"인증된 Full CI 실패 Run/Attempt: {report.get('failedAttempts','UNKNOWN')}건",
        f"Actions > [수동 제한 진단]({diag_url})에서 PR·Issue·정확한 HEAD를 입력합니다. 권한 담당자의 명시적 승인이 필요합니다.",
        "보고서: [진단 Job Summary 및 JSON/Markdown Artifact](" + run_url + ") · 보존기간 14일.",
        "이 진단은 권고용입니다. 기존 Required Quality/E2E/Docker, Trusted QA와 Owner 승인을 대체하지 않습니다.",
        "진단 자동 재실행은 없습니다. 누락·만료된 Artifact는 INCOMPLETE이며 PASS가 아닙니다.",
    ]))
    existing = gh.pages(f"{gh.prefix}/issues/{prn}/comments")
    matching = [r for r in existing if tag in str(r.get("body") or "") and
                (r.get("user") or {}).get("type") == "Bot"]
    ensure(len(matching) <= 1, "신뢰된 진단 댓글이 중복되었습니다")
    if matching:
        qa.api("PATCH", f"https://api.github.com{gh.prefix}/issues/comments/{matching[0]['id']}",
               gh.token, {"body":body})
        return "UPDATED"
    qa.api("POST", f"https://api.github.com{gh.prefix}/issues/{prn}/comments",
           gh.token, {"body":body})
    return "CREATED"


def write_outputs(values):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as out:
            for key, val in values.items():
                out.write(f"{key}={str(val).lower() if isinstance(val,bool) else val}\n")


def main():
    arg = argparse.ArgumentParser()
    arg.add_argument("command", choices=("observe","prepare","finalize","notify"))
    arg.add_argument("--report-dir", type=Path, default=Path("issue-752-output"))
    arg.add_argument("--plan", type=Path)
    arg.add_argument("--report", type=Path)
    arg.add_argument("--pr", type=int, default=0)
    arg.add_argument("--issue", type=int, default=0)
    arg.add_argument("--expected-head", default="")
    arg.add_argument("--source-run", type=int, default=0)
    opts = arg.parse_args()
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    ensure(re.fullmatch(r"[\w.-]+/[\w.-]+", repo) is not None, "저장소 식별자가 올바르지 않습니다")
    gh = qa.GitHub(repo, os.environ.get("GH_TOKEN",""))
    diag_id = int(os.environ.get("GITHUB_RUN_ID","0"))
    if opts.command == "observe":
        run = gh.get(f"{gh.prefix}/actions/runs/{opts.source_run}")
        report = {"schemaVersion":1, "repo":repo,"diagnosisRunId":diag_id,
                  "sourceRunId":opts.source_run,"status":"NOT_RECOMMENDED",
                  "missing":[]}
        if run.get("event") != "pull_request" or run.get("status") != "completed":
            report["missing"].append("NON_FULL_OR_INCOMPLETE_TRIGGER")
        else:
            try:
                artifact = authentic_source(gh, run, run["run_attempt"])
                pr = gh.get(f"{gh.prefix}/pulls/{artifact['pr_number']}")
                issue = valid_pr(pr, repo)
                report.update({"issue":issue,"pr":pr["number"],
                               "headSha":artifact["head_sha"],"baseSha":artifact["base_sha"]})
                if pr["head"]["sha"] != artifact["head_sha"]:
                    report["status"] = "STALE_HEAD"
                else:
                    rows, bad, truncated = collect_history(gh, pr)
                    decision = classify(rows, pr["head"]["sha"],
                                        opts.source_run, run["run_attempt"])
                    report.update(decision)
                    report.update({"runKey":stable_key(pr["number"],pr["head"]["sha"],
                                                         [x for x in rows if x["status"] == "FAILED"]),
                                   "p50P95ByShardMinutes":performance(rows),
                                   "missing":[f"SOURCE_INCOMPLETE_{len(bad)}"] if bad else []})
                    if truncated:
                        report["missing"].append("HISTORY_WINDOW_TRUNCATED")
            except (qa.Blocked, EvidenceError):
                report["status"] = "INCOMPLETE_EVIDENCE"
                report["missing"].append("TRIGGER_SOURCE_UNVERIFIED")
        report_output(report,opts.report_dir)
    elif opts.command == "prepare":
        report = {"schemaVersion":1,"status":"BLOCKED","repo":repo,
                  "issue":opts.issue,"pr":opts.pr,"headSha":opts.expected_head,
                  "diagnosisRunId":diag_id}
        try:
            plan = prepare(gh, opts.pr, opts.issue, opts.expected_head,
                           os.environ.get("GITHUB_ACTOR",""),
                           os.environ.get("GITHUB_REF",""))
            report.update(plan)
            write_outputs({"approved":True,"head_sha":plan["headSha"]})
        except (qa.Blocked, EvidenceError) as exc:
            report["reason"] = type(exc).__name__ + ": " + (
                exc.reason if isinstance(exc,EvidenceError) else "SOURCE_OR_API_BLOCKED")
            write_outputs({"approved":False})
        opts.report_dir.mkdir(parents=True, exist_ok=True)
        (opts.report_dir/"plan.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        report_output(report, opts.report_dir)
        if report["status"] == "BLOCKED":
            sys.exit(1)
    elif opts.command == "finalize":
        ensure(opts.plan is not None, "승인된 진단 계획이 필요합니다")
        try:
            plan = json.loads(opts.plan.read_text(encoding="utf-8"))
            report = finalize(gh,plan,opts.report_dir,diag_id)
        except (qa.Blocked,EvidenceError,ValueError,OSError) as exc:
            report = {"status":"BLOCKED","repo":repo,"diagnosisRunId":diag_id,
                      "missing":["FINALIZATION_UNVERIFIED"],"reason":type(exc).__name__}
        report_output(report, opts.report_dir)
        if report["status"] != "DIAGNOSIS_READY":
            sys.exit(1)
    else:
        ensure(opts.report is not None, "진단 보고서가 필요합니다")
        report = json.loads(opts.report.read_text(encoding="utf-8"))
        try:
            status = notify(gh,report)
            with open(os.environ.get("GITHUB_STEP_SUMMARY", os.devnull),"a",encoding="utf-8") as f:
                f.write(f"\nIssue #752 PR 알림 처리: {status}\n")
        except (qa.Blocked,EvidenceError) as exc:
            with open(os.environ.get("GITHUB_STEP_SUMMARY", os.devnull),"a",encoding="utf-8") as f:
                f.write(f"\nIssue #752 PR 알림 오류 (권고 전용): {type(exc).__name__}\n")
            # Never turn independent Required checks red or green on notifier errors.


if __name__ == "__main__":
    main()
