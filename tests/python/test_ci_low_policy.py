#!/usr/bin/env python3
"""Issue #772 safety scenarios: LOW whitelist, source receipt and false-green 0."""
from __future__ import annotations

import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import ci_low_policy as low


def paragraph(text: str) -> str:
    return ('const dialog = <><button aria-label="편집 종료">종료</button>'
            '<div className={styles.sessionCard}>\n'
            '<h4>편집 세션 관리</h4>\n<p>\n'
            + text + '\n</p><button onClick={close}>닫기</button></div></>;\n')


OLD = paragraph("현재 브라우저 세션에서 편집 모드가 활성화되어 있습니다. 종료 후 읽기 전용으로 전환됩니다.")
NEW = paragraph("현재 브라우저 세션은 편집할 수 있습니다. 작업 후에는 편집 모드를 종료해 주세요.")
SPECS = sorted(set(low.ADJACENT_NEGATIVE))
PLAN = {
    "mode_recommendation": "FAST_TARGETED", "risk": "MEDIUM",
    "ambiguity": "NONE_FOUND",
    "selected_test_ids": [{"id": low.ADJACENT_NEGATIVE[0], "kind": "CHROMIUM"}],
}
INV = {"all": SPECS, "e2e": SPECS, "unexpected": []}
ENTRY = [{"status": "M", "path": low.ALLOW_COPY}]


def classify(**kw):
    arguments = dict(entries=ENTRY, before=INV, after=INV, recommendation=PLAN,
                     old_text=OLD, new_text=NEW, same_repo=True, enabled=True)
    arguments.update(kw)
    return low.classify(**arguments)


def fake_report(*, skipped=0, status="passed", missing=False, extra=False, retries=1):
    selected = SPECS[:-1] if missing else SPECS
    tests = [{"status": "expected" if status == "passed" else "unexpected",
              "expectedStatus": "passed",
              "results": [{"status": status}] * retries}]
    specs = [{"file": name, "tests": tests} for name in selected]
    if extra:
        specs.append({"file": "tests/e2e/unknown.spec.ts", "tests": tests})
    return {
        "stats": {"expected": len(specs), "unexpected": int(status != "passed"),
                  "flaky": int(retries != 1), "skipped": skipped},
        "suites": [{"specs": specs}]
    }


class LowWhitelistTest(unittest.TestCase):
    def test_exact_plain_copy_only(self):
        self.assertTrue(low.pure_paragraph_edit(OLD, NEW))
        self.assertEqual(classify()[0], low.CANDIDATE)
        self.assertEqual(classify()[1], SPECS)

    def test_owner_flag_off_and_fork(self):
        self.assertEqual(classify(enabled=False)[0], low.FULL)
        self.assertEqual(classify(same_repo=False)[0], low.FULL)

    def test_button_label_aria_focus_and_behavior_never_low(self):
        for replaced in (
            NEW.replace('aria-label="편집 종료"', 'aria-label="세션 나가기"'),
            NEW.replace("<button onClick={close}>", "<button onFocus={close}>"),
            NEW.replace("const dialog", "const updatedDialog"),
        ):
            with self.subTest(change=replaced[:45]):
                self.assertEqual(classify(new_text=replaced)[0], low.FULL)

    def test_global_tokens_navigation_auth_db_ci_qa_test_infra_full(self):
        for path in (
            "src/app/globals.css", "src/components/ui/button.tsx",
            "src/app/api/projects/route.ts", "src/server/auth.ts",
            "db/schema.sql", ".github/workflows/ci.yml",
            "scripts/qa_final_automated.py", "tests/e2e/fixture.ts",
            "tests/config/playwright.config.ts", "package-lock.json",
            "src/features/projects/project-navigation.tsx",
            "src/features/gantt/viewport-coordinator.ts",
        ):
            with self.subTest(path=path):
                self.assertEqual(classify(entries=[{"status": "M", "path": path}])[0],
                                 low.FULL)

    def test_downgrade_unknown_source_and_changed_tests_full(self):
        for mod in [
            {"recommendation": {**PLAN, "mode_recommendation": "FULL_REQUIRED"}},
            {"recommendation": {**PLAN, "ambiguity": "UNKNOWN"}},
            {"recommendation": {**PLAN, "selected_test_ids": []}},
            {"before": {**INV, "unexpected": ["tests/evil.spec.ts"]}},
            {"after": {**INV, "e2e": SPECS[:-1]}},
            {"entries": [{"path": low.ALLOW_COPY, "status": "R100",
                          "previous_path": "src/old.tsx"}]},
            {"entries": [{"path": low.ALLOW_COPY, "status": "M"},
                         {"path": "docs/TEST_PLAN.md", "status": "M"}]},
        ]:
            with self.subTest(mod=mod):
                self.assertEqual(classify(**mod)[0], low.FULL)

    def test_work_packet_can_accompany_low_only(self):
        extra = ENTRY + [{"path": "docs/exec-plans/active/ISSUE_999.md", "status": "M"}]
        self.assertEqual(classify(entries=extra)[0], low.CANDIDATE)

    def test_docs_only_not_claimed_full(self):
        doc_plan = {**PLAN, "mode_recommendation": "DOCS_VERIFIED"}
        self.assertEqual(classify(entries=[{"status": "M", "path":
                         "docs/exec-plans/active/ISSUE_999.md"}],
                         recommendation=doc_plan)[0], low.DOCS)
        self.assertEqual(classify(entries=[{"status": "M", "path":
                         "docs/CI_CD.md"}], recommendation=doc_plan)[0], low.FULL)


