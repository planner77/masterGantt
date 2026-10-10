#!/usr/bin/env python3
"""Fail-closed, read-only QA Final: CI evidence is NOT independent QA/Manager approval."""
import base64
from fnmatch import fnmatchcase
import json
import os
import re
import sys
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GATE_FILES = {
    ".github/workflows/ci.yml", ".github/workflows/qa-final-trusted.yml",
    "scripts/qa_final_automated.py", "scripts/test_qa_final_automated.py",
    "scripts/verify-issue-lifecycle.py", "scripts/verify-pr-metadata-evidence.py",
    "scripts/verify-ci-run-trace.py",
}
# Conservative execution-control surface. Ordinary application files remain Manager-reviewed.
CI_EXECUTION_PREFIXES = (
    ".github/", ".codex/", "scripts/", "deploy/", "tests/config/", "config/",
)
CI_EXECUTION_EXACT = {
    "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    ".npmrc", ".dockerignore", "Dockerfile", "tsconfig.json",
    "playwright.config.ts", "playwright.config.js",
    "vitest.config.ts", "vitest.config.mts", "eslint.config.mjs",
    "next.config.ts", "next.config.js", "next.config.mjs",
}
# Root build/test tool configurations are executable CI inputs, including files
# introduced after this policy version. Conservative by design.
CI_EXECUTION_GLOBS = (
    "tsconfig*.json", "postcss.config.*", "*.config.*",
    "*lock*.json", "*.lock", ".npmrc*", ".yarnrc*",
)
POLICY_FILES = {
    "AGENTS.md", "docs/QA_REVIEW_POLICY.md", "docs/SECURITY.md",
    "docs/ISSUE_LIFECYCLE.md", "docs/AGENT_PROMPTS.md",
    "docs/AGENT_CONFIGURATION.md",
    "docs/GITHUB_OPERATIONS.md", "docs/REMOTE_VALIDATION.md",
    "docs/ISSUE_LIFECYCLE_AUTOMATION.md", "docs/CI_CD.md",
}
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

    def collection(self, route, name):
        """GitHub workflow runs/jobs APIs return paginated objects, unlike PR files."""
        found = []
        for page in range(1, 11):
            param = "&" if "?" in route else "?"
            response = self.get(f"{route}{param}per_page=100&page={page}")
            items = response.get(name) if isinstance(response, dict) else None
            require(isinstance(items, list), f"GitHub {name} API 응답 오류")
            found.extend(items)
            if len(items) < 100:
                return found
        raise Blocked("BLOCKED", f"{name} 페이지 제한 초과")

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
    """All affected contracts form a UNION; no early return for mixed-scope PRs.

    Structural verification only; a Manager separately confirms that each
    contract is semantically up to date or the documented N/A is defensible.
    """
    required = set()
    for path in paths:
        p = path.lower()
        if (path in GATE_FILES or path in POLICY_FILES or
                p.startswith((".github/", "scripts/"))):
            required.update(QA_DOCS)
        if p.startswith(".codex/agents/"):
            required.update({"AGENTS.md", "docs/AGENT_CONFIGURATION.md",
                             "docs/QA_REVIEW_POLICY.md"})
        if p.startswith(("src/", "app/", "db/", "migrations/")):
            required.update({"DESIGN.md", "docs/TEST_PLAN.md"})
        elif p.startswith("tests/"):
            required.add("docs/TEST_PLAN.md")
        if p.startswith(("db/", "migrations/")) or re.search(
                r"(?:^|/)(?:db|database|migrations?|schema)(?:/|[_.-])", p):
            required.add("docs/DB_SCHEMA.md")
        if p.startswith(("src/app/api/", "app/api/", "src/pages/api/", "pages/api/",
                         "src/contracts/", "src/server/services/")):
            required.add("docs/API.md")
        if p.startswith(("src/server/repositories/", "src/server/db/")):
            required.add("docs/DB_SCHEMA.md")
        if re.search(r"calendar|schedul|dependency|duration|milestone", p):
            required.add("docs/SCHEDULING_ENGINE.md")
        if "import" in p or "export" in p:
            required.update({"docs/IMPORT_EXPORT.md", "docs/IMPORT_SCHEMA.md"})
            if "excel" in p:
                required.add("docs/EXCEL_EXPORT.md")
    return required


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


