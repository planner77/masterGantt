#!/usr/bin/env python3
"""Fail-closed, read-only PR metadata/full-CI evidence gate (Issue #577).

No polling or new privileges: an in-progress/missing full run is DEFERRED/FAIL.
Only an exact-HEAD completed full run with all three required checks green may pass.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable

ROOT = pathlib.Path(__file__).resolve().parents[1]
TRACE_PATH = ROOT / "scripts" / "verify-ci-run-trace.py"
QA_PATH = ROOT / "scripts" / "qa_final_automated.py"
FULL_GATES = (
    "Build, static checks, and unit tests",
    "Chromium end-to-end tests",
    "Docker build and runtime smoke test",
)
METADATA_JOB = "PR metadata가 기존 전체 CI 증거를 보존하는지 검증"
FULL_MARKER = "[전체 검증]"
METADATA_MARKER = "[메타데이터 검증]"
BAD_CONCLUSIONS = {"failure", "cancelled", "timed_out", "action_required", "stale", "startup_failure"}


def _load_trace_module() -> Any:
    spec = importlib.util.spec_from_file_location("verify_ci_run_trace", TRACE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("Primary Issue trace validator를 읽을 수 없습니다")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_current_trace(pr: dict[str, Any], repo: str, number: int) -> None:
    _load_trace_module().validate_pull_request(
        {"number": number, "pull_request": pr, "repository": {"full_name": repo}}
    )


def _matches_pr(run: dict[str, Any], number: int, head_sha: str, current_run_id: int) -> bool:
    if (
        int(run.get("id") or 0) == current_run_id
        or run.get("event") != "pull_request"
        or run.get("head_sha") != head_sha
        or str(run.get("path") or "").split("@")[0] != ".github/workflows/ci.yml"
    ):
        return False
    prs = run.get("pull_requests") or []
    return not prs or (len(prs) == 1 and int(prs[0].get("number") or 0) == number)


def _job_results(jobs: list[dict[str, Any]]) -> dict[str, str]:
    return {str(j.get("name")): str(j.get("conclusion") or "") for j in jobs}


def classify_full_evidence(
    runs: list[dict[str, Any]],
    fetch_jobs: Callable[[int], list[dict[str, Any]]],
    *,
    pr_number: int,
    head_sha: str,
    current_run_id: int,
) -> tuple[str, int | None, str]:
    """Return (state, full_run_id, explanation). Never reuse a different SHA.

    Newest eligible full CI wins; a newer failed/pending full run cannot be masked
    by an older successful run. Edited runs are excluded by marker or metadata job.
    """
    candidates = sorted(
        (r for r in runs if _matches_pr(r, pr_number, head_sha, current_run_id)),
        key=lambda r: (int(r.get("run_number") or 0), int(r.get("id") or 0)),
        reverse=True,
    )
    for run in candidates:
        run_id = int(run["id"])
        display = str(run.get("display_title") or "")
        if METADATA_MARKER in display:
            continue
        jobs = _job_results(fetch_jobs(run_id))
        metadata_conclusion = jobs.get(METADATA_JOB)
        if metadata_conclusion is not None and metadata_conclusion != "skipped":
            continue
        # Older workflow versions lack a type marker. Trust their job topology,
        # never guess "full" if the metadata job has not materialized yet.
        if metadata_conclusion is None and FULL_MARKER not in display:
            continue

        run_status = str(run.get("status") or "")
        conclusion = str(run.get("conclusion") or "")
        if conclusion in BAD_CONCLUSIONS:
            return "FULL_FAILED", run_id, f"전체 CI 결론: {conclusion}"
        gate_states = {name: jobs.get(name, "") for name in FULL_GATES}
        if run_status != "completed":
            return "DEFERRED", run_id, f"전체 CI 진행 중: {run_status or 'unknown'}"
        if conclusion == "success" and all(state == "success" for state in gate_states.values()) and metadata_conclusion == "skipped":
            return "VERIFIED", run_id, "동일 SHA 전체 CI의 3개 필수 Gate SUCCESS"
        # Completed but missing/failed/neutral/skipped required checks is not evidence.
        return "FULL_FAILED", run_id, f"전체 CI 또는 필수 Gate 증거 불일치: {gate_states!r}"
    return "MISSING", None, "동일 SHA의 판별 가능한 전체 PR CI 실행이 없습니다"


def _api(path: str, token: str) -> dict[str, Any]:
    request = urllib.request.Request(
        "https://api.github.com/" + path.lstrip("/"),
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "masterGantt-metadata-evidence",
        },
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        data = json.load(response)
    if not isinstance(data, dict):
        raise RuntimeError("GitHub API 반환 JSON 형식 오류")
    return data


def validate_full_source(repo: str, token: str, run_id: int, number: int,
                         head: str, base: str, merge: str) -> None:
    """Cross-check PR event provenance against source full CI and live PR."""
    spec = importlib.util.spec_from_file_location("qa_source", QA_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("trusted source validator를 불러올 수 없습니다")
    qa = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(qa)
    gh = qa.GitHub(repo, token)
    run = gh.get(f"{gh.prefix}/actions/runs/{run_id}")
    artifact = qa.source_artifact(gh, run_id, int(run.get("run_attempt") or 0))
    observed_n, observed_h, observed_b, observed_m, _ = qa.verified_source(gh, run, artifact)
    if (observed_n, observed_h, observed_b, observed_m) != (number, head, base, merge):
        raise RuntimeError("이전 full CI 원본 PR/head/base/merge 증거 불일치")


def _current_pr(repo: str, number: int, token: str) -> dict[str, Any]:
    return _api(f"repos/{repo}/pulls/{number}", token)


def _event_head(payload: dict[str, Any]) -> tuple[int, str]:
    pr = payload.get("pull_request") or {}
    number = int(pr.get("number") or payload.get("number") or 0)
    head = str((pr.get("head") or {}).get("sha") or "")
    if number <= 0 or len(head) != 40 or not all(c in "0123456789abcdef" for c in head.lower()):
        raise RuntimeError("이벤트 PR 번호 또는 Head SHA가 올바르지 않습니다")
    return number, head


def _inspect_trace(event_sha: str, live_pr: dict[str, Any], repo: str, number: int) -> tuple[str, str]:
    current_sha = str((live_pr.get("head") or {}).get("sha") or "")
    if len(current_sha) != 40:
        return "API_ERROR", "현재 PR Head SHA를 조회할 수 없습니다"
    if event_sha != current_sha:
        return "SUPERSEDED", "이벤트 Head가 현재 PR Head와 달라 비권위/N/A 종료합니다"
    try:
        validate_current_trace(live_pr, repo, number)
    except Exception as exc:  # TraceError, missing fields, API schema discrepancy
        return "TRACE_INVALID", f"현재 PR의 Primary Issue trace 불일치: {exc}"
    return "TRACE_OK", "현재 PR의 canonical title/body/branch trace 확인"


def evaluate(
    payload: dict[str, Any],
    *,
    repo: str,
    current_run_id: int,
    api_get: Callable[[str], dict[str, Any]],
    mode: str,
    source_check: Callable[[int, int, str, str, str], None] | None = None,
) -> tuple[str, int | None, str, str, str]:
    """Injectable API for deterministic scenarios; second live read closes head race."""
    number, event_sha = _event_head(payload)
    live = api_get(f"repos/{repo}/pulls/{number}")
    status, reason = _inspect_trace(event_sha, live, repo, number)
    current_sha = str((live.get("head") or {}).get("sha") or "")
    if status != "TRACE_OK" or mode == "trace":
        return status, None, reason, event_sha, current_sha

    params = urllib.parse.urlencode(
        {"event": "pull_request", "head_sha": event_sha, "per_page": 100}
    )
    data = api_get(f"repos/{repo}/actions/workflows/ci.yml/runs?{params}")
    runs = data.get("workflow_runs")
    if not isinstance(runs, list):
        raise RuntimeError("workflow_runs 결과를 읽을 수 없습니다")

    def fetch_jobs(run_id: int) -> list[dict[str, Any]]:
        response = api_get(f"repos/{repo}/actions/runs/{run_id}/jobs?filter=latest&per_page=100")
        jobs = response.get("jobs")
        if not isinstance(jobs, list):
            raise RuntimeError("전체 CI job 결과를 읽을 수 없습니다")
        return jobs

    state, full_run_id, reason = classify_full_evidence(
        runs, fetch_jobs, pr_number=number, head_sha=event_sha, current_run_id=current_run_id
    )
    latest = api_get(f"repos/{repo}/pulls/{number}")
    latest_state, latest_reason = _inspect_trace(event_sha, latest, repo, number)
    latest_sha = str((latest.get("head") or {}).get("sha") or "")
    if latest_state != "TRACE_OK":
        return latest_state, full_run_id, latest_reason, event_sha, latest_sha
    if state == "VERIFIED":
        if not source_check:
            # Classifier-only callers may inspect status, never publish evidence
            # without a source validator in the actual Actions entrypoint.
            return "SOURCE_UNVERIFIED", full_run_id, "원본 event 출처 검증 미설정", event_sha, latest_sha
        base = str((latest.get("base") or {}).get("sha") or "")
        merge = str(latest.get("merge_commit_sha") or "")
        if len(base) != 40 or len(merge) != 40:
            return "SOURCE_UNVERIFIED", full_run_id, "현재 PR base/merge 정보 없음", event_sha, latest_sha
        try:
            source_check(full_run_id, number, event_sha, base, merge)
        except Exception as exc:
            return "SOURCE_UNVERIFIED", full_run_id, "원본 full CI provenance 차단: " + str(exc), event_sha, latest_sha
    return state, full_run_id, reason, event_sha, latest_sha


def _report(state: str, run_id: int | None, reason: str, event_sha: str, current_sha: str) -> None:
    print(
        f"PR metadata evidence: {state} · event_sha={event_sha} · "
        f"current_sha={current_sha} · full_run={run_id or 'N/A'} · {reason}"
    )
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as file:
            file.write(f"state={state}\nfull_run_id={run_id or ''}\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as file:
            file.write(
                "## PR metadata / full CI 증거 판정\n\n"
                f"- 상태: \`{state}\`\n"
                f"- 이벤트 Head: \`{event_sha}\`\n"
                f"- 조회한 현재 Head: \`{current_sha}\`\n"
                f"- 동일 SHA 전체 CI Run: \`{run_id or 'N/A'}\`\n"
                f"- 판정: {reason}\n\n"
                "DEFERRED/MISSING은 자동 녹색 처리하지 않으며, 전체 CI 완료 후 "
                "메타데이터 Run의 실패 Job을 재실행해야 합니다.\n"
            )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("trace", "evidence"), default="evidence")
    args = parser.parse_args()
    try:
        repo = os.environ["GITHUB_REPOSITORY"]
        token = os.environ["GH_TOKEN"]
        current_run_id = int(os.environ["GITHUB_RUN_ID"])
        event_file = pathlib.Path(os.environ["GITHUB_EVENT_PATH"])
        payload = json.loads(event_file.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise RuntimeError("GitHub 이벤트 JSON 형식 오류")
        state, run_id, reason, event_sha, current_sha = evaluate(
            payload, repo=repo, current_run_id=current_run_id,
            api_get=lambda path: _api(path, token), mode=args.mode,
            source_check=lambda run, number, head, base, merge:
                validate_full_source(repo, token, run, number, head, base, merge),
        )
        _report(state, run_id, reason, event_sha, current_sha)
        # SUPERSEDED affects only an old SHA and cannot approve the latest head.
        # DEFERRED/MISSING/FAILED/INVALID stay red until a valid re-evaluation.
        return 0 if state in ("TRACE_OK", "VERIFIED", "SUPERSEDED") else 1
    except (KeyError, ValueError, RuntimeError, OSError, urllib.error.URLError) as exc:
        print(f"PR metadata evidence FAIL (API/환경 불확실성): {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
