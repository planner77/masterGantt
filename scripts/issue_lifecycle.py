#!/usr/bin/env python3
"""Fail-closed Issue lifecycle orchestration for GitHub Actions.

The workflow remains generic: Issue/PR identity is input, while branch, SHA,
version, CI and release evidence are resolved from GitHub and repository state.
"""

from __future__ import annotations

import argparse
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
FINAL_MARKER_PREFIX = "<!-- issue-lifecycle-final:"


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
    merged: bool


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, text=True, capture_output=True)
    if check and result.returncode != 0:
        raise LifecycleError(
            f"command failed ({result.returncode}): {' '.join(args)}\n{result.stderr.strip()}"
        )
    return result


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


def mutation_gate(
    *,
    merged: bool,
    checks_ok: bool,
    main_ci_ok: bool,
    release_required: bool,
    release_authorized: bool,
    version_ok: bool,
) -> str:
    if not version_ok:
        return "FAIL"
    if not merged:
        return "BLOCKED"
    if not checks_ok or not main_ci_ok:
        return "NOT TESTED"
    if release_required and not release_authorized:
        return "BLOCKED"
    return "PASS"


def git_show_json(sha: str, path: str) -> Any:
    text = run("git", "show", f"{sha}:{path}").stdout
    return json.loads(text)


def exact_main_ci(repo: str, sha: str) -> tuple[bool, str | None]:
    data = gh(
        f"/repos/{repo}/actions/workflows/ci.yml/runs?event=push&branch=main&per_page=100"
    )
    runs = [r for r in data.get("workflow_runs", []) if r.get("head_sha") == sha]
    if not runs:
        return False, None
    run_data = sorted(runs, key=lambda r: r.get("created_at", ""))[-1]
    ok = run_data.get("status") == "completed" and run_data.get("conclusion") == "success"
    return ok, run_data.get("html_url")


def required_checks_ok(repo: str, sha: str) -> tuple[bool, list[str]]:
    data = gh(f"/repos/{repo}/commits/{sha}/check-runs?per_page=100")
    found: dict[str, bool] = {}
    for item in data.get("check_runs", []):
        name = item.get("name")
        if name not in REQUIRED_CHECKS:
            continue
        app = item.get("app") or {}
        from_actions = app.get("slug") == "github-actions"
        found[name] = (
            from_actions
            and item.get("status") == "completed"
            and item.get("conclusion") == "success"
        )
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

    # workflow_dispatch may run from main while verifying another same-repository
    # PR. Fetch both authoritative refs so git-show/ancestry never depends on
    # incidental checkout reachability.
    run("git", "fetch", "--no-tags", "origin", "main")
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
    main_ci_ok, main_ci_url = (False, None)
    if merged and merge_sha:
        main_ci_ok, main_ci_url = exact_main_ci(repo, merge_sha)

    current_main = gh(f"/repos/{repo}/git/ref/heads/main")
    current_main_sha = current_main.get("object", {}).get("sha", "")

    gate = mutation_gate(
        merged=merged,
        checks_ok=checks_ok,
        main_ci_ok=main_ci_ok,
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
        f"- release_required: {str(release_required).lower()}",
        f"- release_authorized: {str(release_authorized).lower()}",
        f"- gate: {gate}",
    ]
    print("\n".join(summary))
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as fp:
            fp.write("\n".join(summary) + "\n")

    if args.operation in {"release", "finalize"} and gate != "PASS":
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


