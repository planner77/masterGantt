#!/usr/bin/env python3
"""Fail-closed, read-only QA Final: CI evidence is NOT independent QA/Manager approval."""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GATE_FILES = {".github/workflows/ci.yml", "scripts/qa_final_automated.py",
              "scripts/test_qa_final_automated.py", "scripts/verify-issue-lifecycle.py"}
QA_DOCS = {"AGENTS.md", "docs/QA_REVIEW_POLICY.md", "docs/CI_CD.md",
           "docs/TEST_PLAN.md", "docs/GITHUB_OPERATIONS.md", "docs/REMOTE_VALIDATION.md"}


class Blocked(Exception):
    def __init__(self, status, reason):
        self.status, self.reason = status, reason
        super().__init__(reason)


def require(condition, reason, status="BLOCKED"):
    if not condition:
        raise Blocked(status, reason)


def api(method, url, token, body=None):
    req = urllib.request.Request(
        url, method=method,
        data=None if body is None else json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json",
                 "User-Agent": "mastergantt-qa-final"})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.load(response)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as error:
        raise Blocked("BLOCKED", f"GitHub API 접근 불가 ({getattr(error, 'code', 'network')})") from None


class GitHub:
    def __init__(self, repo, token):
        require(re.fullmatch(r"[\w.-]+/[\w.-]+", repo) is not None and bool(token),
                "repository 식별자 또는 read-only token 없음")
        self.repo, self.token, self.prefix = repo, token, "/repos/" + repo

    def get(self, route):
        require(route.startswith(self.prefix), "다른 repository API 조회 거부")
        return api("GET", "https://api.github.com" + route, self.token)

    def pages(self, route):
        found = []
        for page in range(1, 11):
            part = self.get(f"{route}{'&' if '?' in route else '?'}per_page=100&page={page}")
            require(isinstance(part, list), "API 페이지 형식 불명확")
            found.extend(part)
            if len(part) < 100:
                return found
        raise Blocked("BLOCKED", "페이지 상한 초과, 일부 검증 증거 미확인")

    def open_threads(self, number):
        owner, repo = self.repo.split("/")
        query = """query($owner:String!,$repo:String!,$number:Int!,$cursor:String){
        repository(owner:$owner,name:$repo){pullRequest(number:$number){
        reviewThreads(first:100,after:$cursor){
        nodes{isResolved} pageInfo{hasNextPage endCursor}}}}}"""
        cursor, opened = None, 0
        for _ in range(10):
            data = api("POST", "https://api.github.com/graphql", self.token,
                       {"query": query, "variables": {"owner": owner, "repo": repo,
                         "number": number, "cursor": cursor}})
            require(not data.get("errors"), "GraphQL 리뷰 확인 오류")
            pr = (data.get("data", {}).get("repository") or {}).get("pullRequest")
            require(pr is not None, "리뷰 스레드 조회 권한/자료 없음")
            threads = pr["reviewThreads"]
            opened += sum(not node["isResolved"] for node in threads["nodes"])
            if not threads["pageInfo"]["hasNextPage"]:
                return opened
            cursor = threads["pageInfo"]["endCursor"]
            require(bool(cursor), "리뷰 페이지 cursor 누락")
        raise Blocked("BLOCKED", "리뷰 페이지 초과")

    def head_text(self, path, sha):
        safe_path = "/".join(urllib.parse.quote(p, safe="") for p in path.split("/"))
        result = self.get(f"{self.prefix}/contents/{safe_path}?ref={sha}")
        require(result.get("type") == "file" and result.get("encoding") == "base64",
                f"원격 Work Packet 부재: {path}")
        return base64.b64decode(result["content"]).decode("utf-8")


def primary_issue(title, body):
    t = re.search(r"Issue\s*#(\d+)", title, re.I)
    refs = re.findall(r"(?im)^\s*Refs\s+#(\d+)\s*$", body)
    require(t is not None and len(refs) == 1 and t.group(1) == refs[0],
            "Primary Issue title/Refs 정확히 일치해야 합니다")
    return int(refs[0])


def pr_field(body, name, choices):
    m = re.search(rf"(?im)^\s*(?:[-*]\s*)?{name}\s*[:=]\s*([A-Z_]+)\s*$", body)
    value = m.group(1) if m else ""
    require(value in choices, f"PR 본문 {name}의 명시값 필요")
    return value


