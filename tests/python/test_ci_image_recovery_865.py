#!/usr/bin/env python3
"""Issue #865: v0.141.0 failed Release debt -> immutable v0.141.1 PATCH recovery.

Test the currently implemented generic Finalizer's nonadjacent same-Issue
supersession rules without mutating Git, GHCR, tags, or GitHub issues.
"""
from __future__ import annotations

import json
import pathlib
import sys
import unittest
from dataclasses import replace
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
import auto_release_finalizer as finalizer

SOURCE = finalizer.WorkItem(
    "a" * 40, "0" * 40, 871, 865, "0.140.0", "0.141.0", False)
INTERVENING = finalizer.WorkItem(
    "b" * 40, SOURCE.target_sha, 875, 874, "0.141.0", "0.141.0", False)
PATCH = finalizer.WorkItem(
    "c" * 40, INTERVENING.target_sha, 0 + 900, 865, "0.141.0", "0.141.1", False)


class ReleaseRecovery865Test(unittest.TestCase):
    def plan(self, item=PATCH, *, source_main=True, patch_main=True,
             source_release_failed=True):
        chain = [SOURCE, INTERVENING, item]
        ci = {SOURCE.target_sha: source_main,
              INTERVENING.target_sha: True,
              item.target_sha: patch_main}
        release_failed = {SOURCE.target_sha: source_release_failed,
                          item.target_sha: False}
        return finalizer.supersede_failed_issue_retries(
            chain, ci, release_failed, first_parent_items=chain)

    def test_failed_immutable_tag_recovered_only_by_new_same_issue_patch(self):
        pending, superseded = self.plan()
        self.assertEqual(superseded, [(SOURCE, PATCH)])
        self.assertEqual([item.issue_number for item in pending], [874, 865])
        self.assertEqual(pending[-1].current_version, "0.141.1")
        self.assertEqual(pending[-1].cleanup_pr_numbers, (871,))
        self.assertEqual(pending[0].target_sha, INTERVENING.target_sha)
        self.assertFalse(pending[0].release_required)
        self.assertTrue(pending[-1].release_required)

    def test_same_tag_reuse_and_missing_main_proof_never_supersede(self):
        for patch, patch_main in (
            (replace(PATCH, current_version="0.141.0"), True),
            (PATCH, False),
            (replace(PATCH, issue_number=999), True),
            (replace(PATCH, validation_docs_only=True), True),
        ):
            with self.subTest(patch=patch, patch_main=patch_main):
                pending, superseded = self.plan(patch, patch_main=patch_main)
                self.assertEqual(superseded, [])
                self.assertEqual([item.target_sha for item in pending],
                                 [SOURCE.target_sha, INTERVENING.target_sha,
                                  patch.target_sha])

    def test_old_version_owner_approval_cannot_authorize_patch(self):
        marker = {
            "authorized": True, "expected_version": "0.141.0",
            "note": "원래 v0.141.0의 명시적 게시 승인만 존재",
        }
        comment = {
            "id": 1, "author_association": "OWNER",
            "user": {"login": "planner77"},
            "html_url": "https://github.com/planner77/masterGantt/issues/865#issuecomment-1",
            "body": "<!-- mastergantt-release-authorization:v1 "
                    + json.dumps(marker, ensure_ascii=False) + " -->",
        }
        self.assertIsNone(finalizer.select_authorization(
            [comment], expected_version="0.141.1"))
        self.assertTrue(finalizer.select_authorization(
            [comment], expected_version="0.141.0").authorized)

    def test_live_manifest_and_lockfile_versions_remain_synchronized(self):
        # This repository-wide test must survive future legitimate releases.
        # Historical 0.141.0 -> 0.141.1 is covered independently by PATCH.
        root = pathlib.Path(__file__).resolve().parents[2]
        manifest = json.loads((root / "package.json").read_text(encoding="utf-8"))
        lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
        version = manifest["version"]
        self.assertIsInstance(version, str)
        self.assertRegex(version, r"^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$")
        self.assertEqual(lock["version"], version)
        self.assertEqual(lock["packages"][""]["version"], version)
        # The original recovery uses distinct immutable source and PATCH SHAs.
        self.assertNotEqual(SOURCE.target_sha, PATCH.target_sha)


if __name__ == "__main__":
    unittest.main()
