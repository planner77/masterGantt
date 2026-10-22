#!/usr/bin/env python3
"""Issue #772 default-main artifact, Blob, exact-source and Full-failure veto."""
from __future__ import annotations

import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import ci_low_policy as low
import ci_low_source as src


FILES = sorted(low.ADJACENT_NEGATIVE)
SOURCE = {"repository": "planner77/masterGantt", "pr_number": 30,
          "run_id": 1234, "run_attempt": 1,
          "head_sha": "a" * 40, "base_sha": "b" * 40,
          "test_merge_sha": "c" * 40}
OLD = ('<div className={styles.sessionCard}><h4>편집 세션 관리</h4><p>'
       '현재 브라우저에서는 편집 모드가 켜져 있습니다. 작업을 완료하면 종료해 주세요.'
       '</p><button>닫기</button></div>')
NEW = OLD.replace('작업을 완료하면 종료해 주세요.', '작업을 마친 후 편집 모드를 종료하세요.')


def fixtures():
    plan = {
        "schema": low.SCHEMA, "mode": low.CANDIDATE,
        "authority": "BASE_TRUSTED_PLAN_NOT_PASS", "verification": "NOT_RUN",
        "source": SOURCE, "activation": "OWNER_OPT_IN",
        "selected_count": len(FILES), "selected_test_ids": FILES,
        "excluded_test_ids": ["tests/e2e/non-selected.spec.ts"],
        "selection_reasons": ["EXACT_NONINTERACTIVE_COPY_ONLY"],
        "policy_blob_sha": "f" * 40, "selector_blob_sha": "e" * 40,
        "diff_sha256": "d" * 64, "shadow_plan_sha256": "1" * 64,
        "shadow_mode": "FAST_TARGETED", "shadow_risk": "MEDIUM",
        "trusted_test_inventory": 136,
    }
    plan["plan_sha256"] = low.digest(plan)
    report = {
        "stats": {"expected": len(FILES), "unexpected": 0, "flaky": 0, "skipped": 0},
        "suites": [{"specs": [
            {"file": filename, "tests": [
                {"expectedStatus": "passed", "status": "expected",
                 "results": [{"status": "passed"}]}]}
            for filename in FILES]}],
    }
    receipt = low.attest(plan, dict(plan), report)
    return plan, receipt


class FakeGitHub:
    repo = SOURCE["repository"]
    def __init__(self, files=None, prior=None):
        self.files = files or [
            {"filename": low.ALLOW_COPY, "status": "modified"},
            {"filename": "docs/exec-plans/active/ISSUE_30.md", "status": "added"},
        ]
        self.prior = prior or []
        self.prefix = "/repos/" + self.repo

    def collection(self, url, key):
        if key == "workflow_runs":
            return self.prior
        raise AssertionError(url)

    def get(self, url):
        if "/compare/" in url:
            return {"status": "ahead", "ahead_by": 2, "files": self.files}
        raise AssertionError(url)


def fake_blob(gh, sha, path):
    if path == "scripts/ci_low_policy.py":
        return "policy contents", "f" * 40
    if path == "scripts/ci_impact_plan.py":
        return "selector contents", "e" * 40
    if path == low.ALLOW_COPY:
        return OLD if sha == SOURCE["base_sha"] else NEW, "9" * 40
    if path in FILES:
        return "unchanged spec", "7" * 40
    raise AssertionError(path)


class DefaultMainSourceTest(unittest.TestCase):
    def setUp(self):
        self.plan, self.receipt = fixtures()
        self.jobs = {
            "Low E2E policy plan (trusted base)": "success",
            "Low E2E targeted execution": "success",
            "Chromium end-to-end tests": "success",
            "Chromium E2E shard 1/8 · PR": "skipped",
        }
        self.run = {"id": SOURCE["run_id"], "run_attempt": 1,
                    "event": "pull_request", "status": "completed",
                    "conclusion": "success"}
        self.fake_artifact = lambda gh, run_id, attempt, kind, filename: (
            self.plan if kind == "plan" else self.receipt)

    def assess(self, gh=None, enabled=True, source=SOURCE, jobs=None):
        with patch.object(src, "artifact", side_effect=self.fake_artifact), \
             patch.object(src, "blob", side_effect=fake_blob):
            return src.verified_targeted_source(
                gh or FakeGitHub(), self.run, source,
                jobs if jobs is not None else self.jobs, enabled=enabled)

    def test_exact_receipt_requires_actual_tests_and_not_full(self):
        result = self.assess()
        self.assertEqual(result["mode"], low.TARGETED)
        self.assertEqual(result["report_mode"], "TARGETED_E2E_PASS_NOT_FULL")
        self.assertEqual(result["actual_test_case_count"], len(FILES))

    def test_owner_flag_off_and_unexpected_workflow_topology(self):
        with self.assertRaises(low.Refused):
            self.assess(enabled=False)
        with self.assertRaises(low.Refused):
            self.assess(jobs={**self.jobs, "Chromium E2E shard 1/8 · PR": "success"})

    def test_global_css_and_test_removal_in_compare_blocked(self):
        gh = FakeGitHub(files=[
            {"filename": low.ALLOW_COPY, "status": "modified"},
            {"filename": "src/app/globals.css", "status": "modified"},
        ])
        with self.assertRaises(low.Refused):
            self.assess(gh)
        gh2 = FakeGitHub(files=[
            {"filename": low.ALLOW_COPY, "status": "modified"},
            {"filename": "tests/e2e/project-settings-layout-490.spec.ts", "status": "removed"},
        ])
        with self.assertRaises(low.Refused):
            self.assess(gh2)

    def test_full_failure_or_cancelled_before_targeted_is_veto(self):
        previous = {
            "id": 200, "event": "pull_request", "head_sha": SOURCE["head_sha"],
            "display_title": "PR CI [전체 검증] old", "status": "completed",
            "conclusion": "failure",
        }
        with self.assertRaises(low.Refused):
            self.assess(FakeGitHub(prior=[previous]))
        previous["conclusion"] = "cancelled"
        with self.assertRaises(low.Refused):
            self.assess(FakeGitHub(prior=[previous]))
        previous["conclusion"] = None
        with self.assertRaises(low.Refused):
            self.assess(FakeGitHub(prior=[previous]))

    def test_source_sha_drift_forged_receipt_and_failed_tests_block(self):
        with self.assertRaises(low.Refused):
            self.assess(source={**SOURCE, "base_sha": "0" * 40})
        self.receipt["execution"]["skipped"] = 1
        with self.assertRaises(low.Refused):
            self.assess()

    def test_api_unknown_or_rate_limited_never_passes(self):
        class Fault(FakeGitHub):
            def collection(self, *_):
                raise RuntimeError("RATE_LIMIT")
        with self.assertRaises(RuntimeError):
            self.assess(Fault())


if __name__ == "__main__":
    unittest.main()