def evidence(jobs):
    for name in ("changes", "quality", "e2e", "docker"):
        require(jobs.get(name) == "success", f"required {name} 미성공", "FAIL")
    require(jobs.get("metadata_only") in ("true", "false"), "metadata 분기 미확인")
    if jobs["metadata_only"] == "true":
        require(jobs.get("metadata") == "success", "동일 SHA의 과거 전체 CI 검증 실패", "FAIL")
    else:
        require(jobs.get("metadata") == "skipped", "전체 CI의 metadata 분기 이상", "FAIL")
    for name in ("e2e_required", "docker_required"):
        require(jobs.get(name) in ("true", "false"), "구현 Job skip 구분 없음")
    return {
        "quality_evidence": "AGGREGATE_PASS",
        "e2e_evidence": "PREVIOUS_FULL_CI" if jobs["metadata_only"] == "true" else (
            "EXECUTED" if jobs["e2e_required"] == "true" else "SKIPPED_NOT_TESTED"),
        "docker_evidence": "PREVIOUS_FULL_CI" if jobs["metadata_only"] == "true" else (
            "EXECUTED" if jobs["docker_required"] == "true" else "SKIPPED_NOT_TESTED")}


def snapshot(event, live, run, env):
    p = event.get("pull_request") or {}
    h = (p.get("head") or {}).get("sha")
    b = (p.get("base") or {}).get("sha")
    require(live.get("state") == "open", "PR 상태가 open이 아님")
    require(h == env.get("EVENT_HEAD_SHA") == live.get("head", {}).get("sha"),
            "PR latest Head stale")
    require(b == env.get("EVENT_BASE_SHA") == live.get("base", {}).get("sha"),
            "기준 main/base 변경, test-merge stale")
    require(live.get("mergeable") is True and
            live.get("merge_commit_sha") == env.get("TEST_MERGE_SHA"),
            "mergeability 또는 test merge 불일치")
    require(run.get("id") == int(env["GITHUB_RUN_ID"]) and
            run.get("run_attempt") == int(env["GITHUB_RUN_ATTEMPT"]) and
            run.get("event") == "pull_request" and
            run.get("head_sha") in (h, env.get("TEST_MERGE_SHA")) and
            run.get("status") in ("in_progress", "completed"),
            "실행 ID/attempt/검증 대상 SHA 불일치")


def docs_required(paths):
    if paths & GATE_FILES or any(p.startswith(".github/workflows/") for p in paths):
        return QA_DOCS
    if any(p.startswith(".codex/agents/") for p in paths):
        return {"AGENTS.md", "docs/AGENT_CONFIGURATION.md", "docs/QA_REVIEW_POLICY.md"}
    if any(p.startswith(("src/", "app/", "migrations/")) for p in paths):
        return {"DESIGN.md", "docs/TEST_PLAN.md"}
    if any(p.startswith(("tests/", "scripts/test")) for p in paths):
        return {"docs/TEST_PLAN.md"}
    return set()


def section(body, title):
    m = re.search(rf"(?m)^##\s+{title}\s*$", body)
    require(m is not None, f"Work Packet ## {title} 누락")
    return re.split(r"(?m)^##\s+", body[m.end():], 1)[0]


def docs_gate(plan, paths, ac):
    entries = dict(re.findall(
        r"(?im)^\s*-\s+\x60([^\x60]+)\x60:\s*(UPDATED|N/A\([^)\r\n]+\))\s*$",
        section(plan, "DOCUMENTATION_SYNC")))
    require(bool(entries), "DOC_SYNC 기록 누락")
    for path in docs_required(paths):
        require(path in entries, f"문서 영향 기록 없음: {path}")
        require((path in paths) if entries[path] == "UPDATED" else
                len(entries[path]) >= 17, f"문서 변경 또는 N/A(reason) 미입증: {path}")
    mapping = set(re.findall(r"(?im)^\s*-\s*(AC\d+)\s*:\s*\S.{8,}$",
                             section(plan, "AC_TEST_COVERAGE")))
    require(ac <= mapping, "Issue AC / test evidence mapping 부족: " + ",".join(sorted(ac-mapping)))
    return {"documentation_sync": "STRUCTURAL_PASS_SEMANTIC_REVIEW_PENDING",
            "ac_test_coverage": "MAPPING_PASS_SEMANTIC_REVIEW_PENDING"}


def blocking_reviews(reviews):
    latest = {}
    for r in sorted(reviews, key=lambda x: (x.get("submitted_at") or "", x.get("id", 0))):
        user = (r.get("user") or {}).get("login")
        if user and r.get("state") in ("CHANGES_REQUESTED", "APPROVED", "DISMISSED"):
            latest[user] = r["state"]
    return "CHANGES_REQUESTED" in latest.values()