def verify_same_base_full_run(gh, number, head, base, current_run_id):
    """Metadata-only runs may reuse only the latest completed full run of THIS head+base.

    PR title/body edits do not modify the merge tree; changing the base does.
    Unknown source-base metadata is treated as BLOCKED (never as a pass).
    """
    route = f"{gh.prefix}/actions/workflows/ci.yml/runs?event=pull_request&head_sha={head}"
    runs = sorted(
        gh.collection(route, "workflow_runs"),
        key=lambda run: (int(run.get("run_number") or 0),
                         int(run.get("run_attempt") or 0)), reverse=True)
    eligible = []
    for run in runs:
        if int(run.get("id") or 0) == int(current_run_id):
            continue
        if run.get("event") != "pull_request" or run.get("head_sha") != head:
            continue
        if "[메타데이터 검증]" in str(run.get("display_title") or ""):
            continue
        if "[전체 검증]" not in str(run.get("display_title") or ""):
            continue
        matches = [p for p in (run.get("pull_requests") or [])
                   if int(p.get("number") or 0) == number]
        require(len(matches) == 1, "원본 전체 CI run의 PR ref 확인 불가")
        prior = matches[0]
        require((prior.get("head") or {}).get("sha") == head and
                (prior.get("base") or {}).get("sha") == base,
                "이전 전체 CI의 base/head와 현재 test merge 입력이 다릅니다")
        eligible.append(run)
        break
    require(bool(eligible), "동일 head/base의 전체 PR CI run 없음")
    chosen = eligible[0]
    require(chosen.get("status") == "completed" and
            chosen.get("conclusion") == "success", "이전 전체 CI 미성공", "FAIL")
    jobs = {j["name"]: j.get("conclusion")
            for j in gh.collection(f"{gh.prefix}/actions/runs/{chosen['id']}/jobs", "jobs")}
    required = {
        "Build, static checks, and unit tests",
        "Chromium end-to-end tests",
        "Docker build and runtime smoke test",
    }
    require(all(jobs.get(name) == "success" for name in required) and
            jobs.get("PR metadata가 기존 전체 CI 증거를 보존하는지 검증") == "skipped",
            "동일 base의 full-run quality/e2e/docker 증거 불충분", "FAIL")
    return int(chosen["id"])


def protected_paths(files):
    """Validate both sides of a rename; changed policy/workflow is never self-approved."""
    all_paths = set()
    for entry in files:
        require(bool(entry.get("filename")), "변경 파일 API에 filename 누락")
        all_paths.add(entry["filename"])
        if entry.get("status") == "renamed":
            require(bool(entry.get("previous_filename")), "rename source path 조회 불가")
            all_paths.add(entry["previous_filename"])
    protected = {p for p in all_paths
                 if p in GATE_FILES or p in POLICY_FILES or
                 p in CI_EXECUTION_EXACT or
                 p.startswith(CI_EXECUTION_PREFIXES) or
                 ("/" not in p and any(fnmatchcase(p, pattern)
                                      for pattern in CI_EXECUTION_GLOBS))}
    return all_paths, protected


