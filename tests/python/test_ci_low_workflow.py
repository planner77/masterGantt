#!/usr/bin/env python3
"""Issue #772 regression: LOW evidence env wiring and Full8 fallback contract."""
from pathlib import Path
import unittest

CI = (Path(__file__).resolve().parents[2] / ".github/workflows/ci.yml").read_text(
    encoding="utf-8")


def section(name: str, next_name: str) -> str:
    begin, end = f"  {name}:\n", f"  {next_name}:\n"
    assert CI.count(begin) == 1 and CI.count(end) == 1
    return CI.split(begin, 1)[1].split(end, 1)[0]


class WorkflowGuardTest(unittest.TestCase):
    def test_default_off_requires_original_full8(self):
        plan = section("low_e2e_plan", "low_e2e_targeted")
        full = section("pr_e2e_shard", "e2e")
        self.assertIn("vars.LOW_TARGETED_POLICY_ENABLED == 'true'", plan)
        self.assertIn("mode=FULL_REQUIRED", plan)
        self.assertIn("needs.low_e2e_plan.outputs.mode != 'TARGETED_POLICY_CANDIDATE'", full)
        self.assertIn("shard: [1, 2, 3, 4, 5, 6, 7, 8]", full)

    def test_no_unbound_variable_or_skipped_false_green(self):
        aggregate = section("e2e", "docker_smoke")
        for binding in (
            "          LOW_MODE: ${{ needs.low_e2e_plan.outputs.mode || '' }}",
            "          LOW_PLAN: ${{ needs.low_e2e_plan.result }}",
            "          LOW_TARGETED: ${{ needs.low_e2e_targeted.result }}",
        ):
            with self.subTest(binding=binding):
                self.assertIn(binding, aggregate)
        self.assertIn('"$LOW_MODE" == "TARGETED_POLICY_CANDIDATE"', aggregate)
        self.assertIn('"$LOW_PLAN" != "success"', aggregate)
        self.assertIn('"$LOW_TARGETED" != "success"', aggregate)
        self.assertIn('"$RESULT" != "skipped"', aggregate)
        self.assertIn('[[ "$RESULT" == "success" ]]', aggregate)
        self.assertIn("TARGETED_POLICY_VERIFIED (not FULL_E2E_PASS)", aggregate)

    def test_base_attestation_uses_same_owner_flag_as_plan(self):
        plan = section("low_e2e_plan", "low_e2e_targeted")
        targeted = section("low_e2e_targeted", "pr_e2e_shard")
        binding = "LOW_TARGETED_POLICY_ENABLED: ${{ vars.LOW_TARGETED_POLICY_ENABLED }}"
        self.assertIn(binding, plan)
        step = targeted.split("      - name: Base-policy attestation;", 1)[1].split(
            "      - name: Upload exact-Run successful targeted execution receipt", 1)[0]
        self.assertIn("        env:\n          " + binding, step)
        self.assertIn("python3 scripts/ci_low_policy.py --stage attest", step)
        self.assertIn("ref: ${{ github.event.pull_request.base.sha }}", targeted)

    def test_required_three_and_main_full8_unchanged(self):
        for title in (
            "Build, static checks, and unit tests",
            "Chromium end-to-end tests",
            "Docker build and runtime smoke test",
        ):
            self.assertIn(f"name: {title}\n", CI)
        main_e2e = section("e2e_shard", "low_e2e_plan")
        self.assertIn("github.event_name != 'pull_request'", main_e2e)
        self.assertIn("shard: [1, 2, 3, 4, 5, 6, 7, 8]", main_e2e)


if __name__ == "__main__":
    unittest.main()
