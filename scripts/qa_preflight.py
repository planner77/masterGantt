#!/usr/bin/env python3
"""Trusted, read-only, deterministic preflight for a full PR CI run (#629).

This module must be run ONLY from the immutable event base SHA checkout.
The mutable PR head supplies *data* (metadata and Work Packet), never code.
Final QA independently re-evaluates all checks and deferred live evidence.
"""
import json
import os
import re
import sys
import time
from pathlib import Path

import qa_final_automated as qa


def _check(checks, name, callback, *, where):
    """Record independently correctable metadata errors without hiding siblings."""
    try:
        value = callback()
    except qa.Blocked as error:
        checks.append({"name": name, "status": "FAIL",
                       "where": where, "reason": error.reason})
        return None
    checks.append({"name": name, "status": "PASS", "where": where})
    return value


def _unique_field(body, name, allowed, optional=False):
    # Full-line matches only: embedded Markdown prose is not a declaration.
    pattern = rf"(?im)^\s*(?:[-*]\s*)?{re.escape(name)}\s*[:=]\s*([A-Za-z_]+)\s*$"
    values = re.findall(pattern, body)
    if optional and not values:
        return None
    qa.require(len(values) == 1, f"{name}: 정확히 한 개의 선언 필요")
    qa.require(values[0] in allowed,
               f"{name}: 지원값 {', '.join(sorted(allowed))} 중 하나 필요")
    if name in ("qa_method", "risk_level"):
        # The authoritative final QA uses the exact same parser/enum.
        return qa.pr_field(body, name, allowed)
    return values[0]


def check(event, env, gh):
    """Return diagnostics; any deterministic FAIL blocks heavy CI.

    API, event or data-provenance uncertainty raises qa.Blocked and blocks
    the CI without claiming deterministic failure or readiness.
    """
    qa.require(env.get("GITHUB_EVENT_NAME") == "pull_request" and
               event.get("action") in ("opened", "reopened", "synchronize"),
               "full PR 이벤트만 preflight 대상으로 허용")
    n = int(env["PR_NUMBER"])
    observed = event.get("pull_request") or {}
    head = (observed.get("head") or {}).get("sha")
    base = (observed.get("base") or {}).get("sha")
    qa.require(event.get("number") == n and observed.get("number") == n and
               re.fullmatch(r"[a-f0-9]{40}", str(head)) is not None and
               re.fullmatch(r"[a-f0-9]{40}", str(base)) is not None and
               head == env.get("EVENT_HEAD_SHA") and
               base == env.get("EVENT_BASE_SHA"),
               "원본 이벤트의 PR/Head/base 출처 불일치")
    live = gh.get(f"{gh.prefix}/pulls/{n}")
    qa.require(live.get("number") == n and live.get("state") == "open" and
               (live.get("head") or {}).get("sha") == head and
               (live.get("base") or {}).get("sha") == base and
               (live.get("base") or {}).get("ref") == "main" and
               ((live.get("base") or {}).get("repo") or {}).get("full_name") == gh.repo,
               "PR 최신 Head/base 변경·대상 저장소 불일치 (새 full CI 필요)")
    checks = []
    body = live.get("body") or ""
    title = live.get("title") or ""

    def issue_number():
        qa.require(len(re.findall(r"(?i)Issue\s*#\d+", title)) == 1,
                   "PR 제목에 Primary Issue를 정확히 한 번 표시")
        return qa.primary_issue(title, body)

    issue = _check(checks, "PRIMARY_ISSUE", issue_number,
                   where="PR title 및 PR 본문 단일 Refs #N")
    risk = _check(checks, "RISK_LEVEL",
                  lambda: _unique_field(body, "risk_level",
                                        {"LOW", "MEDIUM", "HIGH"}),
                  where="PR body: risk_level")
    method = _check(checks, "QA_METHOD",
                    lambda: _unique_field(body, "qa_method",
                                          {"AGENT", "OWNER_MANAGED", "AUTOMATED_MANAGER"}),
                    where="PR body: qa_method")
    required = _check(checks, "QA_REQUIRED",
                      lambda: _unique_field(body, "qa_required", {"true", "false"}),
                      where="PR body: qa_required")
    release_needed = _check(checks, "RELEASE_REQUIRED",
                            lambda: _unique_field(body, "release_required",
                                                  {"true", "false"}, optional=True),
                            where="PR body: release_required (선택)")
    release_authorized = _check(checks, "RELEASE_AUTHORIZED",
                                lambda: _unique_field(body, "release_authorized",
                                                      {"true", "false"}, optional=True),
                                where="PR body: release_authorized (선택)")

    # Read only GitHub metadata; both sides of a rename use main's QA helper.
    paths, protected = qa.protected_paths(gh.pages(f"{gh.prefix}/pulls/{n}/files"))
    qa.require(bool(paths), "PR 변경 diff가 없음")
    def policy():
        qa.require(risk is not None and method is not None and required is not None,
                   "위험도/QA 선언 오류를 먼저 수정")
        floor = qa.risk_floor(paths)
        rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
        qa.require(rank[risk] >= rank[floor],
                   f"변경 경로 기반 최소 위험도 {floor}; 현재 {risk}")
        qa.require(not (risk == "HIGH" and required != "true"),
                   "HIGH 및 protected PR의 qa_required=true 필요")
        qa.require(not (method == "AGENT" and required != "true"),
                   "AGENT 경로 선택 시 qa_required=true 필요")
        qa.require(not (release_needed == "false" and release_authorized == "true"),
                   "release_required=false에서 release_authorized=true 선언 모순")
        return floor

    floor = _check(checks, "PATH_POLICY", policy,
                   where="PR diff (rename 원본 포함), risk_level/qa_required/release 플래그")
    if issue is not None:
        issue_body = gh.get(f"{gh.prefix}/issues/{issue}").get("body") or ""
        ac = set(re.findall(r"\bAC\d+\b", issue_body))
        _check(checks, "ISSUE_AC", lambda: qa.require(bool(ac),
               "Primary Issue 본문에 AC1.. 식별자 없음"),
               where=f"Issue #{issue} Acceptance Criteria")
        # Read the Work Packet from the PR head as DATA through the API,
        # not via checkout/import/shell. The base QA helper enforces doc impact.
        plan = gh.head_text(f"docs/exec-plans/active/ISSUE_{issue}.md", head)
        if ac:
            _check(checks, "DOCUMENTATION_SYNC",
                   lambda: qa.docs_gate(plan, paths, ac),
                   where=f"docs/exec-plans/active/ISSUE_{issue}.md: "
                         "DOCUMENTATION_SYNC / AC_TEST_COVERAGE")

    # mergeability is computed asynchronously. Null/pending is not a FAIL,
    # while a concrete conflict is an early hint rechecked by final QA.
    mergeable = live.get("mergeable")
    if mergeable is False:
        checks.append({"name": "MERGE_CONFLICT", "status": "FAIL",
                       "where": "GitHub PR mergeability",
                       "reason": "현재 명백한 병합 충돌; 최신 main 정렬 필요"})
    elif mergeable is None:
        checks.append({"name": "MERGE_CONFLICT", "status": "DEFERRED",
                       "where": "GitHub PR mergeability",
                       "reason": "비동기 계산 중; 마지막 QA에서 재확인"})
    else:
        checks.append({"name": "MERGE_CONFLICT", "status": "DEFERRED",
                       "where": "GitHub PR mergeability",
                       "reason": "사전 시점의 계산은 최종 test-merge 증거가 아님"})

    for name, why in (
        ("LATEST_FULL_CI", "세 required aggregate/run/attempt는 아직 완료되지 않음"),
        ("REVIEW_OWNER", "최종 review thread·Trusted QA·Owner ACCEPT는 사후 검증"),
        ("BASE_TEST_MERGE", "최신 main, 정확한 test merge는 마지막 QA에서 재확인"),
        ("DOCUMENT_MEANING", "문서 영향 의미 적합성은 Owner 수동 검토"),
    ):
        checks.append({"name": name, "status": "DEFERRED",
                       "where": "Final QA/Owner gate", "reason": why})
    failures = [v for v in checks if v["status"] == "FAIL"]
    return {"status": "FAIL" if failures else "PASS",
            "issue": issue, "pr": n, "head_sha": head, "base_sha": base,
            "protected_paths": sorted(protected), "risk_floor": floor,
            "qa_method": method, "rule_version": "629-preflight-v1",
            "checks": checks, "deterministic_failures": len(failures),
            "decision": "Preflight is not QA_FINAL PASS or MERGE_READY"}


