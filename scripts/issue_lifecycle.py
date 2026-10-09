#!/usr/bin/env python3
"""Fail-closed Issue lifecycle orchestration for GitHub Actions.

The workflow remains generic: Issue/PR identity is input, while branch, SHA,
version, CI and release evidence are resolved from GitHub and repository state.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Any

REQUIRED_CHECKS = (
    "Build, static checks, and unit tests",
    "Chromium end-to-end tests",
    "Docker build and runtime smoke test",
)
MAIN_ARTIFACT_JOB = "Main 임시 commit 이미지 게시·검증·정리"
FINAL_MARKER_PREFIX = "<!-- issue-lifecycle-final:"
FINAL_MARKER_RE = re.compile(r"<!-- issue-lifecycle-final:([1-9][0-9]*):([0-9a-f]{40}) -->")


class LifecycleError(RuntimeError):
    pass


@dataclass
class Context:
    issue_number: int
    pr_number: int
    issue_state: str
    head_branch: str
    head_sha: str
    merge_sha: str | None
    current_main_sha: str
    version: str
    pr_checks_ok: bool
    main_ci_url: str | None
    main_ci_ok: bool
    main_docs_only: bool
    main_artifact_ok: bool
    main_artifact_evidence: str
    merged: bool


def run(
    *args: str,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, text=True, capture_output=True, env=env)
    if check and result.returncode != 0:
        raise LifecycleError(
            f"command failed ({result.returncode}): {' '.join(args)}\n{result.stderr.strip()}"
        )
    return result


def git_remote_auth_env() -> dict[str, str]:
    """Return process-scoped GitHub HTTPS auth without persisting credentials."""
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        raise LifecycleError("GITHUB_TOKEN is required for authenticated git remote access")

    basic = base64.b64encode(f"x-access-token:{token}".encode("utf-8")).decode("ascii")
    env = os.environ.copy()
    env.update(
        {
            # http.extraHeader is multi-valued across config scopes. Reset
            # inherited checkout/local values first so exactly one
            # Authorization header reaches GitHub.
            "GIT_CONFIG_COUNT": "2",
            "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
            "GIT_CONFIG_VALUE_0": "",
            "GIT_CONFIG_KEY_1": "http.https://github.com/.extraheader",
            "GIT_CONFIG_VALUE_1": f"AUTHORIZATION: basic {basic}",
        }
    )
    return env


def run_git_remote(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run("git", *args, check=check, env=git_remote_auth_env())


def push_git_refs(*refs: str) -> None:
    """Push refs with job-scoped auth while checkout credentials stay disabled."""
    run_git_remote("push", "origin", *refs)


def gh(path: str, *, method: str = "GET", fields: dict[str, str] | None = None) -> Any:
    cmd = ["gh", "api", path, "--method", method]
    for key, value in (fields or {}).items():
        cmd.extend(["-f", f"{key}={value}"])
    result = run(*cmd)
    text = result.stdout.strip()
    return json.loads(text) if text else None


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no", ""}:
        return False
    raise LifecycleError(f"invalid boolean value: {value!r}")


def validate_inputs(
    issue: str,
    pr: str,
    release_required: bool,
    release_authorized: bool,
    expected_version: str,
    authorization_note: str,
) -> tuple[int, int]:
    if not re.fullmatch(r"[1-9][0-9]*", issue):
        raise LifecycleError("issue_number must be a positive integer")
    if not re.fullmatch(r"[1-9][0-9]*", pr):
        raise LifecycleError("pr_number must be a positive integer")
    if release_required and not expected_version.strip():
        raise LifecycleError("expected_version is required when release_required=true")
    if release_authorized and not authorization_note.strip():
        raise LifecycleError("authorization_note is required when release_authorized=true")
    if not release_required and release_authorized:
        raise LifecycleError("release_authorized=true is invalid when release_required=false")
    return int(issue), int(pr)


def validate_operation_inputs(args: argparse.Namespace) -> None:
    if args.operation not in {"release_start", "release_finalize"}:
        return
    if not parse_bool(args.release_required):
        raise LifecycleError(f"{args.operation} requires release_required=true")
    if not parse_bool(args.release_authorized):
        raise LifecycleError(f"{args.operation} requires release_authorized=true")
    if not args.expected_version.strip():
        raise LifecycleError(f"{args.operation} requires expected_version")
    if not args.authorization_note.strip():
        raise LifecycleError(f"{args.operation} requires authorization_note")


def mutation_gate(
    *,
    merged: bool,
    checks_ok: bool,
    main_ci_ok: bool,
    main_artifact_ok: bool,
    release_required: bool,
    release_authorized: bool,
    version_ok: bool,
) -> str:
    if not version_ok:
        return "FAIL"
    if not merged:
        return "BLOCKED"
    if not checks_ok or not main_ci_ok or not main_artifact_ok:
        return "NOT TESTED"
    if release_required and not release_authorized:
        return "BLOCKED"
    return "PASS"


def git_show_json(sha: str, path: str) -> Any:
    text = run("git", "show", f"{sha}:{path}").stdout
    return json.loads(text)


def docs_only_paths(paths: list[str]) -> bool:
    if not paths:
        return False
    return all(
        path.startswith("docs/") or ("/" not in path and path.endswith(".md"))
        for path in paths
    )


def main_change_docs_only(target_sha: str) -> bool:
    parents = run("git", "rev-list", "--parents", "-n", "1", target_sha).stdout.strip().split()
    if len(parents) < 2:
        return False
    first_parent = parents[1]
    raw = run("git", "diff", "--name-only", "-z", first_parent, target_sha).stdout
    paths = [path for path in raw.split("\0") if path]
    return docs_only_paths(paths)


def main_artifact_gate(
    jobs: list[dict[str, Any]], *, docs_only: bool
) -> tuple[bool, str]:
    matches = [job for job in jobs if job.get("name") == MAIN_ARTIFACT_JOB]
    if len(matches) != 1:
        return False, f"NOT TESTED — expected one {MAIN_ARTIFACT_JOB} job, found {len(matches)}"

    job = matches[0]
    status = job.get("status")
    conclusion = job.get("conclusion")
    url = job.get("html_url") or job.get("url") or "N/A"

    if docs_only:
        ok = status == "completed" and conclusion == "skipped"
        evidence = (
            f"N/A — docs-only; artifact job skipped as expected ({url})"
            if ok
            else f"NOT TESTED — docs-only artifact job expected skipped, got {status}/{conclusion} ({url})"
        )
        return ok, evidence

    ok = status == "completed" and conclusion == "success"
    evidence = (
        f"PASS — {url}"
        if ok
        else f"NOT TESTED — non-docs artifact job is {status}/{conclusion} ({url})"
    )
    return ok, evidence


def exact_main_ci(
    repo: str, sha: str, *, docs_only: bool
) -> tuple[bool, str | None, bool, str]:
    data = gh(
        f"/repos/{repo}/actions/workflows/ci.yml/runs"
        f"?event=push&branch=main&head_sha={sha}&per_page=100"
    )
    runs = [r for r in data.get("workflow_runs", []) if r.get("head_sha") == sha]
    if not runs:
        return False, None, False, "NOT TESTED — exact main CI run not found"

    def run_order(run_data: dict[str, Any]) -> tuple[str, int, int]:
        return (
            str(run_data.get("created_at") or ""),
            int(run_data.get("run_attempt") or 0),
            int(run_data.get("id") or 0),
        )

    ordered = sorted(runs, key=run_order, reverse=True)
    successful = [
        run_data
        for run_data in ordered
        if run_data.get("status") == "completed"
        and run_data.get("conclusion") == "success"
    ]

    for run_data in successful:
        run_id = run_data.get("id")
        if not run_id:
            continue
        jobs_data = gh(
            f"/repos/{repo}/actions/runs/{run_id}/jobs?filter=latest&per_page=100"
        )
        jobs = jobs_data.get("jobs", []) if isinstance(jobs_data, dict) else []
        artifact_ok, artifact_evidence = main_artifact_gate(
            jobs, docs_only=docs_only
        )
        if artifact_ok:
            return True, run_data.get("html_url"), True, artifact_evidence

    latest = ordered[0]
    latest_ok = (
        latest.get("status") == "completed"
        and latest.get("conclusion") == "success"
    )
    latest_url = latest.get("html_url")
    latest_id = latest.get("id")
    if not latest_id:
        return (
            latest_ok,
            latest_url,
            False,
            "NOT TESTED — main CI run id is missing",
        )

    jobs_data = gh(
        f"/repos/{repo}/actions/runs/{latest_id}/jobs?filter=latest&per_page=100"
    )
    jobs = jobs_data.get("jobs", []) if isinstance(jobs_data, dict) else []
    artifact_ok, artifact_evidence = main_artifact_gate(
        jobs, docs_only=docs_only
    )
    return latest_ok, latest_url, artifact_ok, artifact_evidence


def required_checks_ok(repo: str, sha: str) -> tuple[bool, list[str]]:
    data = gh(f"/repos/{repo}/commits/{sha}/check-runs?per_page=100")
    latest: dict[str, dict[str, Any]] = {}
    for item in data.get("check_runs", []):
        name = item.get("name")
        if name not in REQUIRED_CHECKS:
            continue
        app = item.get("app") or {}
        if app.get("slug") != "github-actions":
            continue

        previous = latest.get(name)
        current_id = int(item.get("id") or 0)
        previous_id = int(previous.get("id") or 0) if previous else -1
        if previous is None or current_id > previous_id:
            latest[name] = item

    found = {
        name: (
            item.get("status") == "completed"
            and item.get("conclusion") == "success"
        )
        for name, item in latest.items()
    }
    missing = [name for name in REQUIRED_CHECKS if not found.get(name, False)]
    return not missing, missing


def resolve_context(args: argparse.Namespace) -> Context:
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if not repo:
        raise LifecycleError("GITHUB_REPOSITORY is required")

    release_required = parse_bool(args.release_required)
    release_authorized = parse_bool(args.release_authorized)
    issue_number, pr_number = validate_inputs(
        args.issue,
        args.pr,
        release_required,
        release_authorized,
        args.expected_version,
        args.authorization_note,
    )

    issue = gh(f"/repos/{repo}/issues/{issue_number}")
    pr = gh(f"/repos/{repo}/pulls/{pr_number}")

    if pr.get("base", {}).get("ref") != "main":
        raise LifecycleError("PR base must be main")
    if pr.get("head", {}).get("repo", {}).get("full_name") != repo:
        raise LifecycleError("PR head repository must be the current repository")

    body = pr.get("body") or ""
    if not re.search(rf"(?im)^\s*Refs\s+#\s*{issue_number}\b", body):
        raise LifecycleError(f"PR body must contain 'Refs #{issue_number}'")

    head_sha = pr.get("head", {}).get("sha") or ""
    head_branch = pr.get("head", {}).get("ref") or ""
    merged = bool(pr.get("merged"))
    merge_sha = pr.get("merge_commit_sha") if merged else None
    target_sha = merge_sha or head_sha
    if not target_sha:
        raise LifecycleError("could not resolve PR target SHA")

    run("git", "fetch", "--no-tags", "origin", "main")
    if not merged:
        run(
            "git",
            "fetch",
            "--no-tags",
            "origin",
            f"refs/heads/{head_branch}:refs/remotes/origin/{head_branch}",
        )
    if merged:
        ancestor = run("git", "merge-base", "--is-ancestor", target_sha, "origin/main", check=False)
        if ancestor.returncode != 0:
            raise LifecycleError("PR merge commit is not an ancestor of current main")

    package = git_show_json(target_sha, "package.json")
    lock = git_show_json(target_sha, "package-lock.json")
    version = str(package.get("version", ""))
    if not version:
        raise LifecycleError("package.json version is missing")
    if lock.get("version") != version or (lock.get("packages") or {}).get("", {}).get("version") != version:
        raise LifecycleError("package.json and package-lock.json versions differ")

    version_ok = True
    if release_required:
        version_ok = args.expected_version.strip() == version

    checks_ok, missing_checks = required_checks_ok(repo, head_sha)
    main_ci_ok = False
    main_ci_url: str | None = None
    main_docs_only = False
    main_artifact_ok = False
    main_artifact_evidence = "NOT TESTED — PR not merged"
    if merged and merge_sha:
        main_docs_only = main_change_docs_only(merge_sha)
        (
            main_ci_ok,
            main_ci_url,
            main_artifact_ok,
            main_artifact_evidence,
        ) = exact_main_ci(repo, merge_sha, docs_only=main_docs_only)

    current_main = gh(f"/repos/{repo}/git/ref/heads/main")
    current_main_sha = current_main.get("object", {}).get("sha", "")

    gate = mutation_gate(
        merged=merged,
        checks_ok=checks_ok,
        main_ci_ok=main_ci_ok,
        main_artifact_ok=main_artifact_ok,
        release_required=release_required,
        release_authorized=release_authorized,
        version_ok=version_ok,
    )

    summary = [
        "## Issue Lifecycle verification",
        "",
        f"- Issue: #{issue_number} ({issue.get('state')})",
        f"- PR: #{pr_number}",
        f"- head: {head_branch} @ {head_sha}",
        f"- merge target: {merge_sha or 'N/A — PR not merged'}",
        f"- current main: {current_main_sha}",
        f"- application version: {version}",
        f"- PR required checks: {'PASS' if checks_ok else 'NOT TESTED'}",
        f"- missing/failed checks: {', '.join(missing_checks) if missing_checks else 'none'}",
        f"- exact target main CI: {main_ci_url or 'N/A'}",
        f"- main change docs-only: {str(main_docs_only).lower()}",
        f"- temporary GHCR validation/handoff: {main_artifact_evidence}",
        f"- release_required: {str(release_required).lower()}",
        f"- release_authorized: {str(release_authorized).lower()}",
        f"- gate: {gate}",
    ]
    print("\n".join(summary))
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as fp:
            fp.write("\n".join(summary) + "\n")

    if args.operation in {"release", "release_start", "finalize", "release_finalize"} and gate != "PASS":
        raise LifecycleError(f"mutation blocked by lifecycle gate: {gate}")

    return Context(
        issue_number=issue_number,
        pr_number=pr_number,
        issue_state=issue.get("state", ""),
        head_branch=head_branch,
        head_sha=head_sha,
        merge_sha=merge_sha,
        current_main_sha=current_main_sha,
        version=version,
        pr_checks_ok=checks_ok,
        main_ci_url=main_ci_url,
        main_ci_ok=main_ci_ok,
        main_docs_only=main_docs_only,
        main_artifact_ok=main_artifact_ok,
        main_artifact_evidence=main_artifact_evidence,
        merged=merged,
    )


def successful_release(repo: str, target_sha: str, tag: str) -> dict[str, Any] | None:
    data = gh(f"/repos/{repo}/actions/workflows/release-image.yml/runs?per_page=100")
    matches = [
        r
        for r in data.get("workflow_runs", [])
        if r.get("head_sha") == target_sha
        and r.get("head_branch") == tag
        and r.get("status") == "completed"
        and r.get("conclusion") == "success"
    ]
    return sorted(matches, key=lambda r: r.get("created_at", ""))[-1] if matches else None




def release_runs(repo: str, target_sha: str, tag: str) -> list[dict[str, Any]]:
    data = gh(f"/repos/{repo}/actions/workflows/release-image.yml/runs?per_page=100")
    return [
        item
        for item in data.get("workflow_runs", [])
        if item.get("head_sha") == target_sha and item.get("head_branch") == tag
    ]


def dispatch_release(repo: str, ctx: Context, tag: str) -> None:
    gh(
        f"/repos/{repo}/actions/workflows/release-image.yml/dispatches",
        method="POST",
        fields={
            "ref": tag,
            "inputs[issue_number]": str(ctx.issue_number),
            "inputs[pr_number]": str(ctx.pr_number),
        },
    )

def start_release(ctx: Context, args: argparse.Namespace) -> tuple[str, str]:
    """Create immutable release authority and dispatch the release asynchronously.

    The Generic Finalizer must not occupy a runner while release-image executes.
    Release completion is observed by the workflow_run-driven finalizer.
    """
    repo = os.environ["GITHUB_REPOSITORY"]
    if not parse_bool(args.release_required):
        raise LifecycleError("release start requires release_required=true")
    if not parse_bool(args.release_authorized):
        raise LifecycleError("formal release requires release_authorized=true")
    if not ctx.merge_sha:
        raise LifecycleError("formal release requires a merged PR")

    tag = f"v{ctx.version}"
    remote = run_git_remote(
        "ls-remote",
        "--exit-code",
        "--tags",
        "origin",
        f"refs/tags/{tag}",
        check=False,
    )
    if remote.returncode == 0:
        run_git_remote("fetch", "--force", "origin", f"refs/tags/{tag}:refs/tags/{tag}")
        if run("git", "cat-file", "-t", f"refs/tags/{tag}").stdout.strip() != "tag":
            raise LifecycleError("existing release tag is lightweight; refusing mutation")
        actual = run("git", "rev-parse", f"{tag}^{{commit}}").stdout.strip()
        if actual != ctx.merge_sha:
            raise LifecycleError("existing release tag points to a different SHA")
        existing = successful_release(repo, ctx.merge_sha, tag)
        if existing:
            return tag, existing.get("html_url", "")
        runs = release_runs(repo, ctx.merge_sha, tag)
        if runs:
            raise LifecycleError(
                "existing release tag already has release workflow evidence; "
                "rerun the existing failed/in-progress release instead of dispatching a duplicate"
            )
        dispatch_release(repo, ctx, tag)
        return tag, "REDISPATCHED — existing exact tag had no release run evidence"

    run("git", "config", "user.name", "github-actions[bot]")
    run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    run("git", "tag", "-a", tag, ctx.merge_sha, "-m", f"Release {tag}")
    push_git_refs(f"refs/tags/{tag}")

    dispatch_release(repo, ctx, tag)
    return tag, "DISPATCHED — completion is handled by Generic Release Finalizer"


def ensure_release(ctx: Context, args: argparse.Namespace) -> tuple[str, str]:
    repo = os.environ["GITHUB_REPOSITORY"]
    if not parse_bool(args.release_required):
        raise LifecycleError("release operation requires release_required=true")
    if not parse_bool(args.release_authorized):
        raise LifecycleError("formal release requires release_authorized=true")
    if not ctx.merge_sha:
        raise LifecycleError("formal release requires a merged PR")

    tag = f"v{ctx.version}"
    remote = run_git_remote("ls-remote", "--exit-code", "--tags", "origin", f"refs/tags/{tag}", check=False)
    if remote.returncode == 0:
        run_git_remote("fetch", "--force", "origin", f"refs/tags/{tag}:refs/tags/{tag}")
        if run("git", "cat-file", "-t", f"refs/tags/{tag}").stdout.strip() != "tag":
            raise LifecycleError("existing release tag is lightweight; refusing mutation")
        actual = run("git", "rev-parse", f"{tag}^{{commit}}").stdout.strip()
        if actual != ctx.merge_sha:
            raise LifecycleError("existing release tag points to a different SHA")
        existing = successful_release(repo, ctx.merge_sha, tag)
        if not existing:
            raise LifecycleError("existing tag has no exact successful release evidence")
        return tag, existing.get("html_url", "")

    run("git", "config", "user.name", "github-actions[bot]")
    run("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    run("git", "tag", "-a", tag, ctx.merge_sha, "-m", f"Release {tag}")
    push_git_refs(f"refs/tags/{tag}")

    gh(
        f"/repos/{repo}/actions/workflows/release-image.yml/dispatches",
        method="POST",
        fields={
            "ref": tag,
            "inputs[issue_number]": str(ctx.issue_number),
            "inputs[pr_number]": str(ctx.pr_number),
        },
    )
    for _ in range(240):
        data = gh(f"/repos/{repo}/actions/workflows/release-image.yml/runs?event=workflow_dispatch&per_page=100")
        candidates = [
            r
            for r in data.get("workflow_runs", [])
            if r.get("head_sha") == ctx.merge_sha and r.get("head_branch") == tag
        ]
        if candidates:
            latest = sorted(candidates, key=lambda r: r.get("created_at", ""))[-1]
            if latest.get("status") == "completed":
                if latest.get("conclusion") != "success":
                    raise LifecycleError(f"release-image failed: {latest.get('html_url')}")
                return tag, latest.get("html_url", "")
        time.sleep(15)
    raise LifecycleError("timed out waiting for exact release-image run")


def final_marker(issue_number: int, target_sha: str) -> str:
    return f"{FINAL_MARKER_PREFIX}{issue_number}:{target_sha} -->"


def audited_final_markers(repo: str, ctx: Context) -> dict[str, int]:
    """Authenticate historical per-merge FINAL records before mutation."""
    first_parent = run("git", "rev-list", "--first-parent", "origin/main").stdout.splitlines()
    positions = {sha: index for index, sha in enumerate(first_parent)}
    if not ctx.merge_sha or ctx.merge_sha not in positions:
        raise LifecycleError("FINAL target must belong to main first-parent history")

    records: dict[str, int] = {}
    for page in range(1, 1001):
        comments = gh(f"/repos/{repo}/issues/{ctx.issue_number}/comments?per_page=100&page={page}")
        if not isinstance(comments, list):
            raise LifecycleError("FINAL comment pagination returned a non-list")
        for comment in comments:
            body = comment.get("body") or ""
            lines = [line.strip() for line in body.splitlines()
                     if line.strip().startswith(FINAL_MARKER_PREFIX)]
            if not lines:
                continue
            if len(lines) != 1:
                raise LifecycleError("a FINAL comment must contain exactly one marker")
            match = FINAL_MARKER_RE.fullmatch(lines[0])
            if not match or int(match.group(1)) != ctx.issue_number:
                raise LifecycleError("malformed or cross-Issue FINAL marker")
            target_sha = match.group(2)
            # Duplicate bot-origin comments may exist after an interrupted
            # concurrent run; permit only the same authenticated PR identity.
            # Authentication below is still mandatory for every occurrence.
            if target_sha not in positions:
                raise LifecycleError(f"historical FINAL is not on main first-parent: {target_sha}")
            author = (comment.get("user") or {}).get("login")
            if author != "github-actions[bot]":
                raise LifecycleError(f"untrusted FINAL marker author for {target_sha}: {author}")
            pr_match = re.search(r"(?m)^- PR: #([1-9][0-9]*)$", body)
            head_match = re.search(r"(?m)^- PR head SHA: .([0-9a-f]{40}).$", body)
            branch_match = re.search(r"(?m)^- PR head branch: \x60([^\x60\r\n]+)\x60$", body)
            merge_match = re.search(r"(?m)^- merge/release target SHA: .([0-9a-f]{40}).$", body)
            if not all((pr_match, head_match, branch_match, merge_match)):
                raise LifecycleError(f"incomplete historical FINAL identity: {target_sha}")
            pr_number = int(pr_match.group(1))
            if merge_match.group(1) != target_sha:
                raise LifecycleError(f"FINAL body SHA mismatch: {target_sha}")
            pr = gh(f"/repos/{repo}/pulls/{pr_number}")
            if (
                not isinstance(pr, dict) or not pr.get("merged")
                or pr.get("merge_commit_sha") != target_sha
                or (pr.get("base") or {}).get("ref") != "main"
                or ((pr.get("head") or {}).get("repo") or {}).get("full_name") != repo
                or (pr.get("head") or {}).get("sha") != head_match.group(1)
                or (pr.get("head") or {}).get("ref") != branch_match.group(1)
            ):
                raise LifecycleError(f"historical FINAL PR identity mismatch: PR #{pr_number} / {target_sha}")
            refs = re.findall(r"(?im)^\s*Refs\s+#\s*([1-9][0-9]*)\s*$", pr.get("body") or "")
            if refs != [str(ctx.issue_number)]:
                raise LifecycleError(f"historical FINAL PR #{pr_number} canonical Refs mismatch")
            if target_sha in records and records[target_sha] != pr_number:
                raise LifecycleError(f"conflicting immutable FINAL PR identity: {target_sha}")
            records[target_sha] = pr_number
        if len(comments) < 100:
            break
    else:
        raise LifecycleError("FINAL comment pagination exceeded safety limit")

    if ctx.merge_sha in records and records[ctx.merge_sha] != ctx.pr_number:
        raise LifecycleError("current FINAL marker belongs to a different PR")
    if ctx.merge_sha not in records:
        newer = [sha for sha in records if positions[sha] < positions[ctx.merge_sha]]
        if newer:
            raise LifecycleError("refusing older target after a newer FINAL: " + ", ".join(newer))
    return records


def cleanup_merged_pr_branches(
    repo: str,
    ctx: Context,
    extra_pr_numbers: list[int],
    *,
    preflight: bool = False,
) -> list[str]:
    cleanup_numbers = list(dict.fromkeys([*extra_pr_numbers, ctx.pr_number]))
    evidence: list[str] = []
    for pr_number in cleanup_numbers:
        pr = gh(f"/repos/{repo}/pulls/{pr_number}")
        if not pr.get("merged"):
            raise LifecycleError(f"cleanup PR #{pr_number} is not merged")
        if pr.get("base", {}).get("ref") != "main":
            raise LifecycleError(f"cleanup PR #{pr_number} base must be main")
        if pr.get("head", {}).get("repo", {}).get("full_name") != repo:
            raise LifecycleError(f"cleanup PR #{pr_number} head repository mismatch")
        refs = re.findall(
            r"(?im)^\s*Refs\s+#\s*([1-9][0-9]*)\s*$",
            pr.get("body") or "",
        )
        if refs != [str(ctx.issue_number)]:
            raise LifecycleError(
                f"cleanup PR #{pr_number} must contain exactly one canonical Refs #{ctx.issue_number}"
            )
        branch = pr.get("head", {}).get("ref") or ""
        if not branch:
            raise LifecycleError(f"cleanup PR #{pr_number} head branch is missing")
        run(
            "python3",
            "scripts/safe_branch_cleanup.py",
            "--repo",
            repo,
            "--pr",
            str(pr_number),
            "--branch",
            branch,
            "--target-sha",
            ctx.merge_sha or "",
            *([] if preflight else ["--delete"]),
        )
        evidence.append(f"#{pr_number} `{branch}`")
    return evidence


def cleanup_temporary_main_candidate(repo: str, ctx: Context, *, preflight: bool = False) -> str:
    if ctx.main_docs_only:
        return "N/A — docs-only main merge has no temporary GHCR candidate"
    if not ctx.merge_sha:
        raise LifecycleError("temporary candidate cleanup requires a merged PR")

    repository = gh(f"/repos/{repo}")
    owner_type = ((repository.get("owner") or {}).get("type") or "").strip()
    if owner_type not in {"User", "Organization"}:
        raise LifecycleError(f"unsupported repository owner type for GHCR cleanup: {owner_type!r}")

    env = os.environ.copy()
    env["GHCR_OWNER_TYPE"] = owner_type
    env["GHCR_PACKAGE_NAME"] = repo.split("/", 1)[1].lower()
    tag = f"ci-{ctx.merge_sha}"
    result = run(
        "node",
        "scripts/delete-ghcr-package-version-by-tag.mjs",
        tag,
        *(["--check-only"] if preflight else []),
        env=env,
    )
    evidence = result.stdout.strip() or f"temporary GHCR candidate {tag} cleanup completed"
    return f"{'READY' if preflight else 'PASS'} — {evidence}"


def finalize(ctx: Context, args: argparse.Namespace) -> None:
    repo = os.environ["GITHUB_REPOSITORY"]
    if not ctx.merge_sha:
        raise LifecycleError("finalize requires a merged PR")

    phase = "FINAL_PREFLIGHT"
    try:
        marker = final_marker(ctx.issue_number, ctx.merge_sha)
        records = audited_final_markers(repo, ctx)
        # Re-entry after FINAL is written must not repeat branch/image cleanup.
        # An earlier valid FINAL for a different SHA remains immutable.
        if ctx.merge_sha in records:
            if not args.defer_close:
                issue = gh(f"/repos/{repo}/issues/{ctx.issue_number}")
                if issue.get("state") != "closed":
                    gh(f"/repos/{repo}/issues/{ctx.issue_number}",
                       method="PATCH", fields={"state": "closed", "state_reason": "completed"})
            print(f"FINAL already recorded for PR #{ctx.pr_number} / {ctx.merge_sha}; idempotent PASS")
            return

        phase = "BRANCH_PREFLIGHT"
        cleanup_merged_pr_branches(repo, ctx, args.cleanup_pr, preflight=True)
        release_required = parse_bool(args.release_required)
        phase = "CANDIDATE_PREFLIGHT"
        if not release_required:
            cleanup_temporary_main_candidate(repo, ctx, preflight=True)

        tag = "N/A"
        release_url = "N/A"
        if release_required:
            phase = "FORMAL_RELEASE"
            tag, release_url = ensure_release(ctx, args)

        phase = "BRANCH_CLEANUP"
        cleanup_evidence = cleanup_merged_pr_branches(repo, ctx, args.cleanup_pr)
        phase = "CANDIDATE_CLEANUP"
        candidate_lifecycle_evidence = (
            "RETAINED — formal release candidate/provenance alias"
            if release_required
            else cleanup_temporary_main_candidate(repo, ctx)
        )
        formal = (
            f"{tag} / {release_url}"
            if release_required
            else "N/A — release_required=false"
        )
        tick = chr(96)
        body = "\n".join(
            [
                marker,
                f"## Lifecycle FINAL · Issue #{ctx.issue_number}",
                "",
                f"- PR: #{ctx.pr_number}",
                f"- PR head branch: {tick}{ctx.head_branch}{tick}",
                f"- PR head SHA: {tick}{ctx.head_sha}{tick}",
                f"- merge/release target SHA: {tick}{ctx.merge_sha}{tick}",
                f"- current main SHA at finalization: {tick}{ctx.current_main_sha}{tick}",
                f"- application version: {tick}{ctx.version}{tick}",
                "- PR required checks: PASS",
                f"- exact main CI: {ctx.main_ci_url}",
                f"- main change docs-only: {str(ctx.main_docs_only).lower()}",
                f"- temporary GHCR validation: {ctx.main_artifact_evidence}",
                f"- temporary GHCR candidate lifecycle: {candidate_lifecycle_evidence}",
                f"- release_required: {str(release_required).lower()}",
                f"- release_authorized: {args.release_authorized}",
                f"- authorization actor: {os.environ.get('GITHUB_ACTOR', 'unknown')}",
                f"- authorization note: {args.authorization_note or 'N/A'}",
                f"- formal release: {formal}",
                "- GHCR exact digest: release-image workflow evidence when formal release is required; otherwise N/A",
                f"- branch cleanup: PASS ({', '.join(cleanup_evidence)})",
                f"- issue close: {'DEFERRED — newer same-Issue merge pending' if args.defer_close else 'eligible after FINAL'}",
                "- environment-specific validation: N/A for CI/GitHub orchestration change",
                "- lifecycle orchestration: generic auto-finalizer; per-Issue helper workflows are not used.",
            ]
        )
        phase = "FINAL_WRITE"
        gh(f"/repos/{repo}/issues/{ctx.issue_number}/comments",
           method="POST", fields={"body": body})

        if not args.defer_close:
            phase = "ISSUE_CLOSE"
            issue = gh(f"/repos/{repo}/issues/{ctx.issue_number}")
            if issue.get("state") != "closed":
                gh(f"/repos/{repo}/issues/{ctx.issue_number}",
                   method="PATCH", fields={"state": "closed", "state_reason": "completed"})
    except LifecycleError as exc:
        raise LifecycleError(
            f"Issue #{ctx.issue_number} PR #{ctx.pr_number} SHA {ctx.merge_sha} "
            f"phase={phase}: {exc}; recovery=retry exact target after resolving blocker; "
            "do not recreate tags or bypass cleanup gates"
        ) from exc

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("verify", "release", "release_start", "finalize", "release_finalize"))
    parser.add_argument("--issue", required=True)
    parser.add_argument("--pr", required=True)
    parser.add_argument("--release-required", default="false")
    parser.add_argument("--release-authorized", default="false")
    parser.add_argument("--expected-version", default="")
    parser.add_argument("--authorization-note", default="")
    parser.add_argument("--defer-close", action="store_true", help="newer same-Issue main merge pending")
    parser.add_argument(
        "--cleanup-pr",
        action="append",
        type=int,
        default=[],
        help="additional merged PR whose branch must be safely cleaned before FINAL/close",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        validate_operation_inputs(args)
        ctx = resolve_context(args)
        if args.operation == "release":
            tag, url = ensure_release(ctx, args)
            print(f"release PASS: {tag} {url}")
        elif args.operation == "release_start":
            tag, url = start_release(ctx, args)
            print(f"release_start PASS: {tag} {url}")
        elif args.operation == "finalize":
            finalize(ctx, args)
            print("finalize PASS")
        elif args.operation == "release_finalize":
            finalize(ctx, args)
            print("release_finalize PASS")
        return 0
    except LifecycleError as exc:
        print(f"Lifecycle error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
