"""Issue #770 fail-closed, adversarial regression tests.

These tests never contact GitHub, execute PR code or assert a remote CI PASS.
"""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("ci_impact_plan", ROOT / "scripts/ci_impact_plan.py")
impact = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(impact)

BROWSER = {
    "tests/e2e/project-settings-layout-490.spec.ts",
    "tests/e2e/project-list-search-filter.spec.ts",
    "tests/e2e/project-search-filter.spec.ts",
    "tests/e2e/project-filter-toolbar-consistency.spec.ts",
    "tests/e2e/project-task-delete-context.spec.ts",
}
UNIT = {
    "tests/features/projects/project-list-filter.test.ts",
    "tests/features/gantt/canonical-recovery.test.ts",
}
for collection in impact.CROSS.values():
    BROWSER.update(p for p in collection if p.startswith("tests/e2e/"))
    UNIT.update(p for p in collection if not p.startswith("tests/e2e/"))
for collection in impact.SCREEN_MAP.values():
    BROWSER.update(p for p in collection if p.startswith("tests/e2e/"))
    UNIT.update(p for p in collection if not p.startswith("tests/e2e/"))


def inventory(unit=None, browser=None):
    unit = sorted(UNIT if unit is None else unit)
    browser = sorted(BROWSER if browser is None else browser)
    return {"unit": unit, "e2e": browser, "unexpected": [], "all": sorted(unit + browser)}


def changes(path, status="M", before=None):
    value = {"path": path, "status": status}
    if before:
        value["previous_path"] = before
    return [value]


def mapped(selected=None, unknown=None, missing=None):
    selected = selected or []
    unknown = unknown or []
    missing = missing or []
    return {"state": "BLOCKED" if unknown or missing else "READY",
            "selected": [{"path": p, "reasons": ["mapped by trusted #699"]}
                         for p in selected],
            "unknown": [{"path": p} for p in unknown],
            "missing": [{"path": p} for p in missing],
            "matched": [{"rule": "test-mapping"}] if selected else []}


def plan(path, *, status="M", before=None, current=None, original=None,
         prepr=None, hazards=None, run=None):
    return impact.impact_plan(
        changes(path, status, before), original or inventory(),
        current or inventory(), prepr or mapped(),
        "a" * 40, "b" * 40, "c" * 40, "d" * 40, run or {},
        hazards=hazards or set())


