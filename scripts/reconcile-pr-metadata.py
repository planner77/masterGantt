#!/usr/bin/env python3
"""Event-driven recovery for an exact failed metadata-only PR CI run (#600).

Trusted default-branch code only. This script reruns failed jobs of one verified
PR metadata run, never executes PR code in a write-capable runner, and never
approves, merges, or releases anything.
"""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

from qa_final_automated import Blocked, GitHub, verify_same_base_full_run

TRACE_PATH = Path(__file__).with_name("verify-ci-run-trace.py")
_spec = importlib.util.spec_from_file_location("verify_ci_run_trace", TRACE_PATH)
if _spec is None or _spec.loader is None:
    raise RuntimeError("CI trace validator unavailable")
trace = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(trace)

META_MARKER = "[메타데이터 검증]"
META_JOB = "PR metadata가 기존 전체 CI 증거를 보존하는지 검증"
REQUIRED = (
    "Build, static checks, and unit tests",
    "Chromium end-to-end tests",
    "Docker build and runtime smoke test",
)
SHA_RE = re.compile(r"^[0-9a-f]{40}$")


class NoRecovery(Exception):
    """A safe no-op: no check is changed or treated as successful."""

    def __init__(self, state: str, reason: str):
        super().__init__(reason)
        self.state = state


def positive(value: object) -> int:
    try:
        n = int(value)
    except (ValueError, TypeError):
        return 0
    return n if n > 0 else 0


def exact_source(run: dict, number: int, head: str, base: str, repo: str) -> bool:
    """Require an unambiguous PR/Head/base source for any rerun target."""
    refs = run.get("pull_requests") or []
    if not isinstance(refs, list) or len(refs) != 1:
        return False
    p = refs[0]
    return (
        positive(p.get("number")) == number
        and (p.get("head") or {}).get("sha") == head
        and (p.get("base") or {}).get("sha") == base
        and run.get("head_sha") == head
        and str(run.get("path") or "").split("@")[0] == ".github/workflows/ci.yml"
        and run.get("event") == "pull_request"
        and (run.get("head_repository") or {}).get("full_name", repo) == repo
    )


def source_pr(gh: GitHub, trigger: dict) -> dict:
    if (trigger.get("event") != "pull_request"
            or trigger.get("status") != "completed"
            or str(trigger.get("path") or "").split("@")[0] != ".github/workflows/ci.yml"):
        raise NoRecovery("IGNORED", "원본 CI pull_request 완료 이벤트가 아님")
    repo = gh.repo
    if ((trigger.get("repository") or {}).get("full_name") != repo
            or (trigger.get("head_repository") or {}).get("full_name") != repo):
        raise NoRecovery("BLOCKED", "원본 repository / fork 신뢰 경계 불일치")
    head, branch = trigger.get("head_sha") or "", trigger.get("head_branch") or ""
    if not SHA_RE.fullmatch(head) or not branch:
        raise NoRecovery("BLOCKED", "원본 Head SHA/branch 확인 불가")
    refs = trigger.get("pull_requests") or []
    if not isinstance(refs, list) or len(refs) > 1:
        raise NoRecovery("BLOCKED", "원본 CI PR 귀속 불명확")
    # GitHub workflow_run.pull_requests may be empty. Accept only a UNIQUE
    # same-repository open PR matching the immutable source SHA and branch.
    candidates = []
    for pr in gh.pages(f"{gh.prefix}/pulls?state=open"):
        h = pr.get("head") or {}
        if (h.get("sha") == head and h.get("ref") == branch
                and (h.get("repo") or {}).get("full_name") == repo):
            candidates.append(pr)
    if len(candidates) != 1:
        raise NoRecovery("BLOCKED", "단일 현재 PR의 exact ref 귀속 실패")
    initial = candidates[0]
    number = positive(initial.get("number"))
    base = (initial.get("base") or {}).get("sha")
    if not number or not SHA_RE.fullmatch(str(base)):
        raise NoRecovery("BLOCKED", "PR 번호/base 누락")
    if refs and not exact_source(trigger, number, head, base, repo):
        raise NoRecovery("BLOCKED", "원본 workflow_run PR/Head/base 불일치")
    latest = gh.get(f"{gh.prefix}/pulls/{number}")
    h = latest.get("head") or {}
    if (latest.get("state") != "open"
            or h.get("sha") != head or h.get("ref") != branch
            or (h.get("repo") or {}).get("full_name") != repo
            or (latest.get("base") or {}).get("sha") != base):
        raise NoRecovery("STALE", "최신 PR Head/base 변경")
    return latest


