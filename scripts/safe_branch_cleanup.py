#!/usr/bin/env python3
"""Safely delete a merged pull-request branch.

The tool fails closed. It never falls back to an unconditional REST ref delete.
It verifies the current remote branch tip is exactly the merged PR head, that the
head is contained in the supplied target main SHA, that no open PR still uses
the branch, and then performs one SHA-leased Git delete followed by a 404 check.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


SHA_RE = re.compile(r"^[0-9a-f]{40}$")


class CleanupError(RuntimeError):
    pass


@dataclass(frozen=True)
class CleanupSnapshot:
    pr_merged: bool
    pr_base: str
    pr_head_branch: str
    pr_head_repo: str
    pr_head_sha: str
    branch_sha: str
    branch_protected: bool
    target_sha: str
    merge_base_sha: str
    open_head_prs: int
    open_base_prs: int
    current_ref_sha: str


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise CleanupError(reason)


def validate_snapshot(snapshot: CleanupSnapshot, *, repo: str, branch: str) -> None:
    require(snapshot.pr_merged, "pull request is not merged")
    require(snapshot.pr_base == "main", "pull request base is not main")
    require(snapshot.pr_head_branch == branch, "pull request head branch mismatch")
    require(snapshot.pr_head_repo == repo, "pull request head repository mismatch")
    require(SHA_RE.fullmatch(snapshot.pr_head_sha) is not None, "invalid pull request head SHA")
    require(SHA_RE.fullmatch(snapshot.target_sha) is not None, "invalid target SHA")
    require(snapshot.branch_sha == snapshot.pr_head_sha, "branch tip differs from merged PR head")
    require(not snapshot.branch_protected, "refusing to delete a protected branch")
    require(snapshot.merge_base_sha == snapshot.pr_head_sha, "merged PR head is not an ancestor of target SHA")
    require(snapshot.open_head_prs == 0, "another open pull request uses the branch as head")
    require(snapshot.open_base_prs == 0, "another open pull request uses the branch as base")
    require(snapshot.current_ref_sha == snapshot.branch_sha, "remote branch changed before deletion")


class GitHubApi:
    def __init__(self, repo: str, token: str) -> None:
        self.repo = repo
        self.token = token

    def get(self, path: str, *, allowed: tuple[int, ...] = (200,)) -> tuple[int, Any]:
        request = urllib.request.Request(
            f"https://api.github.com/repos/{self.repo}{path}",
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {self.token}",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                status = response.status
                raw = response.read()
        except urllib.error.HTTPError as error:
            status = error.code
            raw = error.read()
        require(status in allowed, f"GitHub API request failed: GET {path} ({status})")
        return status, json.loads(raw) if raw else None


def count_open_prs(api: GitHubApi, key: str, value: str) -> int:
    query = urllib.parse.urlencode({"state": "open", key: value, "per_page": 2})
    _, pulls = api.get(f"/pulls?{query}")
    require(isinstance(pulls, list), "unexpected pull request response")
    return len(pulls)


def validate_pr_identity(pr: Any, *, repo: str, branch: str) -> str:
    require(bool(pr.get("merged")), "pull request is not merged")
    require(pr["base"]["ref"] == "main", "pull request base is not main")
    require(pr["head"]["repo"] is not None, "pull request head repository is unavailable")
    require(pr["head"]["ref"] == branch, "pull request head branch mismatch")
    require(pr["head"]["repo"]["full_name"] == repo, "pull request head repository mismatch")
    head_sha = pr["head"]["sha"]
    require(SHA_RE.fullmatch(head_sha) is not None, "invalid pull request head SHA")
    return head_sha


def fetch_snapshot(api: GitHubApi, *, repo: str, pr_number: int, branch: str, target_sha: str) -> CleanupSnapshot | None:
    _, pr = api.get(f"/pulls/{pr_number}")
    head_sha = validate_pr_identity(pr, repo=repo, branch=branch)

    encoded_branch = urllib.parse.quote(branch, safe="")
    status, branch_json = api.get(f"/branches/{encoded_branch}", allowed=(200, 404))
    if status == 404:
        return None

    _, comparison = api.get(f"/compare/{head_sha}...{target_sha}")
    _, current_ref = api.get(f"/git/ref/heads/{encoded_branch}")

    return CleanupSnapshot(
        pr_merged=bool(pr.get("merged")),
        pr_base=pr["base"]["ref"],
        pr_head_branch=pr["head"]["ref"],
        pr_head_repo=pr["head"]["repo"]["full_name"],
        pr_head_sha=head_sha,
        branch_sha=branch_json["commit"]["sha"],
        branch_protected=bool(branch_json["protected"]),
        target_sha=target_sha,
        merge_base_sha=comparison["merge_base_commit"]["sha"],
        open_head_prs=count_open_prs(api, "head", f"{repo.split('/', 1)[0]}:{branch}"),
        open_base_prs=count_open_prs(api, "base", branch),
        current_ref_sha=current_ref["object"]["sha"],
    )


def delete_with_sha_lease(*, repo: str, branch: str, head_sha: str, token: str) -> None:
    ref = f"refs/heads/{branch}"
    environment = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    authorization = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    environment.update(
        {
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": "http.https://github.com/.extraheader",
            "GIT_CONFIG_VALUE_0": "AUTHORIZATION: basic " + authorization,
        }
    )

    with tempfile.TemporaryDirectory(prefix="safe-branch-cleanup-") as directory:
        initialized = subprocess.run(
            ["git", "init", "--bare", "--object-format=sha1", "--template=", directory],
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
        )
        require(initialized.returncode == 0, "failed to initialize isolated Git repository")

        deleted = subprocess.run(
            [
                "git",
                "-C",
                directory,
                "push",
                "--porcelain",
                f"--force-with-lease={ref}:{head_sha}",
                f"https://github.com/{repo}.git",
                f":{ref}",
            ],
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        require(
            deleted.returncode == 0,
            "SHA-leased branch deletion failed; branch may have changed or deletion may be protected",
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="owner/repository")
    parser.add_argument("--pr", required=True, type=int, help="merged pull request number")
    parser.add_argument("--branch", required=True, help="working branch to delete")
    parser.add_argument("--target-sha", required=True, help="validated main/merge SHA containing the PR head")
    parser.add_argument("--delete", action="store_true", help="perform deletion; default validates only")
    args = parser.parse_args()

    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    require(bool(token), "GH_TOKEN or GITHUB_TOKEN is required")
    require(SHA_RE.fullmatch(args.target_sha) is not None, "target SHA must be a full 40-character SHA")

    api = GitHubApi(args.repo, token)
    snapshot = fetch_snapshot(
        api,
        repo=args.repo,
        pr_number=args.pr,
        branch=args.branch,
        target_sha=args.target_sha,
    )
    if snapshot is None:
        print(f"Branch already absent: {args.branch}")
        return 0

    validate_snapshot(snapshot, repo=args.repo, branch=args.branch)
    print(f"Validated cleanup target: {args.branch} @ {snapshot.branch_sha}")

    if not args.delete:
        print("Validation only; pass --delete to remove the branch.")
        return 0

    # Re-read the ref immediately before the leased delete.
    encoded_branch = urllib.parse.quote(args.branch, safe="")
    _, current_ref = api.get(f"/git/ref/heads/{encoded_branch}")
    require(current_ref["object"]["sha"] == snapshot.branch_sha, "remote branch changed immediately before deletion")

    delete_with_sha_lease(
        repo=args.repo,
        branch=args.branch,
        head_sha=snapshot.branch_sha,
        token=token,
    )
    api.get(f"/git/ref/heads/{encoded_branch}", allowed=(404,))
    print(f"Deleted branch and verified absence: {args.branch}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except CleanupError as error:
        raise SystemExit(f"safe branch cleanup refused: {error}") from error
