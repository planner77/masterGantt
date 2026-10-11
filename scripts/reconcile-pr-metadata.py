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

from qa_final_automated import (Blocked, GitHub, verify_same_base_full_run,
                                source_artifact, verified_source)

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
    """Pre-filter source metadata. Full authenticity uses #593 event artifacts."""
    refs = run.get("pull_requests") or []
    if not isinstance(refs, list) or len(refs) > 1:
        return False
    if refs:
        p = refs[0]
        if (positive(p.get("number")) != number
                or (p.get("head") or {}).get("sha") != head
                or (p.get("base") or {}).get("sha") != base):
            return False
    # #593 permits an empty workflow_run.pull_requests only when verified
    # against the immutable source artifact and the commit->PR API.
    return (run.get("head_sha") == head
            and str(run.get("path") or "").split("@")[0] == ".github/workflows/ci.yml"
            and run.get("event") == "pull_request"
            and (run.get("head_repository") or {}).get("full_name", repo) == repo)


def attested_source(gh: GitHub, run: dict) -> tuple:
    """Use main's fail-closed run/attempt artifact and commit-to-PR witness."""
    run_id, attempt = positive(run.get("id")), run.get("run_attempt")
    if run_id <= 0 or type(attempt) is not int or not 1 <= attempt <= 10:
        raise NoRecovery("BLOCKED", "원본 CI run/attempt 불완전")
    try:
        return verified_source(gh, run, source_artifact(gh, run_id, attempt))
    except Blocked as error:
        raise NoRecovery("BLOCKED", "원본 CI provenance 미검증: " + error.reason) from error


def source_pr(gh: GitHub, trigger: dict) -> dict:
    if (trigger.get("event") != "pull_request"
            or trigger.get("status") != "completed"
            or str(trigger.get("path") or "").split("@")[0] != ".github/workflows/ci.yml"):
        raise NoRecovery("IGNORED", "원본 CI pull_request 완료 이벤트가 아님")
    repo = gh.repo
    if ((trigger.get("repository") or {}).get("full_name") != repo
            or (trigger.get("head_repository") or {}).get("full_name") != repo):
        raise NoRecovery("BLOCKED", "원본 repository/fork 신뢰 경계 불일치")
    run_id = positive(trigger.get("id"))
    if not run_id:
        raise NoRecovery("BLOCKED", "원본 CI run ID 누락")
    original = gh.get(f"{gh.prefix}/actions/runs/{run_id}")
    fields = ("id", "run_attempt", "head_sha", "head_branch", "event", "path")
    if (any(original.get(field) != trigger.get(field) for field in fields)
            or original.get("status") != "completed"
            or (original.get("repository") or {}).get("full_name") != repo):
        raise NoRecovery("BLOCKED", "workflow_run 이벤트와 실제 CI 원장 불일치")
    number, head, base, merge, live = attested_source(gh, original)
    if (trigger.get("head_sha") not in (head, merge)
            or trigger.get("head_branch") != (live.get("head") or {}).get("ref")
            or (live.get("head", {}).get("repo") or {}).get("full_name") != repo):
        raise NoRecovery("BLOCKED", "원본 event artifact/현재 PR 출처 불일치")
    return live


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
    # Match the metadata-only run to #593's immutable CI event artifact,
    # not a possibly empty pull_requests field or a user-editable run title.
    source_n, source_h, source_b, _, _ = attested_source(gh, meta)
    if (source_n, source_h, source_b) != (number, head, base):
        raise NoRecovery("BLOCKED", "metadata run 출처 PR/head/base 불일치")
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