def ensure_release(ctx: Context, args: argparse.Namespace) -> tuple[str, str]:
    repo = os.environ["GITHUB_REPOSITORY"]
    if not parse_bool(args.release_required):
        raise LifecycleError("release operation requires release_required=true")
    if not parse_bool(args.release_authorized):
        raise LifecycleError("formal release requires release_authorized=true")
    if not ctx.merge_sha:
        raise LifecycleError("formal release requires a merged PR")

    tag = f"v{ctx.version}"
    remote = run("git", "ls-remote", "--exit-code", "--tags", "origin", f"refs/tags/{tag}", check=False)
    if remote.returncode == 0:
        run("git", "fetch", "--force", "origin", f"refs/tags/{tag}:refs/tags/{tag}")
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
    run("git", "push", "origin", f"refs/tags/{tag}")

    gh(
        f"/repos/{repo}/actions/workflows/release-image.yml/dispatches",
        method="POST",
        fields={"ref": tag},
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


def finalize(ctx: Context, args: argparse.Namespace) -> None:
    repo = os.environ["GITHUB_REPOSITORY"]
    if not ctx.merge_sha:
        raise LifecycleError("finalize requires a merged PR")

    release_required = parse_bool(args.release_required)
    tag = "N/A"
    release_url = "N/A"
    if release_required:
        tag, release_url = ensure_release(ctx, args)

    run(
        "python3",
        "scripts/safe_branch_cleanup.py",
        "--repo",
        repo,
        "--pr",
        str(ctx.pr_number),
        "--branch",
        ctx.head_branch,
        "--target-sha",
        ctx.merge_sha,
        "--delete",
    )

    marker = final_marker(ctx.issue_number, ctx.merge_sha)
    comments = gh(f"/repos/{repo}/issues/{ctx.issue_number}/comments?per_page=100")
    lifecycle_markers = [
        line.strip()
        for item in comments
        for line in (item.get("body") or "").splitlines()
        if line.strip().startswith(FINAL_MARKER_PREFIX)
    ]
    if any(m != marker for m in lifecycle_markers):
        raise LifecycleError("different lifecycle FINAL marker already exists; refusing close")
    if marker not in lifecycle_markers:
        formal = (
            f"{tag} / {release_url}"
            if release_required
            else "N/A — release_required=false"
        )
        body = "\n".join(
            [
                marker,
                f"## Lifecycle FINAL · Issue #{ctx.issue_number}",
                "",
                f"- PR: #{ctx.pr_number}",
                f"- PR head branch: `{ctx.head_branch}`",
                f"- PR head SHA: `{ctx.head_sha}`",
                f"- merge/release target SHA: `{ctx.merge_sha}`",
                f"- current main SHA at finalization: `{ctx.current_main_sha}`",
                f"- application version: `{ctx.version}`",
                "- PR required checks: PASS",
                f"- exact main CI: {ctx.main_ci_url}",
                "- temporary GHCR validation/cleanup: PASS via exact successful main CI",
                f"- release_required: {str(release_required).lower()}",
                f"- release_authorized: {args.release_authorized}",
                f"- authorization actor: {os.environ.get('GITHUB_ACTOR', 'unknown')}",
                f"- authorization note: {args.authorization_note or 'N/A'}",
                f"- formal release: {formal}",
                "- GHCR exact digest: release-image workflow evidence when formal release is required; otherwise N/A",
                "- branch cleanup: PASS",
                "- environment-specific validation: N/A for CI/GitHub orchestration change",
                "- remaining risks: existing per-Issue helpers remain until migration verification is complete",
            ]
        )
        gh(
            f"/repos/{repo}/issues/{ctx.issue_number}/comments",
            method="POST",
            fields={"body": body},
        )

    issue = gh(f"/repos/{repo}/issues/{ctx.issue_number}")
    if issue.get("state") != "closed":
        gh(
            f"/repos/{repo}/issues/{ctx.issue_number}",
            method="PATCH",
            fields={"state": "closed", "state_reason": "completed"},
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("verify", "release", "finalize"))
    parser.add_argument("--issue", required=True)
    parser.add_argument("--pr", required=True)
    parser.add_argument("--release-required", default="false")
    parser.add_argument("--release-authorized", default="false")
    parser.add_argument("--expected-version", default="")
    parser.add_argument("--authorization-note", default="")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        ctx = resolve_context(args)
        if args.operation == "release":
            tag, url = ensure_release(ctx, args)
            print(f"release PASS: {tag} {url}")
        elif args.operation == "finalize":
            finalize(ctx, args)
            print("finalize PASS")
        return 0
    except LifecycleError as exc:
        print(f"Lifecycle error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
