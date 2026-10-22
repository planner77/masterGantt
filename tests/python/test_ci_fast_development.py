"""Issue #771 Draft/Ready source, selection and Required3 negative regressions."""
import copy
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "ci_fast_development", ROOT / "scripts/ci_fast_development.py")
fast = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fast)
H, B, M = "a"*40, "b"*40, "c"*40


def fixture(action="synchronize", draft=True):
    event = {"action": action, "pull_request": {
        "draft": draft, "number": 771, "head": {"sha": H}, "base": {"sha": B}}}
    env = {"GITHUB_REPOSITORY": "planner77/masterGantt", "GITHUB_RUN_ID": "123",
           "GITHUB_RUN_ATTEMPT": "2", "GITHUB_SHA": M}
    core = {"schema": fast.IMPACT_SCHEMA,
            "policy_schema_version": 1, "source": {
                "repository": "planner77/masterGantt", "pr_number": 771,
                "run_id": 123, "run_attempt": 2, "head_sha": H,
                "base_sha": B, "test_merge_sha": M},
            "mode_recommendation": "FAST_TARGETED", "ambiguity": "NONE_FOUND",
            "risk": "MEDIUM", "test_inventory": {"merge_unit": 1, "merge_e2e": 2},
            "selected_test_ids": [
                {"id": "tests/e2e/project-search-filter.spec.ts", "kind": "CHROMIUM"}],
            "excluded_test_ids": [
                {"id": "tests/e2e/project-settings-layout-490.spec.ts"},
                {"id": "tests/features/projects/project-list-filter.test.ts"}]}
    plan = dict(core)
    plan.update(test_plan_sha256=fast.digest(core),
                evidence_status="PLAN_VERIFIED_NON_AUTHORITATIVE",
                authority=fast.AUTHORITY, trusted_e2e_shard_count=8)
    return event, env, plan


def recalc(plan):
    plan["test_plan_sha256"] = fast.digest({
        k: v for k, v in plan.items() if k not in fast.EXTRA_PLAN_KEYS
    })
    return plan


class Modes(unittest.TestCase):
    def test_ready_same_sha_triggers_full_without_push(self):
        for action in ("ready_for_review", "synchronize", "opened", "reopened"):
            self.assertEqual(fast.pr_mode(action, False), "FINAL_FULL")

    def test_draft_or_edited_not_full(self):
        for action in ("opened", "synchronize", "reopened", "converted_to_draft", "edited"):
            self.assertEqual(fast.pr_mode(action, True), "DRAFT_BLOCKED")
        self.assertEqual(fast.pr_mode("edited", False), "METADATA_ONLY")
        self.assertEqual(fast.pr_mode("closed", False), "UNKNOWN_BLOCKED")
        self.assertEqual(fast.pr_mode("ready_for_review", True), "UNKNOWN_BLOCKED")
        self.assertEqual(fast.pr_mode("synchronize", None), "UNKNOWN_BLOCKED")


