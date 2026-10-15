#!/usr/bin/env python3
"""Issue #622: trust, topology and idempotence tests; no GitHub/network writes."""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import closed_issue_622_recovery as repair
import safe_branch_cleanup as cleanup

MAIN = "f"*40
PR = 692


def marker(*, approved=True, issue=622, pr=PR, sha=MAIN,
           release=repair.CORRECTION[1], version="0.114.0", note="Scoped owner completion recovery for exact existing release and PR"):
    return {"authorized": approved, "issue": issue, "pr": pr, "main_sha": sha,
            "release_sha": release, "version": version, "note": note}


def comment(data, *, comment_id=13, owner=True):
    return {"id": comment_id, "author_association": "OWNER" if owner else "NONE",
            "user": {"login": "planner77" if owner else "intruder"},
            "body": "<!-- mastergantt-closed-622-recovery:v1 " + json.dumps(data) + " -->"}


class ScopedRepairTests(unittest.TestCase):
    def test_exact_owner_authorization_and_revocation(self):
        ok = comment(marker())
        self.assertEqual(repair.authorized_comment([ok], 13, main_sha=MAIN, pr_number=PR)["pr"], PR)
        with self.assertRaises(repair.Blocked):
            repair.authorized_comment([ok], 12, main_sha=MAIN, pr_number=PR)
        with self.assertRaises(repair.Blocked):
            repair.authorized_comment([ok, comment(marker(approved=False), comment_id=14)],
                                      13, main_sha=MAIN, pr_number=PR)
        with self.assertRaises(repair.Blocked):
            repair.authorized_comment([comment(marker(), owner=False)], 13,
                                      main_sha=MAIN, pr_number=PR)
        # A malicious/non-Owner malformed comment cannot poison Owner audits.
        noisy = {"id": 14, "author_association": "NONE",
                 "user": {"login": "untrusted"},
                 "body": "<!-- mastergantt-closed-622-recovery:v1 {bad} -->"}
        self.assertEqual(
            repair.authorized_comment([ok, noisy], 13,
                                      main_sha=MAIN, pr_number=PR)["pr"], PR
        )
        with self.assertRaises(repair.Blocked):
            repair.authorized_comment([ok], 13, main_sha="a"*40, pr_number=PR)

    def test_marker_rejects_ambient_or_foreign_release_authority(self):
        self.assertEqual(repair.parsed_marker(comment(marker())["body"]), marker())
        for change in [
            {"issue": 666}, {"pr": "692"}, {"main_sha": "bad"},
            {"release_sha": "a"*40}, {"version": "0.114.1"},
            {"authorized": 1}, {"note": "short"}, {"pr": True},
        ]:
            with self.subTest(change=change), self.assertRaises(repair.Blocked):
                repair.parsed_marker(comment({**marker(), **change})["body"])
        with self.assertRaises(repair.Blocked):
            repair.parsed_marker(comment(marker())["body"] * 2)
        with self.assertRaises(repair.Blocked):
            repair.parsed_marker("<!-- mastergantt-closed-622-recovery:v1 {not-json} -->")
        self.assertIsNone(repair.parsed_marker("This is NOT a recovery authorization"))

    def test_first_parent_chronology_must_be_preserved(self):
        chain = [MAIN, repair.ALIGNED_MAIN, repair.PREVIOUS_FIX[1], "a"*40,
                 repair.CORRECTION[1], repair.ORIGINAL[1]]
        repair.verify_history(chain, target=MAIN)
        for bad in [
            chain[1:], list(reversed(chain)), chain[:-1],
            [MAIN, repair.PREVIOUS_FIX[1], repair.ORIGINAL[1],
             repair.CORRECTION[1]], [MAIN, MAIN, *chain[1:]],
        ]:
            with self.subTest(chain=bad), self.assertRaises(repair.Blocked):
                repair.verify_history(bad, target=MAIN)

    def test_pr_identity_rejects_other_issue_or_unmerged_source(self):
        good = {
            "merged": True, "merge_commit_sha": repair.CORRECTION[1],
            "base": {"ref": "main"}, "head": {
                "ref": "fix/issue-622-main-ci-2771-milestone-probe",
                "repo": {"full_name": "planner77/masterGantt"}, "sha": "b"*40},
            "body": "Refs #622\n"
        }
        with patch.object(repair.lc, "gh", return_value=good):
            repair.verify_pr("planner77/masterGantt", 686, repair.CORRECTION[1])
        for key, changed in [
            ("merged", False), ("merge_commit_sha", "a"*40),
            ("body", "Refs #622\nRefs #622\n"), ("body", "Refs #665\n"),
        ]:
            with patch.object(repair.lc, "gh", return_value={**good, key: changed}):
                with self.subTest(key=key), self.assertRaises(repair.Blocked):
                    repair.verify_pr("planner77/masterGantt", 686, repair.CORRECTION[1])

    def test_sha_leased_delete_requires_real_404(self):
        class API:
            def __init__(self, states): self.states = iter(states); self.count = 0
            def get(self, path, *, allowed):
                self.count += 1
                self_test.assertIn("feat%2Fissue-622", path)
                return next(self.states)
        self_test = self
        ref = {"object": {"sha": "a"*40}}
        with patch.object(cleanup.time, "sleep", return_value=None):
            api = API([(200, ref), (200, ref), (404, None)])
            cleanup.confirm_deleted_ref(api, "feat/issue-622", "a"*40)
            self.assertEqual(api.count, 3)
            with self.assertRaises(cleanup.CleanupError):
                cleanup.confirm_deleted_ref(API([(200, {"object": {"sha": "b"*40}})]),
                                            "feat/issue-622", "a"*40)
            with self.assertRaises(cleanup.CleanupError):
                cleanup.confirm_deleted_ref(API([(200, ref)]*10),
                                            "feat/issue-622", "a"*40)

    def test_mutation_requires_successful_read_only_audit(self):
        with patch.object(repair, "audit", side_effect=repair.Blocked("invalid")):
            with patch.object(repair.lc, "finalize") as finalize:
                with self.assertRaises(repair.Blocked):
                    repair.execute("planner77/masterGantt", 13)
                finalize.assert_not_called()


    def test_existing_bot_final_is_idempotent_and_cleanup_free(self):
        ctx = SimpleNamespace(merge_sha=MAIN, pr_number=PR)
        with patch.object(repair, "audit",
                          return_value=(ctx, SimpleNamespace(cleanup_pr=[684, 686, 691]),
                                        "release-url", marker(), {MAIN: PR})):
            with patch.object(repair.lc, "finalize") as finalize:
                with patch.object(repair.lc, "resolve_context") as ctx_read:
                    repair.execute("planner77/masterGantt", 13)
                    finalize.assert_not_called()
                    ctx_read.assert_not_called()


if __name__ == "__main__":
    unittest.main()