def classify(gh: GitHub, trigger: dict, *, verify_full=verify_same_base_full_run,
             validate_trace=None) -> dict:
    pr = source_pr(gh, trigger)
    number, head, base = positive(pr["number"]), pr["head"]["sha"], pr["base"]["sha"]
    validator = validate_trace or trace.validate_pull_request
    try:
        validator({"number": number, "pull_request": pr,
                   "repository": {"full_name": gh.repo}})
    except Exception as exc:
        raise NoRecovery("TRACE_INVALID", type(exc).__name__) from exc
    runs = gh.collection(
        f"{gh.prefix}/actions/workflows/ci.yml/runs?event=pull_request&head_sha={head}",
        "workflow_runs")
    # Latest edited run wins including queued/cancelled. Earlier failed edits
    # are never re-run after a newer edit or synchronize.
    edited = sorted(
        (r for r in runs if r.get("event") == "pull_request"
         and r.get("head_sha") == head and META_MARKER in str(r.get("display_title") or "")
         and str(r.get("path") or "").split("@")[0] == ".github/workflows/ci.yml"),
        key=lambda r: (positive(r.get("run_number")), positive(r.get("id"))), reverse=True)
    if not edited:
        raise NoRecovery("NO_METADATA", "최신 Head metadata-only run 없음")
    meta = edited[0]
    if not exact_source(meta, number, head, base, gh.repo):
        raise NoRecovery("BLOCKED", "metadata run PR/Head/base 불일치")
    if meta.get("status") != "completed":
        raise NoRecovery("WAIT_METADATA", "최신 metadata run 진행 중")
    if meta.get("conclusion") == "success":
        raise NoRecovery("ALREADY_VERIFIED", "최신 metadata run 성공")
    if meta.get("conclusion") != "failure":
        raise NoRecovery("NO_RETRY", "최신 edited run 취소/중립/기타 결론")
    if meta.get("run_attempt") != 1:
        raise NoRecovery("RETRY_LIMIT", "자동 재실행은 최초 실패 1회에 한정")
    meta_id = positive(meta.get("id"))
    if not meta_id:
        raise NoRecovery("BLOCKED", "metadata run id 누락")
    jobs = gh.collection(f"{gh.prefix}/actions/runs/{meta_id}/attempts/1/jobs", "jobs")
    names = [job.get("name") for job in jobs]
    if (not names or any(not isinstance(name, str) for name in names)
            or len(names) != len(set(names))):
        raise NoRecovery("BLOCKED", "metadata attempt Job 이름 누락/중복")
    results = {job["name"]: job.get("conclusion") for job in jobs}
    if (results.get("변경 경로 판정") != "success"
            or results.get(META_JOB) != "failure"
            or any(results.get(name) != "failure" for name in REQUIRED)):
        raise NoRecovery("NO_RETRY", "metadata 증거 실패 외의 검증 오류 또는 구조 변경")
    # Source of truth for latest successful same-PR/head/base Full CI:
    # #595 attempt ledger; no old success masks a newer failure/re-run.
    try:
        full_id = verify_full(gh, number, head, base, meta_id)
    except Blocked as exc:
        raise NoRecovery("WAIT_FULL", exc.reason) from exc
    fresh = gh.get(f"{gh.prefix}/actions/runs/{meta_id}")
    if (fresh.get("status") != "completed" or fresh.get("conclusion") != "failure"
            or fresh.get("run_attempt") != 1
            or not exact_source(fresh, number, head, base, gh.repo)):
        raise NoRecovery("STALE", "POST 직전 최신 metadata run 변경")
    return {"state": "READY", "pr": number, "head_sha": head, "base_sha": base,
            "metadata_run_id": meta_id, "full_run_id": full_id, "attempt": 1}


def post_rerun(repo: str, run_id: int, token: str) -> None:
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", repo) or run_id <= 0 or not token:
        raise RuntimeError("재실행 인자 오류")
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/rerun-failed-jobs",
        data=b"", method="POST",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "mastergantt-metadata-reconciler"})
    with urllib.request.urlopen(req, timeout=20) as response:
        if response.status not in (201, 202):
            raise RuntimeError(f"rerun failed jobs: HTTP {response.status}")


def main() -> int:
    env = os.environ
    summary = Path(env.get("GITHUB_STEP_SUMMARY") or "/dev/null")
    try:
        gh = GitHub(env["GITHUB_REPOSITORY"], env["GH_TOKEN"])
        event = json.loads(Path(env["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
        if env.get("GITHUB_EVENT_NAME") != "workflow_run":
            raise NoRecovery("IGNORED", "trusted workflow_run 전용")
        try:
            result = classify(gh, event["workflow_run"])
            # Re-read PR+run+full state without sleeping; no stale mutation.
            if result != classify(gh, event["workflow_run"]):
                raise NoRecovery("STALE", "POST 직전 증거 변화")
        except NoRecovery as exc:
            print(f"Metadata recovery {exc.state}: {exc}")
            with summary.open("a", encoding="utf-8") as file:
                file.write(f"## Metadata recovery: {exc.state}\n\n{exc}\n")
            return 0
        post_rerun(gh.repo, result["metadata_run_id"], env["GH_TOKEN"])
        print("Metadata recovery RETRY_REQUESTED:", result)
        with summary.open("a", encoding="utf-8") as file:
            file.write("## Metadata recovery: RETRY_REQUESTED\n\n"
                       f"- PR: #{result['pr']}\n- Head/base: "
                       f"{result['head_sha']} / {result['base_sha']}\n"
                       f"- Full run: {result['full_run_id']}\n"
                       f"- Metadata failed run: {result['metadata_run_id']}.1\n"
                       "- 실제 재실행/QA 결과는 후속 CI에서만 PASS 판정합니다.\n")
        return 0
    except NoRecovery as exc:
        print(f"Metadata recovery {exc.state}: {exc}")
        return 0
    except (KeyError, TypeError, ValueError, OSError, RuntimeError,
            urllib.error.URLError, Blocked) as exc:
        print(f"Metadata recovery ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
