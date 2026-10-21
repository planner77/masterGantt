#!/usr/bin/env python3
"""#765 exact unissued retirement: positive/negative trusted dry-run fixtures.

No network, GitHub issue changes, branch deletion, or GHCR publish occurs here.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import auto_release_finalizer as auto
import release_debt_audit as audit
import release_debt_recovery_765 as repair


class Fixture:
    def __init__(self):
        self.target_sha = "d" * 40
        self.items = []
        parent = "a" * 40
        for sha, issue, pr, old, new, _run, _outcome in repair.SOURCES:
            self.items.append(auto.WorkItem(sha, parent, pr, issue, old, new, False))
            parent = sha
        self.items.append(auto.WorkItem(repair.RELEASE_SHA, parent, 759, 734,
                                        "0.128.0", "0.129.0", False))
        self.items.append(auto.WorkItem(self.target_sha, repair.RELEASE_SHA, 766, 765,
                                        "0.129.0", "0.129.0", False))
        self.api_calls = []
        self.commands = []
        self.fail_pr = None
        self.comments = {
            732: [self.version_marker("0.127.0", False, 6307754727)],
            736: [self.version_marker("0.128.0", False, 6307755249)],
            734: [self.version_marker("0.129.0", True, 6305865915)],
            765: [self.owner_marker()],
        }
        self.states = {732: "open", 736: "open", 734: "open", 765: "open"}
        self.package_tags = {"0.129.0", "ci-" + repair.RELEASE_SHA}
        self.ghcr_states = {
            "0.127.0": audit.VersionState("ABSENT", "ABSENT", "ABSENT"),
            "0.128.0": audit.VersionState("ABSENT", "ABSENT", "ABSENT"),
            "0.129.0": audit.VersionState("PRESENT", "ABSENT", "PRESENT",
                                           repair.RELEASE_DIGEST),
        }
        self.ci = {x.target_sha: i >= 3 for i, x in enumerate(self.items)}
        self.owner_data = {
            "authorized": True, "mode": "RETIRE_732_736_TO_734",
            "recovery_issue": 765, "recovery_pr": 766,
            "recovery_sha": self.target_sha,
            "source_732_sha": repair.SOURCES[0][0],
            "source_736_sha": repair.SOURCES[1][0],
            "correction_732_sha": repair.SOURCES[2][0],
            "release_sha": repair.RELEASE_SHA,
            "release_run_id": repair.RELEASE_RUN_ID,
            "release_digest": repair.RELEASE_DIGEST,
            "expected_version": repair.RELEASE_VERSION,
            "note": "Owner specifically approves retiring two never-published SemVers",
        }
        self.comments[765] = [self.owner_marker()]

    @staticmethod
    def version_marker(version, authorized, identity):
        return {
            "id": identity, "user": {"login": "planner77"}, "author_association": "OWNER",
            "body": "<!-- mastergantt-release-authorization:v1 " +
                    json.dumps({"authorized": authorized, "expected_version": version,
                                "note": "version-scoped Owner release decision"}) + " -->",
        }

    def owner_marker(self, *, identity=100, login="planner77", relation="OWNER",
                     **override):
        data = {**getattr(self, "owner_data", {
            "authorized": True, "mode": "RETIRE_732_736_TO_734",
            "recovery_issue": 765, "recovery_pr": 766, "recovery_sha": "d" * 40,
            "source_732_sha": repair.SOURCES[0][0],
            "source_736_sha": repair.SOURCES[1][0],
            "correction_732_sha": repair.SOURCES[2][0],
            "release_sha": repair.RELEASE_SHA,
            "release_run_id": repair.RELEASE_RUN_ID,
            "release_digest": repair.RELEASE_DIGEST,
            "expected_version": repair.RELEASE_VERSION,
            "note": "Owner specifically approves retiring two never-published SemVers"
        }), **override}
        return {
            "id": identity, "user": {"login": login},
            "author_association": relation,
            "html_url": f"https://github.com/planner77/masterGantt/issues/765#issuecomment-{identity}",
            "body": "<!-- mastergantt-release-debt-765-authorization:v1 " +
                    json.dumps(data) + " -->",
        }

    def run(self, *args, **kwargs):
        self.commands.append(tuple(args))
        if args[:3] == ("git", "rev-list", "--first-parent"):
            return SimpleNamespace(stdout="\n".join(x.target_sha for x in
                                                    reversed(self.items)))
        if args[:2] == ("python3", "scripts/safe_branch_cleanup.py"):
            pr = int(args[args.index("--pr") + 1])
            if self.fail_pr == pr and "--delete" not in args:
                raise auto.AutoFinalizerBlocked("Simulated open external PR")
            return SimpleNamespace(stdout="SAFE")
        raise AssertionError(f"unexpected command: {args!r}")

    def gh(self, path, *, method="GET", fields=None):
        self.api_calls.append((method, path, fields))
        if path.endswith("/actions/runs/" + str(repair.RELEASE_RUN_ID)):
            return {
                "id": repair.RELEASE_RUN_ID, "head_sha": repair.RELEASE_SHA,
                "head_branch": "v0.129.0", "path": ".github/workflows/release-image.yml",
                "conclusion": "success", "status": "completed",
            }
        for sha, issue, pr, _old, _new, run_id, outcome in repair.SOURCES:
            if path.endswith("/actions/runs/" + str(run_id)):
                return {
                    "id": run_id, "head_sha": sha, "event": "push",
                    "head_branch": "main", "status": "completed",
                    "conclusion": outcome, "path": ".github/workflows/ci.yml",
                }
        if "/pulls/" in path:
            pr = int(path.split("/")[-1])
            item = next(x for x in self.items if x.pr_number == pr)
            return {"merged": True, "merge_commit_sha": item.target_sha,
                    "base": {"ref": "main"},
                    "head": {"ref": f"feature/issue-{item.issue_number}",
                             "repo": {"full_name": repair.REPO}}}
        if "/issues/" in path:
            if path.endswith("/comments"):
                issue = int(path.split("/")[-2])
                if method == "POST":
                    marker = fields["body"]
                    self.comments[issue].append({
                        "id": 999 + issue, "user": {"login": "github-actions[bot]"},
                        "body": marker,
                    })
                    return {}
                return self.comments[issue]
            issue = int(path.split("/")[-1])
            if method == "PATCH":
                self.states[issue] = fields["state"]
            return {"state": self.states[issue]}
        raise AssertionError(f"unknown api call: {path}")

    def core(self):
        return SimpleNamespace(
            AutoFinalizerBlocked=auto.AutoFinalizerBlocked,
            issue_comments=lambda repo, issue: self.comments[issue],
            parse_authorization_marker=auto.parse_authorization_marker,
            select_authorization=auto.select_authorization,
            exact_main_ci_success=lambda repo, sha: (self.ci[sha], "synthetic CI"),
            exact_release_state=lambda repo, item: ("success", "release #186"),
            current_main_sha=lambda repo: self.target_sha,
            resolve_work_item=lambda repo, sha: next(
                x for x in self.items if x.target_sha == sha
            ),
            is_closed_issue=lambda repo, item: self.states[item.issue_number] == "closed",
            run=self.run,
            gh=self.gh,
            gh_paginated=lambda endpoint: [
                {"metadata": {"container": {"tags": sorted(self.package_tags)}}}
            ],
            write_summary=lambda lines: None,
        )

    def mocks(self):
        return (
            patch.object(audit, "version_states",
                         side_effect=lambda repo, versions: {
                             v: self.ghcr_states[v] for v in versions
                         }),
            patch.object(audit, "ghcr_digest",
                         return_value=("PRESENT", repair.RELEASE_DIGEST)),
            patch.object(repair.lifecycle, "exact_main_ci",
                         return_value=(True, "synthetic Main", True, "candidate verified")),
            patch.object(repair.lifecycle, "gh", side_effect=self.gh),
        )


class ScopedReleaseDebtTests(unittest.TestCase):
    def setUp(self):
        self.f = Fixture()
        self.patches = self.f.mocks()
        for p in self.patches:
            p.start()
        self.addCleanup(lambda: [p.stop() for p in reversed(self.patches)])

    def plan(self):
        return repair.plan_765(self.f.core(), repair.REPO, self.f.target_sha)

    def blocked(self):
        with self.assertRaises(auto.AutoFinalizerBlocked):
            self.plan()

    def test_valid_plan_selects_only_three_failed_history_shas(self):
        plan = self.plan()
        self.assertEqual(plan.retired_shas, frozenset(x[0] for x in repair.SOURCES))
        self.assertEqual(plan.release_item.target_sha, repair.RELEASE_SHA)
        self.assertEqual(plan.recovery_item.issue_number, 765)

    def test_no_owner_marker_is_noop(self):
        self.f.comments[765] = []
        self.assertIsNone(self.plan())

    def test_last_owner_revoked_foreign_or_malformed_rejected(self):
        self.f.comments[765].append(self.f.owner_marker(identity=101, authorized=False))
        self.blocked()
        self.f.comments[765] = [self.f.owner_marker(login="outsider", relation="NONE")]
        self.assertIsNone(self.plan())
        for bad in [
            {"release_sha": "a" * 40}, {"release_digest": "sha256:" + "a" * 64},
            {"release_run_id": True}, {"recovery_sha": "b" * 40},
            {"recovery_pr": False}, {"source_736_sha": "c" * 40},
            {"note": "short"}, {"mode": "BYPASS"},
        ]:
            with self.subTest(bad=bad):
                self.f.comments[765] = [self.f.owner_marker(**bad)]
                self.blocked()
        self.f.comments[765] = [self.f.owner_marker()]
        self.f.comments[765][0]["body"] *= 2
        self.blocked()

    def test_scope_requires_unchanged_chain_and_unmodified_main(self):
        original = list(self.f.items)
        self.f.items.insert(3, auto.WorkItem(
            "f" * 40, repair.SOURCES[2][0], 900, 999,
            "0.128.0", "0.128.0", False))
        self.blocked()
        self.f.items = original
        self.f.items[-1] = auto.WorkItem(
            self.f.target_sha, repair.RELEASE_SHA, 766, 999,
            "0.129.0", "0.129.0", False)
        self.blocked()
        self.f.items = original
        self.f.items[-1] = auto.WorkItem(
            self.f.target_sha, repair.RELEASE_SHA, 766, 765,
            "0.129.0", "0.130.0", False)
        self.blocked()

    def test_ci_evidence_cannot_be_greenwashed(self):
        self.f.ci[repair.SOURCES[0][0]] = True
        self.blocked()
        self.f.ci[repair.SOURCES[0][0]] = False
        self.f.ci[repair.RELEASE_SHA] = False
        self.blocked()

    def test_private_registry_absence_and_digest_must_be_exact(self):
        self.f.ghcr_states["0.127.0"] = audit.VersionState(
            "ABSENT", "ABSENT", "UNKNOWN")
        self.blocked()
        self.f.ghcr_states["0.127.0"] = audit.VersionState(
            "ABSENT", "ABSENT", "ABSENT")
        self.f.package_tags.add("ci-" + repair.SOURCES[0][0])
        self.blocked()
        self.f.package_tags.remove("ci-" + repair.SOURCES[0][0])
        self.f.ghcr_states["0.129.0"] = audit.VersionState(
            "PRESENT", "ABSENT", "PRESENT", "sha256:" + "f" * 64)
        self.blocked()

    def test_existing_closed_old_issue_needs_bot_retirement(self):
        self.f.states[732] = "closed"
        self.blocked()
        self.f.states[732] = "open"
        plan = self.plan()
        payload, marker = repair.retirement_body(plan, 732)
        self.f.comments[732].append({
            "id": 999, "user": {"login": "forged-user"}, "body": marker,
        })
        self.blocked()
        self.f.comments[732][-1]["user"]["login"] = "github-actions[bot]"
        self.f.states[732] = "closed"
        self.assertIsNotNone(self.plan())
        self.f.comments[732][-1]["body"] = marker.replace(
            repair.RELEASE_DIGEST, "sha256:" + "0" * 64
        )
        self.blocked()

    def test_preflight_blocks_before_any_mutation(self):
        plan = self.plan()
        self.f.fail_pr = 760
        with self.assertRaises(auto.AutoFinalizerBlocked):
            repair.finalize_765(self.f.core(), repair.REPO, self.f.target_sha, plan)
        self.assertFalse(any("--delete" in c for c in self.f.commands))
        self.assertFalse(any(m != "GET" for m, _, _ in self.f.api_calls))

    def test_retire_replay_is_idempotent(self):
        plan = self.plan()
        repair.finalize_765(self.f.core(), repair.REPO, self.f.target_sha, plan)
        self.assertEqual(self.f.states[732], "closed")
        self.assertEqual(self.f.states[736], "closed")
        self.assertEqual(len([r for r in self.f.comments[732]
                              if repair.RETIRED_RE.search(r["body"])]), 1)
        # A second trigger must reuse existing bot evidence, never post it twice.
        replay = self.plan()
        repair.finalize_765(self.f.core(), repair.REPO, self.f.target_sha, replay)
        for issue in (732, 736):
            self.assertEqual(len([r for r in self.f.comments[issue]
                                  if repair.RETIRED_RE.search(r["body"])]), 1)

    def test_old_approved_release_is_not_reissued(self):
        plan = self.plan()
        repair.finalize_765(self.f.core(), repair.REPO, self.f.target_sha, plan)
        mutating = [path for method, path, _ in self.f.api_calls if method != "GET"]
        self.assertTrue(all("/issues/" in path for path in mutating))
        self.assertFalse(any("/git/" in path or "/actions/" in path for path in mutating))


if __name__ == "__main__":
    unittest.main()