def check(env, event, gh):
    require(env.get("GITHUB_EVENT_NAME") == "pull_request", "PR 전용 Gate")
    n = int(env["PR_NUMBER"])
    pr = gh.get(f"{gh.prefix}/pulls/{n}")
    run = gh.get(f"{gh.prefix}/actions/runs/{env['GITHUB_RUN_ID']}")
    snapshot(event, pr, run, env)
    job_evidence = evidence({
        "changes": env.get("NEED_CHANGES"), "quality": env.get("NEED_QUALITY"),
        "e2e": env.get("NEED_E2E"), "docker": env.get("NEED_DOCKER"),
        "metadata": env.get("NEED_METADATA"), "metadata_only": env.get("METADATA_ONLY"),
        "e2e_required": env.get("E2E_REQUIRED"), "docker_required": env.get("DOCKER_REQUIRED")})
    issue = primary_issue(pr.get("title") or "", pr.get("body") or "")
    risk = pr_field(pr.get("body") or "", "risk_level", {"LOW", "MEDIUM", "HIGH"})
    method = pr_field(pr.get("body") or "", "qa_method", {"AGENT", "AUTOMATED_MANAGER"})
    paths = {f["filename"] for f in gh.pages(f"{gh.prefix}/pulls/{n}/files")}
    require(bool(paths), "PR diff 없음")
    require(not paths & GATE_FILES, "QA Gate 자체 변경: 독립 검토/관리자 승인 필요")
    high = any(re.search(r"auth|security|migration|calendar|schedul|dependency|release|ghcr",
                         p, re.I) or p.startswith(".github/workflows/") for p in paths)
    require(not high or risk == "HIGH", "HIGH 위험 범위를 임의로 LOW/MEDIUM 처리 불가")
    require(not blocking_reviews(gh.pages(f"{gh.prefix}/pulls/{n}/reviews")),
            "REQUEST_CHANGES 해결되지 않음")
    require(gh.open_threads(n) == 0, "미해결 review thread")
    issue_body = gh.get(f"{gh.prefix}/issues/{issue}").get("body") or ""
    ac = set(re.findall(r"\bAC\d+\b", issue_body))
    require(bool(ac), "Issue 인수 기준이 없음")
    plan = gh.head_text(f"docs/exec-plans/active/ISSUE_{issue}.md", env["EVENT_HEAD_SHA"])
    result = docs_gate(plan, paths, ac)
    return {"issue": issue, "pr": n, "rule_version": "580-v1",
            "qa_method": method, "risk_level": risk,
            "pr_head_sha": env["EVENT_HEAD_SHA"], "base_sha": env["EVENT_BASE_SHA"],
            "base_or_test_merge_sha": env["TEST_MERGE_SHA"],
            "workflow_run_id": int(env["GITHUB_RUN_ID"]),
            "run_attempt": int(env["GITHUB_RUN_ATTEMPT"]),
            "automated_qa": "PASS", "independent_qa": "NOT TESTED" if method == "AGENT"
                            else "N/A(독립 검토를 실행하지 않는 공식 대체 경로)",
            "manager_decision": "NOT TESTED",
            "unresolved_review": 0,
            "residual_risks": "실제 의미/UX/HIGH 수동 검토 및 Manager ACCEPT 대기",
            **job_evidence, **result}


def main():
    env = dict(os.environ)
    report = {"automated_qa": "NOT TESTED", "independent_qa": "NOT TESTED",
              "manager_decision": "NOT TESTED", "rule_version": "580-v1",
              "pr_head_sha": env.get("EVENT_HEAD_SHA"),
              "base_or_test_merge_sha": env.get("TEST_MERGE_SHA"),
              "workflow_run_id": env.get("GITHUB_RUN_ID"),
              "run_attempt": env.get("GITHUB_RUN_ATTEMPT")}
    code = 1
    try:
        event = json.loads(Path(env["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
        report.update(check(env, event, GitHub(env["GITHUB_REPOSITORY"], env.get("GH_TOKEN", ""))))
        code = 0
    except Blocked as error:
        report.update(automated_qa=error.status, decision_reason=error.reason)
    except (KeyError, OSError, ValueError, TypeError, UnicodeError) as error:
        report.update(automated_qa="BLOCKED",
                      decision_reason="검증 증거 파싱 불가: " + type(error).__name__)
    Path("qa-final-automated-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = ("## QA Final — Automated\n"
               f"- 자동 QA: **{report['automated_qa']}**\n"
               f"- SHA: {report.get('pr_head_sha')}\n"
               f"- run: {report.get('workflow_run_id')}.{report.get('run_attempt')}\n"
               f"- independent QA: {report['independent_qa']}\n"
               "- Manager ACCEPT: 수동 증거 필요, 자동 PASS는 MERGE_READY가 아님\n"
               f"- 사유: {report.get('decision_reason', '구조적 증거만 검증')}\n")
    if env.get("GITHUB_STEP_SUMMARY"):
        with Path(env["GITHUB_STEP_SUMMARY"]).open("a", encoding="utf-8") as out:
            out.write(summary)
    print(summary)
    return code


if __name__ == "__main__":
    sys.exit(main())
