#!/usr/bin/env python3
"""Issue #765: exact, Owner-authorized retirement of unissued v0.127/0.128.

Never converts a historical Main CI failure/cancellation into SUCCESS. This
exception is pinned to one first-parent chain and an already published,
verified v0.129.0 release. It does not broaden generic CI supersession.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import issue_lifecycle as lifecycle
import release_debt_audit as registry

REPO = "planner77/masterGantt"
OWNER = "planner77"
ISSUE = 765
RELEASE_ISSUE = 734
RELEASE_PR = 759
RELEASE_SHA = "e20e4a72e59b46bde34c7ae5befd5e0f46ed335b"
RELEASE_VERSION = "0.129.0"
RELEASE_RUN_ID = 39543231934
RELEASE_DIGEST = "sha256:37c9d83696fbfb3b2a6c5ec365f3bc509ee7ebbb80f5249eea9b82d26c6d7032"
# SHA, Issue, PR, previous version, resulting version, original Main Run,
# conclusion. Chronology must match the actual uninterrupted first-parent path.
SOURCES = (
    ("5ffe02a334d2279fabb63943c90614a7acfaf6ad", 732, 761,
     "0.126.0", "0.127.0", 39492209464, "cancelled"),
    ("1c1938851aa8234febcba404f4007d6c94fb2233", 736, 760,
     "0.127.0", "0.128.0", 39499988360, "failure"),
    ("62e715adbc3f497e319918306bf26cbdd73353b7", 732, 763,
     "0.128.0", "0.128.0", 39515784575, "cancelled"),
)
OWNER_RE = re.compile(
    r"<!--\s*mastergantt-release-debt-765-authorization:v1\s+({.*?})\s*-->",
    re.S,
)
RETIRED_RE = re.compile(
    r"<!--\s*mastergantt-release-debt-retired:v1\s+({.*?})\s*-->",
    re.S,
)
SHA_RE = re.compile(r"[0-9a-f]{40}\Z")
FIELDS = frozenset((
    "authorized", "mode", "recovery_issue", "recovery_pr", "recovery_sha",
    "source_732_sha", "source_736_sha", "correction_732_sha",
    "release_sha", "release_run_id", "release_digest",
    "expected_version", "note",
))


@dataclass(frozen=True)
class Plan:
    main_sha: str
    recovery_sha: str
    recovery_pr: int
    owner_url: str
    old_items: tuple[Any, ...]
    release_item: Any
    recovery_item: Any

    @property
    def retired_shas(self) -> frozenset[str]:
        return frozenset(row[0] for row in SOURCES)


def require(core: Any, condition: bool, reason: str) -> None:
    if not condition:
        raise core.AutoFinalizerBlocked("Issue #765 fail-closed: " + reason)


def owner_comments(core: Any, repo: str, issue: int) -> list[dict[str, Any]]:
    return [
        row for row in core.issue_comments(repo, issue)
        if row.get("author_association") == "OWNER"
        and (row.get("user") or {}).get("login") == OWNER
    ]


def approval(core: Any, repo: str) -> dict[str, Any] | None:
    found: list[tuple[int, dict[str, Any], str]] = []
    for comment in owner_comments(core, repo, ISSUE):
        matches = OWNER_RE.findall(comment.get("body") or "")
        require(core, len(matches) <= 1, "duplicate Owner marker in one comment")
        if not matches:
            continue
        try:
            data = json.loads(matches[0])
        except (TypeError, ValueError) as exc:
            raise core.AutoFinalizerBlocked("Issue #765 malformed Owner JSON") from exc
        require(core, isinstance(data, dict) and set(data) == FIELDS, "Owner schema mismatch")
        require(core, type(data["authorized"]) is bool, "Owner authorized must be boolean")
        require(core, data["mode"] == "RETIRE_732_736_TO_734", "unexpected recovery mode")
        require(core, data["recovery_issue"] == ISSUE and
                type(data["recovery_pr"]) is int and data["recovery_pr"] > 0,
                "exact recovery Issue/PR required")
        for field in ("recovery_sha", "source_732_sha", "source_736_sha",
                      "correction_732_sha", "release_sha"):
            require(core, isinstance(data[field], str) and
                    SHA_RE.fullmatch(data[field]) is not None, field + " invalid SHA")
        require(core, (
            data["source_732_sha"], data["source_736_sha"],
            data["correction_732_sha"]
        ) == tuple(row[0] for row in SOURCES), "historical SHA identities differ")
        require(core, data["release_sha"] == RELEASE_SHA and
                type(data["release_run_id"]) is int and
                data["release_run_id"] == RELEASE_RUN_ID and
                data["release_digest"] == RELEASE_DIGEST and
                data["expected_version"] == RELEASE_VERSION,
                "immutable release authority mismatch")
        require(core, isinstance(data["note"], str) and
                len(data["note"].strip()) >= 20, "nonempty bounded Owner rationale required")
        comment_id = comment.get("id")
        require(core, type(comment_id) is int and comment_id > 0,
                "Owner comment id missing")
        url = str(comment.get("html_url") or comment.get("url") or "")
        require(core, url.startswith(
            "https://github.com/planner77/masterGantt/issues/765#issuecomment-"
        ), "Owner comment source URL invalid")
        found.append((comment_id, data, url))
    if not found:
        return None
    _, latest, url = max(found, key=lambda item: item[0])
    require(core, latest["authorized"], "newest Owner marker revoked")
    return {**latest, "evidence_url": url}


def revoked_versions(core: Any, repo: str) -> None:
    """A previous publication approval cannot authorize unissued retirement."""
    for issue, version in ((732, "0.127.0"), (736, "0.128.0")):
        relevant: list[tuple[int, dict[str, Any]]] = []
        for row in owner_comments(core, repo, issue):
            data = core.parse_authorization_marker(row.get("body") or "")
            if data and data["expected_version"] == version:
                relevant.append((int(row["id"]), data))
        require(core, bool(relevant), f"Issue #{issue} revocation absent")
        require(core, max(relevant, key=lambda row: row[0])[1]["authorized"] is False,
                f"Issue #{issue} still authorizes v{version}")


def retirement_body(plan: Plan, issue: int) -> tuple[dict[str, Any], str]:
    source = [row for row in SOURCES if row[1] == issue]
    data = {
        "issue": issue,
        "original_shas": [row[0] for row in source],
        "original_prs": [row[2] for row in source],
        "unissued_version": "0.127.0" if issue == 732 else "0.128.0",
        "replacement_sha": RELEASE_SHA,
        "replacement_version": RELEASE_VERSION,
        "replacement_digest": RELEASE_DIGEST,
        "decision_url": plan.owner_url,
    }
    marker = "<!-- mastergantt-release-debt-retired:v1 " + json.dumps(
        data, sort_keys=True, separators=(",", ":")
    ) + " -->"
    return data, marker


def authenticated_retirement(core: Any, repo: str, plan: Plan, issue: int) -> bool:
    expected, _ = retirement_body(plan, issue)
    found = []
    for row in core.issue_comments(repo, issue):
        matches = RETIRED_RE.findall(row.get("body") or "")
        require(core, len(matches) <= 1, "duplicate RETIRED marker in one comment")
        for match in matches:
            require(core, (row.get("user") or {}).get("login") == "github-actions[bot]",
                    "RETIRED provenance must be github-actions[bot]")
            try:
                data = json.loads(match)
            except (ValueError, TypeError) as exc:
                raise core.AutoFinalizerBlocked("Issue #765 damaged RETIRED JSON") from exc
            require(core, data == expected, "conflicting RETIRED source/target/owner")
            found.append(row)
    require(core, len(found) <= 1, "multiple RETIRED records are not idempotent")
    return bool(found)


def exact_history(core: Any, repo: str, main_sha: str,
                  owner: dict[str, Any]) -> tuple[tuple[Any, ...], Any, Any]:
    lines = core.run("git", "rev-list", "--first-parent", main_sha).stdout.splitlines()
    anchor = SOURCES[0][0]
    require(core, bool(lines) and lines[0] == main_sha and anchor in lines,
            "trusted main first-parent source missing")
    depth = lines.index(anchor)
    require(core, depth == 4, "unexpected intervening Merge or later main commit")
    ordered_shas = list(reversed(lines[:depth + 1]))
    require(core, ordered_shas == [
        *(row[0] for row in SOURCES), RELEASE_SHA, main_sha
    ], "first-parent identity/order mismatch")
    items = []
    for sha in ordered_shas:
        item = core.resolve_work_item(repo, sha)
        require(core, item is not None and item.target_sha == sha,
                "exact merged PR/Issue identity missing: " + sha)
        if items:
            require(core, item.first_parent_sha == items[-1].target_sha,
                    "first-parent edge altered")
        items.append(item)
    for item, (sha, issue, pr, previous, version, _run, _outcome) in zip(items, SOURCES):
        require(core, item.issue_number == issue and item.pr_number == pr and
                item.target_sha == sha and item.previous_version == previous and
                item.current_version == version and not item.validation_docs_only,
                "historical PR/version/validation contract mismatch")
    release, recovery = items[-2:]
    require(core, release.issue_number == RELEASE_ISSUE and
            release.pr_number == RELEASE_PR and release.target_sha == RELEASE_SHA and
            release.previous_version == "0.128.0" and
            release.current_version == RELEASE_VERSION and
            release.release_required and not release.validation_docs_only,
            "replacement Release is not exact PR #759")
    require(core, recovery.issue_number == ISSUE and
            recovery.pr_number == owner["recovery_pr"] and
            recovery.target_sha == owner["recovery_sha"] == main_sha and
            recovery.previous_version == RELEASE_VERSION and
            recovery.current_version == RELEASE_VERSION and
            not recovery.release_required and not recovery.validation_docs_only,
            "recovery PR not exact same-version policy merge")
    return tuple(items[:3]), release, recovery


def verify_original_ci(core: Any, repo: str, old_items: tuple[Any, ...]) -> None:
    for item, (_sha, _issue, _pr, _old, _new, run_id, outcome) in zip(old_items, SOURCES):
        run = core.gh(f"/repos/{repo}/actions/runs/{run_id}")
        require(core, isinstance(run, dict) and run.get("id") == run_id and
                run.get("head_sha") == item.target_sha and
                run.get("event") == "push" and
                run.get("head_branch") == "main" and
                run.get("status") == "completed" and
                run.get("conclusion") == outcome and
                run.get("path") == ".github/workflows/ci.yml",
                f"historical Main # {run_id} no longer matches immutable record")
        green, _ = core.exact_main_ci_success(repo, item.target_sha)
        require(core, not green, "historical Main SHA gained new success evidence")


def private_tags(core: Any, repo: str) -> set[str]:
    """Enumerate every authenticated private Packages page, including ci-SHA."""
    require(core, repo == REPO, "unexpected Package repository")
    packages = core.gh_paginated("/users/planner77/packages/container/mastergantt/versions")
    require(core, isinstance(packages, list) and len(packages) > 0,
            "authenticated complete GHCR inventory unavailable")
    tags: set[str] = set()
    for item in packages:
        metadata = item.get("metadata") if isinstance(item, dict) else None
        container = metadata.get("container") if isinstance(metadata, dict) else None
        values = container.get("tags") if isinstance(container, dict) else None
        require(core, isinstance(values, list) and
                all(isinstance(tag, str) for tag in values),
                "GHCR Package version/tag metadata incomplete")
        tags.update(values)
    return tags


def verify_release(core: Any, repo: str, release: Any, recovery: Any) -> None:
    for item in (release, recovery):
        green, _ = core.exact_main_ci_success(repo, item.target_sha)
        require(core, green, "exact successful Main CI absent for Issue #" +
                str(item.issue_number))
        main_green, _, candidate_ok, _ = lifecycle.exact_main_ci(
            repo, item.target_sha, docs_only=False
        )
        require(core, main_green and candidate_ok,
                "Main CI or verified ci-SHA candidate missing")
    authority = core.select_authorization(
        core.issue_comments(repo, RELEASE_ISSUE), expected_version=RELEASE_VERSION
    )
    require(core, authority is not None and authority.actor == OWNER,
            "Issue #734 scoped Release authority revoked or missing")
    state, _ = core.exact_release_state(repo, release)
    require(core, state == "success", "exact Release #734 is not successful")
    run = core.gh(f"/repos/{repo}/actions/runs/{RELEASE_RUN_ID}")
    require(core, isinstance(run, dict) and run.get("id") == RELEASE_RUN_ID and
            run.get("head_sha") == RELEASE_SHA and
            run.get("head_branch") == "v" + RELEASE_VERSION and
            run.get("path") == ".github/workflows/release-image.yml" and
            run.get("status") == "completed" and run.get("conclusion") == "success",
            "release-image run/attempt authority mismatch")
    try:
        states = registry.version_states(
            repo, {"0.127.0", "0.128.0", RELEASE_VERSION}
        )
    except (registry.AuditBlocked, ValueError) as exc:
        raise core.AutoFinalizerBlocked("Issue #765 GHCR/version audit unavailable") from exc
    for version in ("0.127.0", "0.128.0"):
        old = states[version]
        require(core, old.git_tag == old.github_release == old.ghcr_tag == "ABSENT",
                "unissued v" + version + " is not conclusively absent")
    new = states[RELEASE_VERSION]
    require(core, new.git_tag == "PRESENT" and new.ghcr_tag == "PRESENT" and
            new.ghcr_digest == RELEASE_DIGEST,
            "replacement exact tag/digest differs from Release #186")
    candidate, digest = registry.ghcr_digest(
        f"ghcr.io/planner77/mastergantt:ci-{RELEASE_SHA}"
    )
    require(core, candidate == "PRESENT" and digest == RELEASE_DIGEST,
            "replacement verified main candidate missing or changed")
    tags = private_tags(core, repo)
    for sha, *_rest in SOURCES:
        require(core, "ci-" + sha not in tags,
                "historical failed SHA has a candidate image: manual review required")
    require(core, RELEASE_VERSION in tags and "ci-" + RELEASE_SHA in tags,
            "private Package inventory omits replacement exact/candidate tags")


def plan_765(core: Any, repo: str, main_sha: str) -> Plan | None:
    require(core, repo == REPO, "not the approved repository")
    owner = approval(core, repo)
    if owner is None:
        return None
    require(core, main_sha == owner["recovery_sha"] and
            core.current_main_sha(repo) == main_sha,
            "main advanced beyond approved recovery SHA")
    old_items, release, recovery = exact_history(core, repo, main_sha, owner)
    plan = Plan(main_sha, recovery.target_sha, recovery.pr_number,
                owner["evidence_url"], old_items, release, recovery)
    for item in old_items:
        if core.is_closed_issue(repo, item):
            require(core, authenticated_retirement(core, repo, plan, item.issue_number),
                    "closed historical Issue has no authenticated RETIRED record")
    revoked_versions(core, repo)
    verify_original_ci(core, repo, old_items)
    verify_release(core, repo, release, recovery)
    return plan


def _cleanup_old(core: Any, repo: str, item: Any, target: str, *,
                 delete: bool) -> None:
    pr = core.gh(f"/repos/{repo}/pulls/{item.pr_number}")
    require(core, isinstance(pr, dict) and pr.get("merged") is True and
            pr.get("merge_commit_sha") == item.target_sha and
            (pr.get("base") or {}).get("ref") == "main" and
            ((pr.get("head") or {}).get("repo") or {}).get("full_name") == repo,
            "old merged PR provenance mismatch")
    branch = (pr.get("head") or {}).get("ref")
    require(core, bool(branch), "old PR head branch missing")
    command = ("python3", "scripts/safe_branch_cleanup.py",
               "--repo", repo, "--pr", str(item.pr_number),
               "--branch", branch, "--target-sha", target)
    core.run(*command, *(("--delete",) if delete else ()))


def finalize_765(core: Any, repo: str, main_sha: str, plan: Plan) -> None:
    """Run after all evidence is green. Partial success is replayable."""
    require(core, repo == REPO and plan.main_sha == main_sha and
            core.current_main_sha(repo) == main_sha,
            "stale main/approved recovery SHA")
    # Recheck both immutable release and actual registry at mutation time.
    revoked_versions(core, repo)
    verify_original_ci(core, repo, plan.old_items)
    verify_release(core, repo, plan.release_item, plan.recovery_item)
    for item in plan.old_items:
        _cleanup_old(core, repo, item, main_sha, delete=False)
    for item in plan.old_items:
        require(core, core.current_main_sha(repo) == main_sha,
                "main moved during SHA-leased cleanup")
        _cleanup_old(core, repo, item, main_sha, delete=True)
    for issue in (732, 736):
        require(core, core.current_main_sha(repo) == main_sha,
                "main moved during immutable retirement")
        if not authenticated_retirement(core, repo, plan, issue):
            _data, marker = retirement_body(plan, issue)
            lifecycle.gh(f"/repos/{repo}/issues/{issue}/comments", method="POST", fields={
                "body": "\n".join((
                    marker, f"## Release debt RETIRED · Issue #{issue}",
                    "",
                    "- original Main: CANCELLED/FAILURE unchanged; NOT a CI PASS",
                    "- unissued v0.127.0/v0.128.0: no tag/release/OCI publish",
                    "- replacement v0.129.0: existing release #186.1 SUCCESS",
                    f"- immutable source SHA: {RELEASE_SHA}",
                    f"- verified OCI digest: {RELEASE_DIGEST}",
                    f"- trusted Owner recovery approval: {plan.owner_url}",
                    "- exact old merged branches: safe SHA-lease cleanup PASS",
                    "- historical FINAL marker was NOT manufactured",
                ))
            })
        state = core.gh(f"/repos/{repo}/issues/{issue}")
        require(core, isinstance(state, dict) and state.get("state") in
                {"open", "closed"}, "unexpected retired Issue state")
        if state["state"] == "open":
            lifecycle.gh(f"/repos/{repo}/issues/{issue}", method="PATCH", fields={
                "state": "closed", "state_reason": "completed"
            })
    core.write_summary([
        "### Issue #765 authenticated old release RETIRED",
        f"- Source Owner: {plan.owner_url}",
        "- v0.127.0 (Issue #732): unissued and RETIRED",
        "- v0.128.0 (Issue #736): unissued and RETIRED",
        "- original Main CI results remain CANCELLED/FAILURE",
        f"- existing v0.129.0 Release exact digest: {RELEASE_DIGEST}",
        "- Issue #734/#765 FINAL: delegated to unchanged generic resolver",
    ])