class Selection(unittest.TestCase):
    def test_advisory_exact_head_base_run_attempt_and_plan(self):
        event, env, plan = fixture()
        result = fast.prepared(plan, event, env)
        self.assertEqual(result["plan_status"], "VERIFIED_BASE_POLICY_ADVISORY")
        self.assertEqual(result["browser_selection"],
                         ["tests/e2e/project-search-filter.spec.ts"])
        self.assertEqual(result["trusted_e2e_shard_count"], 8)
        self.assertEqual(result["actual_test_result"], "NOT_TESTED")
        self.assertNotEqual(result["authority"], "REQUIRED_PASS")

    def test_nondraft_and_metadata_and_ready_are_not_fast(self):
        event, env, plan = fixture()
        for action, draft in (("ready_for_review", False),
                              ("edited", False), ("synchronize", None),
                              ("ready_for_review", True), ("closed", True)):
            with self.subTest(action=action, draft=draft):
                e = copy.deepcopy(event)
                e["action"], e["pull_request"]["draft"] = action, draft
                self.assertEqual(fast.prepared(plan, e, env)["browser_selection"], [])

    def test_sha_provenance_run_attempt_repository_drift_fails_closed(self):
        event, env, plan = fixture()
        for field, value in (("GITHUB_SHA", "e"*40),
                             ("GITHUB_RUN_ATTEMPT", "3"),
                             ("GITHUB_RUN_ID", "444"),
                             ("GITHUB_REPOSITORY", "other/fork")):
            with self.subTest(field=field):
                changed = dict(env, **{field: value})
                self.assertEqual(fast.prepared(plan, event, changed)["browser_selection"], [])
        event["pull_request"]["head"]["sha"] = "d"*40
        self.assertEqual(fast.prepared(plan, event, env)["browser_selection"], [])

    def test_forged_policy_state_plan_hash_and_inventory(self):
        event, env, plan = fixture()
        corruptions = [
            {"evidence_status": "OBSERVE_ONLY"},
            {"authority": "REQUIRED_PASS"},
            {"test_plan_sha256": "bad"},
            {"mode_recommendation": "FAST_TARGETED", "selected_test_ids": []},
        ]
        for change in corruptions:
            p = dict(plan, **change)
            with self.subTest(change=change):
                self.assertEqual(fast.prepared(p, event, env)["browser_selection"], [])

    def test_full_required_unknown_docs_only_never_run_e2e(self):
        event, env, plan = fixture()
        for recommendation, ambiguity in (("FULL_REQUIRED", "NONE_FOUND"),
                                          ("FAST_TARGETED", "UNKNOWN")):
            p = recalc(dict(plan, mode_recommendation=recommendation, ambiguity=ambiguity))
            result = fast.prepared(p, event, env)
            self.assertEqual(result["browser_selection"], [])
            self.assertEqual(result["actual_test_result"], "NOT_TESTED")
        p = recalc(dict(plan, mode_recommendation="DOCS_VERIFIED",
                        selected_test_ids=[], excluded_test_ids=(
                            plan["excluded_test_ids"] + plan["selected_test_ids"])))
        self.assertEqual(fast.prepared(p, event, env)["browser_selection"], [])

    def test_path_traversal_duplicate_and_missing_selection(self):
        event, env, plan = fixture()
        for path in ("../../secrets", "tests/e2e/../evil.spec.ts",
                     "tests/e2e/missing.spec.ts; echo SECRET"):
            p = copy.deepcopy(plan)
            p["selected_test_ids"][0]["id"] = path
            self.assertEqual(fast.prepared(recalc(p), event, env)["browser_selection"], [])
        p = copy.deepcopy(plan)
        p["excluded_test_ids"][0]["id"] = p["selected_test_ids"][0]["id"]
        self.assertEqual(fast.prepared(recalc(p), event, env)["browser_selection"], [])
        p["excluded_test_ids"].pop()
        self.assertEqual(fast.prepared(recalc(p), event, env)["browser_selection"], [])


class WorkflowGuard(unittest.TestCase):
    def test_required3_fail_explicitly_for_draft_not_skip(self):
        ci = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
        self.assertIn("ready_for_review, converted_to_draft", ci)
        for check in ("Build, static checks, and unit tests",
                      "Chromium end-to-end tests",
                      "Docker build and runtime smoke test"):
            self.assertIn("name: " + check, ci)
        self.assertEqual(ci.count('if [[ "$PR_IS_DRAFT" == "true" ]]'), 3)
        self.assertEqual(ci.count("title=FINAL_FULL_REQUIRED"), 3)
        self.assertIn("github.event.pull_request.draft != true &&", ci)
        self.assertIn("DRAFT_BLOCKED", ci)
        self.assertIn("FINAL_FULL", ci)
        self.assertIn("matrix:\n        shard: [1, 2, 3, 4, 5, 6, 7, 8]", ci)
        self.assertEqual(ci.count("name: Build, static checks, and unit tests"), 1)

    def test_fast_separate_read_only_no_required_check_impersonation(self):
        fast_yml = (ROOT / ".github/workflows/pr-fast-development.yml").read_text()
        self.assertIn("name: PR Fast Development (advisory)", fast_yml)
        self.assertIn("FAST_DEVELOPMENT (non-authoritative)", fast_yml)
        self.assertIn("github.event.pull_request.draft == true", fast_yml)
        self.assertIn("cancel-in-progress: true", fast_yml)
        for forbidden in ("pull_request_target", "packages: write", "secrets.",
                          "name: Chromium end-to-end tests",
                          "name: Docker build and runtime smoke test"):
            self.assertNotIn(forbidden, fast_yml)
        self.assertIn("ref: ${{ github.event.pull_request.base.sha }}", fast_yml)
        self.assertIn("--plan-only", fast_yml)


if __name__ == "__main__":
    unittest.main()