class TargetedEvidenceTest(unittest.TestCase):
    def test_actual_selected_case_pass(self):
        cov = low.reporter_coverage(fake_report(), SPECS)
        self.assertEqual(cov["actual_test_case_count"], len(SPECS))
        self.assertEqual(cov["actual_test_ids"], SPECS)

    def test_skipped_fail_cancelled_retried_empty_or_unplanned_never_green(self):
        fixtures = [
            fake_report(skipped=1),
            fake_report(status="failed"),
            fake_report(status="interrupted"),
            fake_report(retries=2),
            fake_report(missing=True),
            fake_report(extra=True),
            {"suites": [], "stats": {"expected": 0, "unexpected": 0,
                                     "skipped": 0, "flaky": 0}},
        ]
        for report in fixtures:
            with self.subTest(case=str(report)[:100]):
                with self.assertRaises(low.Refused):
                    low.reporter_coverage(report, SPECS)

    def test_hash_provenance_and_topology(self):
        src = {"repository": "planner77/masterGantt", "pr_number": 20,
               "run_id": 1234, "run_attempt": 1,
               "head_sha": "a" * 40, "base_sha": "b" * 40,
               "test_merge_sha": "c" * 40}
        plan = {
            "schema": low.SCHEMA, "mode": low.CANDIDATE,
            "verification": "NOT_RUN",
            "authority": "BASE_TRUSTED_PLAN_NOT_PASS",
            "source": src, "activation": "OWNER_OPT_IN",
            "selected_count": len(SPECS), "selected_test_ids": SPECS,
            "excluded_test_ids": ["tests/e2e/not-selected.spec.ts"],
            "selection_reasons": ["NONINTERACTIVE_COPY"],
            "policy_blob_sha": "f" * 40, "selector_blob_sha": "e" * 40,
            "diff_sha256": "d" * 64, "shadow_plan_sha256": "1" * 64,
        }
        plan["plan_sha256"] = low.digest(plan)
        receipt = low.attest(plan, plan.copy(), fake_report())
        jobs = {
            "Low E2E policy plan (trusted base)": "success",
            "Low E2E targeted execution": "success",
            "Chromium end-to-end tests": "success",
            "Chromium E2E shard 1/8 · PR": "skipped",
        }
        self.assertTrue(low.validate_receipt(plan, receipt, source=src, jobs=jobs))
        cases = [
            ({**src, "head_sha": "0" * 40}, jobs, plan, receipt),
            (src, {**jobs, "Low E2E targeted execution": "cancelled"}, plan, receipt),
            (src, {**jobs, "Chromium E2E shard 1/8 · PR": "success"}, plan, receipt),
            (src, jobs, {**plan, "activation": "OFF"}, receipt),
            (src, jobs, plan, {**receipt, "mode": "FULL_E2E_PASS"}),
        ]
        for source, state, p, r in cases:
            with self.assertRaises(low.Refused):
                low.validate_receipt(p, r, source=source, jobs=state)


if __name__ == "__main__":
    unittest.main()