def risk_floor(paths):
    """Fail closed for known HIGH/medium-impact paths; never infer semantic PASS."""
    for path in paths:
        p = path.lower()
        if (p in GATE_FILES or p in POLICY_FILES or
                p in CI_EXECUTION_EXACT or p.startswith(CI_EXECUTION_PREFIXES) or
                ("/" not in p and any(fnmatchcase(p, g)
                                       for g in CI_EXECUTION_GLOBS)) or
                re.search(r"auth|security|session|permission|migration|calendar|"
                          r"schedul|dependency|release|ghcr|import|export|duration|"
                          r"milestone|safety|secret|credential|token", p) or
                p.startswith(("db/", "migrations/", "src/contracts/",
                              "src/server/repositories/", "src/server/db/",
                              "src/server/auth/", "src/server/services/",
                              "src/app/api/"))):
            return "HIGH"
    if any(p.startswith(("src/", "app/", "db/", "tests/e2e/")) for p in paths):
        return "MEDIUM"
    return "LOW"


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
    paths, protected = protected_paths(gh.pages(f"{gh.prefix}/pulls/{n}/files"))
    require(bool(paths), "PR diff 없음")
    require(not protected, "QA 검증기/Workflow/보안 정책의 변경·rename 감지: "
            + ", ".join(sorted(protected)) + " — 독립 검토 및 Manager 승인 필요")
    minimum_risk = risk_floor(paths)
    rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
    require(rank[risk] >= rank[minimum_risk],
            f"위험도 하향 금지: 제출 {risk}, 파일 기반 최소 {minimum_risk}")
    prior_full_run = None
    if env.get("METADATA_ONLY") == "true":
        prior_full_run = verify_same_base_full_run(
            gh, n, env["EVENT_HEAD_SHA"], env["EVENT_BASE_SHA"],
            int(env["GITHUB_RUN_ID"]))
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
            "automated_qa": "PASS",
            "decision_reason": "동일 PR Head/base에 대한 필수 CI, AC/documentation 구조·리뷰 증거 확인; 의미 검토와 Manager 승인 별도",
            "prior_full_run_id": prior_full_run,
            "independent_qa": "NOT TESTED" if method == "AGENT"
                            else "N/A(독립 검토를 실행하지 않는 공식 대체 경로)",
            "manager_decision": "NOT TESTED",
            "unresolved_review": 0,
            "residual_risks": "실제 의미/UX/HIGH 수동 검토 및 Manager ACCEPT 대기",
            **job_evidence, **result}




def validate_validator_sha(expected, actual):
    """Pin source of truth: workflow_run event's immutable default-branch commit."""
    require(re.fullmatch(r"[0-9a-f]{40}", str(expected or "")) is not None,
            "trusted workflow validator expected SHA 없음")
    require(actual == expected, "trusted workflow_checkout의 실제 SHA가 이벤트 SHA와 다릅니다")
    return expected


def manual_merge_readiness(*, risk, method, protected, doc_sync, ci_pass,
                           reviewed, independent, trusted_qa, manager,
                           high_checklist, risk_accepted):
    """Pure manual merge checklist. An automated QA check never grants merge approval."""
    require(risk in {"LOW", "MEDIUM", "HIGH"}, "위험도 미확정")
    require(method in {"AGENT", "AUTOMATED_MANAGER"}, "QA 경로 미확정")
    require(doc_sync and ci_pass and reviewed, "최신 CI/DOC_SYNC/리뷰 미해결")
    if protected or method == "AGENT":
        require(independent == "PASS", "보호 정책/AGENT의 실제 독립 QA PASS 필요")
    else:
        require(trusted_qa == "PASS", "default-branch Trusted QA PASS 필요")
    if risk == "HIGH":
        require(high_checklist and risk_accepted, "HIGH 체크리스트·잔여 위험 명시 수용 필요")
    require(manager == "ACCEPT", "HEAD별 Manager ACCEPT 누락")
    return "MERGE_READY"



