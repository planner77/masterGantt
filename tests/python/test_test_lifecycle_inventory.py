"""Issue #711 read-only inventory parser regression tests.

Run: python3 -m unittest discover -s tests/python -p 'test_test_lifecycle_inventory.py' -v
No real test bodies, browser, npm registry, or CI source mutation is involved.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[2] / "scripts/test_lifecycle_inventory.py"
SPEC = importlib.util.spec_from_file_location("issue_711_inventory", SOURCE)
inventory = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(inventory)


class LifecycleInventoryParserTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder in (".github/workflows", "tests/e2e", "tests/domain", "tests/python",
                       "tests/config", "scripts"):
            (self.root / folder).mkdir(parents=True)
        (self.root / "tests/domain/math.test.ts").write_text('test("works", () => {})\n')
        (self.root / "tests/e2e/scale.spec.ts").write_text('test("scale", async () => {})\n')
        (self.root / ".github/workflows/ci.yml").write_text(
            "jobs:\n  policy:\n    steps:\n      - name: discover\n"
            "        run: node scripts/verify-test-discovery.mjs\n"
            "      - name: unit\n        run: PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/python -p 'test_x*.py' -v\n"
            "  other_job:\n    steps:\n      - run: echo must-not-appear\n"
        )
        (self.root / "tests/python/test_x.py").write_text(
            "import unittest\nclass T(unittest.TestCase):\n"
            "  def test_a(self): pass\n  def test_b(self): pass\n"
        )
        (self.root / "package.json").write_text('{"version":"0.129.1"}\n')
        (self.root / "tests/config/e2e-shard-plan.json").write_text('{"shardCount":8}\n')

    def test_static_counts_separate_files_from_test_cases(self):
        summary, rows = inventory.build(self.root, "static")
        self.assertEqual(summary["vitest_files"], 1)
        self.assertEqual(summary["e2e_files"], 1)
        self.assertEqual(summary["vitest_collected_cases"], "UNKNOWN")
        self.assertEqual(summary["e2e_collected_cases"], "UNKNOWN")
        self.assertEqual(summary["policy_python_declared_methods_static_only"], 2)
        self.assertEqual(summary["e2e_shards_planned"], 8)
        self.assertEqual(summary["policy_workflow_commands"], 2)
        self.assertEqual(len(rows), 4)

    def test_playwright_case_and_file_totals_are_independent(self):
        listing = (
            "Listing tests:\n"
            "  [chromium] › tests/e2e/scale.spec.ts:3:1 › first scenario\n"
            "  [chromium] › tests/e2e/scale.spec.ts:9:1 › second scenario\n"
            "Total: 2 tests in 1 file\n"
        )
        cases = inventory.parse_playwright_listing(listing, self.root, ["tests/e2e/scale.spec.ts"])
        self.assertEqual(len(cases), 2)
        self.assertEqual({case["path"] for case in cases}, {"tests/e2e/scale.spec.ts"})

    def test_playwright_incomplete_list_is_not_reported_as_zero(self):
        with self.assertRaises(inventory.InventoryError):
            inventory.parse_playwright_listing("Total: 2 tests in 1 file\n", self.root, ["tests/e2e/scale.spec.ts"])

    def test_vitest_json_test_cases_and_nested_file(self):
        sample = [{
            "file": str(self.root / "tests/domain/math.test.ts"), "name": "file",
            "tasks": [{"name": "suite", "tasks": [
                {"name": "first"}, {"name": "second"},
            ]}],
        }]
        rows = inventory.parse_vitest_listing(
            json.dumps(sample), self.root, ["tests/domain/math.test.ts"],
        )
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0]["scenario"].endswith("suite > first"))

    def test_vitest_unknown_json_fails_closed(self):
        with self.assertRaises(inventory.InventoryError):
            inventory.parse_vitest_listing("{}", self.root, ["tests/domain/math.test.ts"])

    def test_same_title_is_only_candidate_not_removal_permission(self):
        examples = [
            {"layer": "E2E", "path": "tests/e2e/a.spec.ts", "scenario": "Same  state"},
            {"layer": "E2E", "path": "tests/e2e/b.spec.ts", "scenario": "same state"},
            {"layer": "VITEST", "path": "tests/domain/c.test.ts", "scenario": "same state"},
        ]
        candidates = inventory.candidate_groups(examples)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0]["decision"], "CANDIDATE_ONLY")
        self.assertEqual(len(candidates[0]["files"]), 2)

    def test_policy_job_scan_rejects_missing_job(self):
        (self.root / ".github/workflows/ci.yml").write_text("jobs:\n  quality:\n    run: echo hi\n")
        with self.assertRaises(inventory.InventoryError):
            inventory.policy_inventory(self.root)


if __name__ == "__main__":
    unittest.main()