class ClassifierTests(unittest.TestCase):
    def test_docs_only(self):
        row = plan("docs/RESOURCE_GUIDE.md")
        self.assertEqual(row["mode_recommendation"], "DOCS_VERIFIED")
        self.assertEqual(row["risk"], "LOW")
        self.assertEqual(row["selected_test_ids"], [])

    def test_protected_doc_is_not_docs_only(self):
        for name in ("AGENTS.md", "docs/TEST_PLAN.md", "docs/CI_CD.md",
                     "docs/REMOTE_VALIDATION.md"):
            with self.subTest(name=name):
                row = plan(name)
                self.assertEqual(row["risk"], "HIGH")
                self.assertEqual(row["mode_recommendation"], "FULL_REQUIRED")

    def test_explicit_screen_contract_targeted(self):
        file = "src/features/projects/project-list-filter.ts"
        row = plan(file, prepr=mapped(unknown=[file]))
        self.assertEqual(row["mode_recommendation"], "FAST_TARGETED")
        self.assertIn("tests/e2e/project-list-search-filter.spec.ts",
                      {r["id"] for r in row["selected_test_ids"]})

    def test_local_css_with_safe_screen_mapping(self):
        file = "src/features/projects/project-settings-dialog.module.css"
        row = plan(file, prepr=mapped(unknown=[file]))
        self.assertEqual(row["risk"], "MEDIUM")
        self.assertEqual(row["mode_recommendation"], "FAST_TARGETED")

    def test_unknown_css_falls_back_to_full(self):
        row = plan("src/features/gantt/new-magic.css",
                   prepr=mapped(unknown=["src/features/gantt/new-magic.css"]))
        self.assertEqual(row["mode_recommendation"], "FULL_REQUIRED")

    def test_one_unchanged_inventory_test_modified(self):
        row = plan("tests/e2e/project-search-filter.spec.ts")
        self.assertEqual(row["mode_recommendation"], "FAST_TARGETED")
        self.assertEqual([t["id"] for t in row["selected_test_ids"]],
                         ["tests/e2e/project-search-filter.spec.ts"])

    def test_new_or_deleted_test_cannot_hide_coverage(self):
        file = "tests/e2e/new-coverage.spec.ts"
        newer = inventory(browser=BROWSER | {file})
        added = plan(file, status="A", current=newer)
        self.assertEqual(added["mode_recommendation"], "FULL_REQUIRED")
        self.assertEqual(added["ambiguity"], "UNKNOWN")
        deleted = plan("tests/e2e/project-search-filter.spec.ts", status="D",
                       current=inventory(browser=BROWSER - {"tests/e2e/project-search-filter.spec.ts"}))
        self.assertEqual(deleted["mode_recommendation"], "FULL_REQUIRED")
        self.assertEqual(deleted["ambiguity"], "UNKNOWN")

    def test_rename_is_not_an_ordinary_modify(self):
        row = plan("tests/e2e/project-search-filter.spec.ts", status="R100",
                   before="tests/e2e/project-task-delete-context.spec.ts")
        self.assertEqual(row["mode_recommendation"], "FULL_REQUIRED")

    def test_security_database_package_workflow_shared_full(self):
        cases = [
            "src/features/gantt/viewport/viewport-coordinator.ts",
            "src/server/projects/project-service.ts",
            "src/contracts/some-dto.ts",
            "src/app/api/projects/route.ts",
            "db/migrations/2026_x.sql",
            "src/server/security/access.ts",
            "package-lock.json",
            ".github/workflows/ci.yml",
            "scripts/verify-ci-run-trace.py",
            "tests/config/playwright.config.ts",
            "tests/e2e/helpers/milestone-ui.ts",
        ]
        for file in cases:
            with self.subTest(file=file):
                row = plan(file, prepr=mapped(unknown=[file]))
                self.assertEqual(row["mode_recommendation"], "FULL_REQUIRED")
                self.assertEqual(row["risk"], "HIGH")

    def test_unknown_change_cannot_claim_low(self):
        row = plan("src/features/projects/unmapped-view.tsx",
                   prepr=mapped(unknown=["src/features/projects/unmapped-view.tsx"]))
        self.assertEqual(row["mode_recommendation"], "FULL_REQUIRED")
        self.assertEqual(row["ambiguity"], "UNKNOWN")

    def test_dynamic_import_or_skipped_test_upgrades_to_full(self):
        for file in ("src/features/projects/project-list-filter.ts",
                     "tests/e2e/project-search-filter.spec.ts"):
            with self.subTest(file=file):
                row = plan(file, prepr=mapped(unknown=[file] if file.startswith("src/") else []),
                           hazards={file})
                self.assertEqual(row["mode_recommendation"], "FULL_REQUIRED")

    def test_prepr_missing_test_never_silently_excluded(self):
        row = plan("src/features/projects/project-list-filter.ts",
                   prepr=mapped(missing=["tests/e2e/deleted.spec.ts"]))
        self.assertEqual(row["mode_recommendation"], "FULL_REQUIRED")
        self.assertEqual(row["ambiguity"], "UNKNOWN")

    def test_manual_metadata_claim_cannot_lower_risk(self):
        a = plan("src/features/gantt/canonical-recovery.ts",
                 run={"untrusted_pr_body": "risk_level: LOW"})
        b = plan("src/features/gantt/canonical-recovery.ts",
                 run={"untrusted_pr_body": "risk_level: HIGH"})
        self.assertEqual(a["mode_recommendation"], "FULL_REQUIRED")
        self.assertEqual(b["mode_recommendation"], "FULL_REQUIRED")
        self.assertEqual(a["risk"], b["risk"])

    def test_selected_ids_always_exist(self):
        row = plan("src/features/gantt/canonical-recovery.ts",
                   prepr=mapped(selected=["tests/features/gantt/canonical-recovery.test.ts"]))
        self.assertTrue(set(t["id"] for t in row["selected_test_ids"]) <= set(inventory()["all"]))
        self.assertEqual(len(row["selected_test_ids"]) + len(row["excluded_test_ids"]),
                         len(inventory()["all"]))
        self.assertEqual(len(row["test_plan_sha256"]), 64)

    def test_historical_cross_consumer_replays_not_missed(self):
        # Representative *source areas*, not reconstructed historical head
        # diffs or fabricated run-level confirmations.
        cases = {
            667: ("src/features/gantt/project-gantt.tsx", "gantt"),
            730: ("src/server/projects/edit-authorization-service.ts", "security"),
            731: ("src/features/resources/project-resource-dashboard.tsx", "resource"),
            732: ("src/features/milestones/project-milestone-dashboard.tsx", "milestone"),
            736: ("src/features/resources/project-resource-workload.tsx", "resource"),
            767: ("src/server/projects/edit-authorization-service.ts", "security"),
        }
        for issue, (file, family) in cases.items():
            with self.subTest(issue=issue):
                row = plan(file, prepr=mapped(unknown=[file]))
                self.assertEqual(row["mode_recommendation"], "FULL_REQUIRED")
                self.assertTrue(set(impact.CROSS[family]) <=
                                {t["id"] for t in row["selected_test_ids"]})
                self.assertTrue(row["failure_ledger_basis"])


