#!/usr/bin/env python3
"""Issue #659: fail-closed PR gate scenarios and workflow wiring contracts."""
from __future__ import annotations

import re
import unittest
from pathlib import Path

from pr_fast_gate import assess

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/ci.yml"


def job(source: str, name: str) -> str:
    match = re.search(r"^  " + re.escape(name) + r":\n", source, re.MULTILINE)
    if not match:
        raise AssertionError(f"Workflow Job 미발견: {name}")
    remainder = source[match.end():]
    end = re.search(r"^  [a-zA-Z0-9_-]+:\n", remainder, re.MULTILINE)
    return remainder[:end.start()] if end else remainder


class FastGateDecision(unittest.TestCase):
    def setUp(self):
        self.ok = {
            "CHANGES_RESULT": "success",
            "PREFLIGHT_RESULT": "success",
            "POLICY_REQUIRED": "true",
            "POLICY_RESULT": "success",
            "NODE_REQUIRED": "true",
            "TYPECHECK_RESULT": "success",
            "LINT_RESULT": "success",
            "UNIT_RESULT": "success",
        }

    def test_all_required_success(self):
        self.assertEqual(assess(self.ok), [])

    def test_preflight_or_changes_not_success_never_passes(self):
        for field in ("CHANGES_RESULT", "PREFLIGHT_RESULT"):
            for state in ("failure", "cancelled", "skipped", ""):
                with self.subTest(field=field, state=state):
                    self.assertTrue(assess({**self.ok, field: state}))

    def test_each_required_failure_cancellation_or_skip_blocks(self):
        for field in ("POLICY_RESULT", "TYPECHECK_RESULT", "LINT_RESULT", "UNIT_RESULT"):
            for state in ("failure", "cancelled", "skipped", "", "pending"):
                with self.subTest(field=field, state=state):
                    self.assertTrue(assess({**self.ok, field: state}))

    def test_required_false_is_valid_skip_only(self):
        values = {
            **self.ok,
            "POLICY_REQUIRED": "false",
            "POLICY_RESULT": "skipped",
            "NODE_REQUIRED": "false",
            "TYPECHECK_RESULT": "skipped",
            "LINT_RESULT": "skipped",
            "UNIT_RESULT": "skipped",
        }
        self.assertEqual(assess(values), [])
        for field in ("POLICY_RESULT", "UNIT_RESULT"):
            with self.subTest(field=field):
                self.assertTrue(assess({**values, field: "success"}))

    def test_invalid_route_outputs_are_fail_closed(self):
        for field in ("POLICY_REQUIRED", "NODE_REQUIRED"):
            for value in ("", "unknown", "True", "skipped"):
                with self.subTest(field=field, value=value):
                    self.assertTrue(assess({**self.ok, field: value}))


class WorkflowContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.yaml = WORKFLOW.read_text(encoding="utf-8")

    def test_main_and_manual_jobs_not_gated(self):
        for name in ("build", "e2e_shard", "docker_smoke"):
            lane = job(self.yaml, name)
            self.assertIn("github.event_name != 'pull_request'", lane)
            self.assertIn("needs: [changes, preflight]", lane)
            self.assertNotIn("needs: [changes, preflight, pr_fast_gate]", lane)
        self.assertIn("fail-fast: false", job(self.yaml, "e2e_shard"))
        self.assertIn("fail-fast: true", job(self.yaml, "pr_e2e_shard"))
        self.assertIn("shard: [1, 2, 3, 4, 5, 6]", job(self.yaml, "pr_e2e_shard"))

    def test_pr_lane_blocks_on_fast_gate(self):
        for name in ("pr_build", "pr_e2e_shard", "pr_docker_smoke"):
            lane = job(self.yaml, name)
            self.assertIn("github.event_name == 'pull_request'", lane)
            self.assertIn("github.event.action != 'edited'", lane)
            self.assertIn("needs.pr_fast_gate.result == 'success'", lane)
            self.assertIn("needs: [changes, preflight, pr_fast_gate]", lane)
        gate = job(self.yaml, "pr_fast_gate")
        self.assertIn("needs: [changes, preflight, policy, typecheck, lint, unit]", gate)
        self.assertIn("run: python3 scripts/pr_fast_gate.py", gate)
        self.assertIn("if: >-", gate)

    def test_anchors_do_not_duplicate_heavy_steps(self):
        for common in ("build_steps", "e2e_shard_steps", "docker_smoke_steps"):
            self.assertEqual(self.yaml.count("steps: &" + common), 1)
            self.assertEqual(self.yaml.count("steps: *" + common), 1)
        self.assertIn("e2e-timing-ci-shard-", job(self.yaml, "e2e_shard"))
        self.assertIn("playwright-report-shard-", job(self.yaml, "e2e_shard"))

    def test_required_aggregates_are_fail_closed(self):
        for gate, pr, original in (
            ("quality", "pr_build", "build"),
            ("e2e", "pr_e2e_shard", "e2e_shard"),
            ("docker", "pr_docker_smoke", "docker_smoke"),
        ):
            with self.subTest(gate=gate):
                content = job(self.yaml, gate)
                self.assertIn("if: always()", content)
                self.assertIn("pr_fast_gate", content)
                self.assertIn("PR_FAST_GATE:", content)
                self.assertIn('"$PR_FAST_GATE" != "success"', content)
                self.assertIn("needs." + pr + ".result", content)
                self.assertIn("needs." + original + ".result", content)
        for label in (
            "Build, static checks, and unit tests",
            "Chromium end-to-end tests",
            "Docker build and runtime smoke test",
        ):
            self.assertIn("name: " + label, self.yaml)
        publish = job(self.yaml, "publish-commit-image")
        for gate in ("quality", "e2e", "docker"):
            self.assertIn("needs." + gate + ".result == 'success'", publish)

    def test_pr_job_labels_are_unique_and_trusted_names_are_preserved(self):
        """P1 #660: skipped legacy jobs also appear in exact Actions attempts.

        Keep Main recovery's legacy names and the trusted default-main QA
        validator's exact PR Docker name without weakening either verifier.
        """
        main_build = job(self.yaml, "build")
        pr_build = job(self.yaml, "pr_build")
        main_e2e = job(self.yaml, "e2e_shard")
        pr_e2e = job(self.yaml, "pr_e2e_shard")
        main_docker = job(self.yaml, "docker_smoke")
        pr_docker = job(self.yaml, "pr_docker_smoke")
        self.assertIn("    name: Next.js production build\n", main_build)
        self.assertIn("    name: PR Next.js production build\n", pr_build)
        self.assertIn("    name: Chromium E2E shard ${{ matrix.shard }}/6\n", main_e2e)
        self.assertIn("    name: Chromium E2E shard ${{ matrix.shard }}/6 · PR\n", pr_e2e)
        self.assertIn(
            "name: ${{ github.event_name == 'pull_request' && "
            "'Main Docker smoke (PR 비대상)' || 'Docker smoke 구현' }}",
            main_docker,
        )
        self.assertIn("    name: Docker smoke 구현\n", pr_docker)

        from qa_final_automated import effective_run_jobs, Blocked
        from main_ci_recovery import OTHER_JOBS
        self.assertIn("Docker smoke 구현", OTHER_JOBS)
        self.assertIn("Next.js production build", OTHER_JOBS)
        names = [
            ("Next.js production build", "skipped"),
            ("PR Next.js production build", "success"),
            ("Main Docker smoke (PR 비대상)", "skipped"),
            ("Docker smoke 구현", "success"),
            ("Chromium E2E shard ${{ matrix.shard }}/6", "skipped"),
            *( (f"Chromium E2E shard {shard}/6 · PR", "success")
               for shard in range(1, 7)),
        ]
        class Attempt:
            prefix = "/repos/planner77/masterGantt"

            def __init__(self, rows):
                self.rows = rows

            def collection(self, route, key):
                assert key == "jobs"
                assert route.endswith("/actions/runs/88/attempts/1/jobs")
                return [{"name": name, "status": "completed",
                         "conclusion": outcome}
                        for name, outcome in self.rows]

        source = effective_run_jobs(Attempt(names), 88, 1)
        self.assertEqual(len(source), len(names))
        self.assertEqual(source["Docker smoke 구현"]["conclusion"], "success")
        self.assertTrue(any(
            name.startswith("Chromium E2E shard ") and job_data["conclusion"] == "success"
            for name, job_data in source.items()
        ))
        # Old failing #2690 names must remain a hard error, not silently collapsed.
        with self.assertRaises(Blocked):
            effective_run_jobs(
                Attempt(names + [("Docker smoke 구현", "skipped")]), 88, 1
            )

    def test_metadata_and_preflight_boundaries(self):
        self.assertIn("github.event.action == 'edited'", job(self.yaml, "metadata_evidence"))
        self.assertIn("needs.preflight.result == 'success'", job(self.yaml, "policy"))
        for gate in ("quality", "e2e", "docker"):
            self.assertIn('if [[ "$METADATA_ONLY" == "true" ]]', job(self.yaml, gate))


if __name__ == "__main__":
    unittest.main()