def trusted_source(env, event, gh):
    """Official verdict comes only from this default-branch workflow_run, not a PR-editable job.

    GitHub workflow_run uses default branch code. This run's check attaches to
    default-branch SHA, NOT automatically to the PR head: until Ruleset integration
    the Manager must inspect its run URL and exact source/PR SHA manually.
    """
    trigger = event.get("workflow_run") or {}
    run_id = int(trigger.get("id") or 0)
    require(run_id > 0, "trusted workflow_run 대상 run id 누락")
    run = gh.get(f"{gh.prefix}/actions/runs/{run_id}")
    require(run.get("id") == run_id and run.get("event") == "pull_request" and
            str(run.get("path") or "").split("@")[0] == ".github/workflows/ci.yml",
            "trusted QA 입력이 CI pull_request run이 아닙니다")
    require(run.get("status") == "completed" and run.get("conclusion") == "success",
            "원본 PR CI run 자체가 성공하지 않았습니다", "FAIL")
    require((run.get("repository") or {}).get("full_name") == gh.repo,
            "CI 검증 원본 repository 불일치")
    prs = run.get("pull_requests") or []
    require(len(prs) == 1, "workflow_run의 단일 PR/source refs 확인 불가")
    source = prs[0]
    number = int(source["number"])
    head = (source.get("head") or {}).get("sha")
    base = (source.get("base") or {}).get("sha")
    require(bool(head) and bool(base) and run.get("head_sha") == head,
            "CI 검증한 Head/base SHA 정보가 불완전합니다")
    live = gh.get(f"{gh.prefix}/pulls/{number}")
    require(live.get("head", {}).get("sha") == head and
            live.get("base", {}).get("sha") == base,
            "CI 완료 이후 PR head/base 변경: 새로운 full CI 필요")
    results = {j["name"]: j.get("conclusion")
               for j in gh.collection(f"{gh.prefix}/actions/runs/{run_id}/jobs", "jobs")}
    metadata_only = "[메타데이터 검증]" in str(run.get("display_title") or "")
    if not metadata_only:
        require("[전체 검증]" in str(run.get("display_title") or ""),
                "전체/메타데이터 CI 실행 유형 식별 불가")
    vals = {
        "changes": results.get("변경 경로 판정"),
        "quality": results.get("Build, static checks, and unit tests"),
        "e2e": results.get("Chromium end-to-end tests"),
        "docker": results.get("Docker build and runtime smoke test"),
        "metadata": results.get("PR metadata가 기존 전체 CI 증거를 보존하는지 검증"),
        "metadata_only": "true" if metadata_only else "false",
        "e2e_required": "true" if any(
            k.startswith("Chromium E2E shard ") and v == "success"
            for k, v in results.items()) else "false",
        "docker_required": "true" if results.get("Docker smoke 구현") == "success" else "false",
    }
    # Never promote a spoofed required-check name outside the approved full CI.
    evidence(vals)
    ctx = dict(env)
    ctx.update({
        "GITHUB_EVENT_NAME": "pull_request",
        "PR_NUMBER": str(number),
        "EVENT_HEAD_SHA": head,
        "EVENT_BASE_SHA": base,
        "TEST_MERGE_SHA": live.get("merge_commit_sha"),
        "GITHUB_RUN_ID": str(run_id),
        "GITHUB_RUN_ATTEMPT": str(run["run_attempt"]),
        "NEED_CHANGES": vals["changes"], "NEED_QUALITY": vals["quality"],
        "NEED_E2E": vals["e2e"], "NEED_DOCKER": vals["docker"],
        "NEED_METADATA": vals["metadata"],
        "METADATA_ONLY": vals["metadata_only"],
        "E2E_REQUIRED": vals["e2e_required"], "DOCKER_REQUIRED": vals["docker_required"],
    })
    synthetic = {"pull_request": {"head": {"sha": head}, "base": {"sha": base}}}
    report = check(ctx, synthetic, gh)
    report["trusted_source"] = "PROTECTED_DEFAULT_BRANCH_WORKFLOW_RUN"
    report["trusted_run_id"] = int(env["GITHUB_RUN_ID"])
    report["source_ci_run_id"] = run_id
    report["source_ci_run_attempt"] = int(run["run_attempt"])
    report["base_tree_equivalence"] = "HEAD_BASE_IDENTICAL_FROM_SOURCE_AND_CURRENT_PR"
    return report


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
        gh = GitHub(env["GITHUB_REPOSITORY"], env.get("GH_TOKEN", ""))
        if env.get("GITHUB_EVENT_NAME") == "workflow_run":
            checked_sha = subprocess.check_output(
                ["git", "rev-parse", "HEAD"], text=True, timeout=5).strip()
            report["validator_sha"] = validate_validator_sha(
                env.get("GITHUB_SHA"), checked_sha)
            report.update(trusted_source(env, event, gh))
        else:
            report.update(check(env, event, gh))
        code = 0
    except Blocked as error:
        report.update(automated_qa=error.status, decision_reason=error.reason)
    except (KeyError, OSError, ValueError, TypeError, UnicodeError,
            subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
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