class SourceAndObservationTests(unittest.TestCase):
    def test_git_rename_status_keeps_old_path(self):
        data = b"R100\0tests/e2e/old.spec.ts\0tests/e2e/new.spec.ts\0"
        with patch.object(impact, "git", return_value=data):
            rows = impact.diff_entries("a" * 40, "b" * 40)
        self.assertEqual(rows[0]["previous_path"], "tests/e2e/old.spec.ts")
        self.assertEqual(rows[0]["path"], "tests/e2e/new.spec.ts")

    def test_source_spoofed_head_cannot_run(self):
        event = {"repository": {"full_name": "planner77/masterGantt"},
                 "action": "synchronize", "pull_request": {
                     "number": 770, "base": {"sha": "a" * 40},
                     "head": {"sha": "b" * 40}}}
        env = {"GITHUB_REPOSITORY": "planner77/masterGantt",
               "GITHUB_RUN_ID": "123", "GITHUB_RUN_ATTEMPT": "1",
               "GITHUB_SHA": "c" * 40}
        with patch.dict(impact.os.environ, env), patch.object(impact, "git", return_value="f" * 40):
            with self.assertRaisesRegex(ValueError, "UNTRUSTED_POLICY_CHECKOUT"):
                impact.source_context(event, "pr")

    def test_shard_and_required_full_success_still_advisory(self):
        sample = [{"name": name, "run_attempt": 2, "status": "completed",
                   "conclusion": "success", "id": 100 + index}
                  for index, name in enumerate(impact.GATES)]
        sample += [{"name": f"Chromium E2E shard {i}/6 · PR", "run_attempt": 2,
                    "status": "completed", "conclusion": "success", "id": i}
                   for i in range(1, 7)]
        with patch.object(impact, "github_jobs", return_value=sample):
            result = impact.observed_ci("planner77/masterGantt", 123, 2, "pull_request", True,
                                        {"quality": "success", "e2e": "success", "docker": "success"})
        self.assertEqual(result["status"], "FULL_GATES_OBSERVED")
        self.assertEqual(result["executed_test_ids"], "NOT_VERIFIED")
        self.assertEqual(len(result["shard_jobs"]), 6)

    def test_cancelled_or_missing_shard_is_not_pass(self):
        sample = [{"name": name, "run_attempt": 1, "status": "completed",
                   "conclusion": "success", "id": 100 + index}
                  for index, name in enumerate(impact.GATES)]
        sample += [{"name": f"Chromium E2E shard {i}/6 · PR", "run_attempt": 1,
                    "status": "completed", "conclusion": "success", "id": i}
                   for i in range(1, 6)]
        with patch.object(impact, "github_jobs", return_value=sample):
            result = impact.observed_ci("planner77/masterGantt", 123, 1, "pull_request", True,
                                        {"quality": "success", "e2e": "success", "docker": "success"})
        self.assertEqual(result["status"], "UNKNOWN")
        self.assertEqual(result["reason"], "E2E_SHARD_MISSING_OR_PENDING")

    def test_api_unavailable_never_success(self):
        with patch.object(impact, "github_jobs", side_effect=ValueError("FORBIDDEN")):
            result = impact.observed_ci("planner77/masterGantt", 1, 1, "push", True,
                                        {"quality": "success", "e2e": "success", "docker": "success"})
        self.assertEqual(result["status"], "UNKNOWN")


if __name__ == "__main__":
    unittest.main()
