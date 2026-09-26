#!/usr/bin/env python3
"""Safely delete a merged stacked pull-request branch.

This is the stacked-PR counterpart to safe_branch_cleanup.py. It proves that:
1. the feature PR is merged into a carrier PR branch,
2. the feature head is contained in the carrier PR head,
3. the carrier PR is merged to main and its merge commit is contained in target main,
4. the remote feature branch still points at the exact merged feature head,
5. no open PR uses the feature branch as head or base.

Deletion uses the same SHA-leased Git push as the main-base helper.
"""

from __future__ import annotations

import argparse
import urllib.parse

from safe_branch_cleanup import (
    CleanupError,
    GitHubApi,
    SHA_RE,
    count_open_prs,
    delete_with_sha_lease,
    require,
)


def compare_contains(api: GitHubApi, ancestor: str, descendant: str) -> None:
    _, comparison = api.get(f"/compare/{ancestor}...{descendant}")
    require(
        comparison["merge_base_commit"]["sha"] == ancestor,
        f"{ancestor} is not an ancestor of {descendant}",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="owner/repository")
    parser.add_argument("--pr", required=True, type=int, help="merged stacked feature PR number")
    parser.add_argument("--branch", required=True, help="stacked feature branch to delete")
    parser.add_argument("--carrier-pr", required=True, type=int, help="PR that carried the stacked feature to main")
    parser.add_argument("--target-sha", required=True, help="validated main SHA containing the carrier merge")
    parser.add_argument("--delete", action="store_true", help="perform deletion; default validates only")
    args = parser.parse_args()

    import os

    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    require(bool(token), "GH_TOKEN or GITHUB_TOKEN is required")
    require(SHA_RE.fullmatch(args.target_sha) is not None, "target SHA must be a full 40-character SHA")

    api = GitHubApi(args.repo, token)

    _, feature_pr = api.get(f"/pulls/{args.pr}")
    require(bool(feature_pr.get("merged")), "stacked feature pull request is not merged")
    require(feature_pr["head"]["repo"] is not None, "feature head repository is unavailable")
    require(feature_pr["head"]["repo"]["full_name"] == args.repo, "feature head repository mismatch")
    require(feature_pr["head"]["ref"] == args.branch, "feature branch mismatch")
    feature_head = feature_pr["head"]["sha"]
    require(SHA_RE.fullmatch(feature_head) is not None, "invalid feature head SHA")

    _, carrier_pr = api.get(f"/pulls/{args.carrier_pr}")
    require(bool(carrier_pr.get("merged")), "carrier pull request is not merged")
    require(carrier_pr["base"]["ref"] == "main", "carrier pull request base is not main")
    require(carrier_pr["head"]["repo"] is not None, "carrier head repository is unavailable")
    require(carrier_pr["head"]["repo"]["full_name"] == args.repo, "carrier head repository mismatch")
    require(feature_pr["base"]["ref"] == carrier_pr["head"]["ref"], "feature PR base is not the carrier branch")

    carrier_head = carrier_pr["head"]["sha"]
    carrier_merge = carrier_pr.get("merge_commit_sha")
    require(SHA_RE.fullmatch(carrier_head) is not None, "invalid carrier head SHA")
    require(isinstance(carrier_merge, str) and SHA_RE.fullmatch(carrier_merge) is not None, "invalid carrier merge SHA")

    compare_contains(api, feature_head, carrier_head)
    compare_contains(api, carrier_merge, args.target_sha)

    encoded_branch = urllib.parse.quote(args.branch, safe="")
    status, branch_json = api.get(f"/branches/{encoded_branch}", allowed=(200, 404))
    if status == 404:
        print(f"Branch already absent after validated stacked integration: {args.branch}")
        return 0

    require(branch_json["commit"]["sha"] == feature_head, "branch tip differs from merged stacked PR head")
    require(not bool(branch_json["protected"]), "refusing to delete a protected branch")
    require(
        count_open_prs(api, "head", f"{args.repo.split('/', 1)[0]}:{args.branch}") == 0,
        "another open pull request uses the branch as head",
    )
    require(count_open_prs(api, "base", args.branch) == 0, "another open pull request uses the branch as base")

    _, current_ref = api.get(f"/git/ref/heads/{encoded_branch}")
    require(current_ref["object"]["sha"] == feature_head, "remote branch changed before deletion")

    print(
        f"Validated stacked cleanup target: {args.branch} @ {feature_head}; "
        f"carrier PR #{args.carrier_pr} merge {carrier_merge} is contained in {args.target_sha}"
    )

    if not args.delete:
        print("Validation only; pass --delete to remove the branch.")
        return 0

    # Re-read immediately before SHA-leased deletion.
    _, current_ref = api.get(f"/git/ref/heads/{encoded_branch}")
    require(current_ref["object"]["sha"] == feature_head, "remote branch changed immediately before deletion")

    delete_with_sha_lease(
        repo=args.repo,
        branch=args.branch,
        head_sha=feature_head,
        token=token,
    )
    api.get(f"/git/ref/heads/{encoded_branch}", allowed=(404,))
    print(f"Deleted stacked branch and verified absence: {args.branch}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except CleanupError as error:
        raise SystemExit(f"safe stacked branch cleanup refused: {error}") from error