def main():
    env = dict(os.environ)
    started = time.monotonic()
    report = {"status": "BLOCKED", "rule_version": "629-preflight-v1",
              "run_id": env.get("GITHUB_RUN_ID"),
              "run_attempt": env.get("GITHUB_RUN_ATTEMPT"),
              "pr": env.get("PR_NUMBER"),
              "head_sha": env.get("EVENT_HEAD_SHA"),
              "base_sha": env.get("EVENT_BASE_SHA"),
              "checks": [], "decision": "MERGE_READY=BLOCKED"}
    try:
        event = json.loads(Path(env["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
        gh = qa.GitHub(env["GITHUB_REPOSITORY"], env.get("GH_TOKEN", ""))
        report.update(check(event, env, gh))
    except qa.Blocked as error:
        report["block_reason"] = error.reason
    except (KeyError, OSError, ValueError, TypeError, UnicodeError) as error:
        report["block_reason"] = "이벤트·증거 처리 불가: " + type(error).__name__
    report["duration_seconds"] = round(time.monotonic() - started, 3)
    report["pending_checks"] = sum(c["status"] == "DEFERRED"
                                   for c in report["checks"])
    report["deterministic_failures"] = sum(c["status"] == "FAIL"
                                           for c in report["checks"])
    Path("qa-preflight-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = ["## QA Preflight (#629)",
               f"- 결론: **{report['status']}** (최종 QA/Owner 승인 아님)",
               f"- PR: #{report['pr']}; Head: \`{report['head_sha']}\`; Base: \`{report['base_sha']}\`",
               f"- Run/attempt: \`{report['run_id']}.{report['run_attempt']}\`",
               f"- 경과: {report['duration_seconds']}s; FAIL: {report['deterministic_failures']}; DEFERRED: {report['pending_checks']}"]
    for item in report["checks"]:
        summary.append(f"- {item['status']} / {item['name']}: {item['where']}" +
                       (f" — {item['reason']}" if item.get("reason") else ""))
    if report.get("block_reason"):
        summary.append(f"- BLOCKED: {report['block_reason']}")
    summary.extend(["- E2E/Docker 회피 횟수·Runner-minutes는 Job 원장 확인 후에만 확정",
                    "- PR data는 검증기 코드/승인으로 사용하지 않음; QA_FINAL 및 Owner ACCEPT 별도"])
    message = "\n".join(summary) + "\n"
    if env.get("GITHUB_STEP_SUMMARY"):
        with Path(env["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as stream:
            stream.write(message)
    print(message)
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
