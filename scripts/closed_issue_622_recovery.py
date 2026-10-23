#!/usr/bin/env python3
"""Issue #622: bounded, Owner-authorized completion repair for closed historical work.

Runs ONLY in trusted default-main issue_comment workflow after its own PR/Main CI.
Never creates/moves a version tag, changes release authority, or rewrites a FINAL.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from types import SimpleNamespace

import auto_release_finalizer as auto
import issue_lifecycle as lc

ISSUE = 622
VERSION = "0.114.0"
ORIGINAL = ("684", "bd54205741da65a0211cf77f9cb086d3cdb1ab2a")
CORRECTION = ("686", "1449190af8d4f97d4737d17ae67e9dcb044549a7")
PREVIOUS_FIX = ("691", "c1dbf61be427934569593796dd7892d0e4ddc2bf")
# Exact verified post-#691 main merge (#548 / PR #694): no additional unreviewed source is permitted.
ALIGNED_MAIN = "29c86ca918baa1811bc12a3eb60f86ffc5406b40"
PREVIOUS = (ORIGINAL, CORRECTION, PREVIOUS_FIX)
MARKER = re.compile(r"<!--\s*mastergantt-closed-622-recovery:v1\s+({.*?})\s*-->",
                    re.DOTALL)


class Blocked(RuntimeError):
    pass


def require(ok: bool, reason: str) -> None:
    if not ok:
        raise Blocked(reason)


def parsed_marker(body: str) -> dict | None:
    matches = MARKER.findall(body or "")
    if not matches:
        return None
    require(len(matches) == 1, "exactly one scoped Owner recovery marker required")
    try:
        data = json.loads(matches[0])
    except (json.JSONDecodeError, TypeError) as error:
        raise Blocked("invalid JSON recovery marker") from error
    require(isinstance(data, dict) and set(data) == {
        "authorized", "issue", "pr", "main_sha", "release_sha", "version", "note"
    }, "unexpected recovery marker fields")
    require(type(data["authorized"]) is bool and type(data["issue"]) is int
            and type(data["pr"]) is int, "typed Owner recovery scope required")
    require(data["issue"] == ISSUE and data["release_sha"] == CORRECTION[1]
            and data["version"] == VERSION
            and re.fullmatch(r"[0-9a-f]{40}", str(data["main_sha"])) is not None
            and isinstance(data["note"], str) and len(data["note"].strip()) >= 40,
            "Owner marker has an incorrect version, SHA, or explanation")
    return data


def authorized_comment(comments: list[dict], comment_id: int,
                       *, main_sha: str, pr_number: int) -> dict:
    """Latest trusted scoped decision must be this exact GitHub comment."""
    trusted = []
    for comment in comments:
        # Untrusted Issue comments are data, not authority: malformed marker
        # text from a non-Owner must never block a valid Owner decision.
        if (comment.get("author_association") != "OWNER"
                or (comment.get("user") or {}).get("login") != "planner77"):
            continue
        marker = parsed_marker(comment.get("body", ""))
        if marker is not None:
            trusted.append((int(comment["id"]), marker))
    require(bool(trusted), "no authenticated Owner recovery decision")
    latest_id, marker = max(trusted)
    require(latest_id == comment_id, "Owner recovery decision is stale/not latest")
    require(marker["authorized"] and marker["main_sha"] == main_sha
            and marker["pr"] == pr_number, "Owner did not authorize exact Main/PR")
    return marker


def verify_history(first_parent_newest: list[str], *, target: str,
                   prior: tuple[tuple[str, str], ...] = PREVIOUS) -> None:
    """Immutable exact chain with older originals and no later same-Issue merge."""
    require(first_parent_newest and first_parent_newest[0] == target,
            "recovery target must be the latest first-parent Main SHA")
    require(first_parent_newest[1:3] == [ALIGNED_MAIN, PREVIOUS_FIX[1]],
            "recovery main must immediately follow approved #548 merge, then #691")
    require(len(first_parent_newest) == len(set(first_parent_newest)),
            "duplicate first-parent SHA")
    indices = []
    for _, sha in prior:
        require(first_parent_newest.count(sha) == 1,
                "one of three immutable source merges is absent")
        indices.append(first_parent_newest.index(sha))
    require(indices[0] > indices[1] > indices[2] > 0,
            "incorrect original/correction/recovery merge ordering")


def verify_pr(repo: str, pr_number: int, sha: str) -> dict:
    data = lc.gh(f"/repos/{repo}/pulls/{pr_number}")
    require(isinstance(data, dict) and data.get("merged") is True
            and data.get("merge_commit_sha") == sha
            and (data.get("base") or {}).get("ref") == "main"
            and ((data.get("head") or {}).get("repo") or {}).get("full_name") == repo
            and auto.REF_RE.findall(data.get("body") or "") == [str(ISSUE)],
            f"PR #{pr_number} identity/provenance mismatch")
    require(re.fullmatch(r"[0-9a-f]{40}", (data.get("head") or {}).get("sha") or "") is not None
            and bool((data.get("head") or {}).get("ref")),
            f"PR #{pr_number} head identity missing")
    return data


def release_gate(repo: str) -> str:
    """Require the original corrected release evidence, not its failed ancestor."""
    authorization = auto.select_authorization(auto.issue_comments(repo, ISSUE),
                                              expected_version=VERSION)
    require(authorization is not None and authorization.authorized,
            "0.114.0 authenticated Owner publication approval missing")
    release_item = auto.WorkItem(CORRECTION[1], ORIGINAL[1],
                                  int(CORRECTION[0]), ISSUE, "0.113.0", VERSION)
    status, url = auto.exact_release_state(repo, release_item)
    require(status == "success" and bool(url),
            "exact immutable corrective Release-image SUCCESS missing")
    ci_ok, _, candidate_ok, _ = lc.exact_main_ci(repo, CORRECTION[1],
                                                docs_only=False)
    require(ci_ok and candidate_ok,
            "corrective exact Main CI+verified image evidence missing")
    return url


def audit(repo: str, comment_id: int):
    """Read-only authorization/evidence before ANY branch or GHCR mutation."""
    require(repo == "planner77/masterGantt", "repository not authorized")
    main = auto.current_main_sha(repo)
    require(lc.run("git", "rev-parse", "HEAD").stdout.strip() == main,
            "trusted checkout differs from current main")
    lc.run("git", "fetch", "--no-tags", "origin", "main")
    first_parent = lc.run("git", "rev-list", "--first-parent", "origin/main").stdout.splitlines()
    verify_history(first_parent, target=main)

    target_data = lc.gh(f"/repos/{repo}/commits/{main}")
    # Exact post-#691 #548/PR #694 main snapshot is an authenticated
    # intervening non-#622 merge. Any later main change requires a fresh
    # review/PR alignment; never assume an arbitrary intervening SHA is safe.
    require(len(target_data.get("parents") or []) == 2
            and (target_data["parents"][0]["sha"] == ALIGNED_MAIN),
            "recovery PR must follow exact approved #548-aligned main")
    # Commit-to-PR index can legitimately be empty for a verified merge.
    # Exact owner marker selects one PR, independently checked against both
    # merge parents and the authenticated GitHub PR record.
    comments = auto.issue_comments(repo, ISSUE)
    selected = [c for c in comments if int(c.get("id") or 0) == comment_id]
    require(len(selected) == 1, "Owner trigger comment was not found")
    chosen = parsed_marker(selected[0].get("body") or "")
    require(chosen is not None and chosen["pr"] > 691,
            "explicit exact recovery PR number required")
    pr_number = chosen["pr"]
    marker = authorized_comment(comments, comment_id,
                                main_sha=main, pr_number=pr_number)
    head_pr = verify_pr(repo, pr_number, main)
    require(target_data["parents"][1]["sha"] == head_pr["head"]["sha"],
            "recovery merge second parent does not match Owner-scoped PR head")
    issue = lc.gh(f"/repos/{repo}/issues/{ISSUE}")
    require(issue.get("state") == "closed", "only an already CLOSED Issue may be repaired")
    for n, sha in (*PREVIOUS, (str(pr_number), main)):
        verify_pr(repo, int(n), sha)

    # Later authenticated completion markers must be preserved and untouched.
    for issue_num, pr_num, sha in (
        (665, 688, "417dd41e4838f72c3f7c547463591aa10809d25b"),
        (666, 690, "40f5f92ee296b2d9f6995bdca96712552537698f"),
    ):
        proof = SimpleNamespace(issue_number=issue_num, pr_number=pr_num, merge_sha=sha)
        require(lc.audited_final_markers(repo, proof).get(sha) == pr_num,
                f"later Issue #{issue_num} audited FINAL missing")
    own_proof = SimpleNamespace(issue_number=ISSUE, pr_number=pr_number, merge_sha=main)
    existing = lc.audited_final_markers(repo, own_proof)
    require(not existing or existing == {main: pr_number},
            "other immutable #622 FINAL conflicts with recovery")
    release_url = release_gate(repo)

    args = argparse.Namespace(operation="finalize", issue=str(ISSUE), pr=str(pr_number),
                              release_required="false", release_authorized="false",
                              expected_version="", authorization_note="",
                              resolver_ordered=True, resolver_main_sha=main,
                              cleanup_pr=[684, 686, 691], defer_close=False)
    lc.validate_operation_inputs(args)
    ctx = lc.resolve_context(args)
    require(ctx.merged and ctx.merge_sha == main and ctx.version == VERSION
            and ctx.pr_checks_ok and ctx.main_ci_ok and ctx.main_artifact_ok
            and not ctx.main_docs_only and ctx.issue_state == "closed",
            "recovery PR exact CI/PR/GHCR Main evidence not complete")
    # Test every branch and every temporary GHCR candidate BEFORE mutation.
    if not existing:
        lc.cleanup_merged_pr_branches(repo, ctx, args.cleanup_pr, preflight=True)
        lc.cleanup_temporary_main_candidate(repo, ctx, preflight=True)
        prev_ctx = lc.resolve_context(argparse.Namespace(
            **{**vars(args), "pr": "691", "resolver_ordered": False,
               "resolver_main_sha": "", "cleanup_pr": []}
        ))
        require(prev_ctx.main_ci_ok and prev_ctx.main_artifact_ok,
                "PR #691 candidate was not verified by original Main CI")
        lc.cleanup_temporary_main_candidate(repo, prev_ctx, preflight=True)
    return ctx, args, release_url, marker, existing


def execute(repo: str, comment_id: int) -> None:
    ctx, args, url, _, existing = audit(repo, comment_id)
    print(f"Read-only #622 recovery audit PASS, v0.114.0 source {CORRECTION[1]}: {url}")
    if existing:
        # Authenticated exact bot FINAL and CLOSED were checked by audit().
        # Re-entry after a completed FINAL is a read-only idempotent PASS:
        # do NOT enter close_resume with obsolete cleanup PR arguments.
        print(f"Issue #622 FINAL already authenticated: {ctx.merge_sha}; no mutation")
        return
    if not existing:
        # Prior non-release fix candidate can be safely deleted only with exact
        # tag ownership checks; immutable v0.114.0 formal source is NOT deleted.
        prev_ctx = lc.resolve_context(argparse.Namespace(
            **{**vars(args), "pr": "691", "resolver_ordered": False,
               "resolver_main_sha": "", "cleanup_pr": []}
        ))
        lc.cleanup_temporary_main_candidate(repo, prev_ctx)
    lc.finalize(ctx, args)
    proof = SimpleNamespace(issue_number=ISSUE, pr_number=ctx.pr_number, merge_sha=ctx.merge_sha)
    require(lc.audited_final_markers(repo, proof).get(ctx.merge_sha) == ctx.pr_number,
            "GitHub bot FINAL not authenticated after recovery")
    require(lc.gh(f"/repos/{repo}/issues/{ISSUE}").get("state") == "closed",
            "Issue #622 must remain closed")
    print(f"Historical #622 FINAL recovered: PR #{ctx.pr_number} / {ctx.merge_sha}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--comment-id", type=int, required=True)
    args = p.parse_args()
    require(args.comment_id > 0 and os.getenv("GITHUB_REPOSITORY") == "planner77/masterGantt"
            and os.getenv("GITHUB_ACTOR") == "planner77",
            "scoped Owner event and repository required")
    execute("planner77/masterGantt", args.comment_id)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (Blocked, auto.AutoFinalizerError, lc.LifecycleError) as error:
        raise SystemExit(f"BLOCKED (no bypass): {error}") from error
