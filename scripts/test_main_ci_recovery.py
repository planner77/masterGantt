#!/usr/bin/env python3
"""Negative/positive evidence fixtures for Issue #639 (no network / no writes)."""
from __future__ import annotations
import os
import unittest
from dataclasses import replace
from unittest.mock import patch

import main_ci_recovery as recovery

SHA_A = "a" * 40
SHA_B = "b" * 40


def identity() -> recovery.Identity:
    return recovery.Identity("planner77/masterGantt", 616, 631, SHA_A,
                             "0.107.0", 44, SHA_B, "planner77")


def owner_comment(cid: int, authorized: bool, *, actor: str = "planner77"):
    auth = 'true' if authorized else 'false'
    return {
        "id": cid, "author_association": "OWNER",
        "user": {"login": actor},
        "body": '<!-- mastergantt-main-ci-recovery:v1 {"authorized":' + auth
                + ',"issue":616,"pr":631,"merge_sha":"' + SHA_A
                + '","expected_version":"0.107.0",'
                + '"note":"승인된 정확한 원본 병합 커밋의 CI 복구만 실행합니다."} -->',
    }


def release_comment():
    return {
        "id": 2, "author_association": "OWNER",
        "user": {"login": "planner77"},
        "body": '<!-- mastergantt-release-authorization:v1 '
                '{"authorized":true,"expected_version":"0.107.0","note":"정식 릴리스 승인"} -->',
    }


def jobs():
    return [
        {"name": name, "status": "completed", "conclusion": "success"}
        for name in (*recovery.REQUIRED, *recovery.OTHER_JOBS,
                     *(f"Chromium E2E shard {n}/6" for n in range(1, 7)))
    ]


class RecoveryTests(unittest.TestCase):
    def test_inputs_fully_scoped(self):
        payload = {"target_sha": SHA_A, "target_issue": "616", "target_pr": "631",
                   "expected_version": "0.107.0", "owner_comment_id": "44"}
        got = recovery.inputs_identity(payload, "planner77/masterGantt", SHA_B)
        self.assertEqual(got.issue, 616)
        self.assertEqual(got.sha, SHA_A)
        for field, bad in (("target_sha", "abc"), ("target_issue", "-1"),
                           ("target_pr", "one"), ("owner_comment_id", "0"),
                           ("expected_version", "latest")):
            with self.subTest(field=field), self.assertRaises(recovery.Blocked):
                recovery.inputs_identity({**payload, field: bad},
                                         "planner77/masterGantt", SHA_B)

    def test_owner_exact_and_revocation(self):
        i = identity()
        recovery.owner_decision([owner_comment(44, True), release_comment()], i, "planner77")
        for comments in (
            [owner_comment(44, True)],
            [owner_comment(43, True), release_comment()],
            [owner_comment(44, True), owner_comment(45, False), release_comment()],
            [owner_comment(44, False), release_comment()],
            [owner_comment(44, True, actor="attacker"), release_comment()],
        ):
            with self.subTest(comments=comments), self.assertRaises(recovery.Blocked):
                recovery.owner_decision(comments, i, "planner77")

    def test_no_duplicate_marker_or_unsupported_schema(self):
        forged = owner_comment(44, True)
        forged["body"] = forged["body"] + forged["body"]
        with self.assertRaises(recovery.Blocked):
            recovery.owner_decision([forged, release_comment()], identity(), "planner77")

    def test_required_aggregate_and_six_shards(self):
        recovery.checked_jobs(jobs())
        for mutation in (
            lambda js: js.pop(),
            lambda js: js.append(dict(js[0])),
            lambda js: js[0].update(conclusion="skipped"),
            lambda js: js[-1].update(status="queued"),
        ):
            value = jobs()
            mutation(value)
            with self.subTest(names=value), self.assertRaises(recovery.Blocked):
                recovery.checked_jobs(value)

    def test_dynamic_name_and_source_workflow_identity_fail_closed(self):
        # Real API shape observed on #639 Main CI #2612.1: run.name is
        # dynamic while workflow metadata name=CI and ID=356198495.
        repo = "planner77/masterGantt"
        endpoint = f"/repos/{repo}"
        workflow = {
            "id": 356198495,
            "name": "CI",
            "path": ".github/workflows/ci.yml",
            "state": "active",
        }
        run = {
            "id": 100,
            "name": "정확 Main SHA 복구 CI · Issue #616 · " + SHA_A + " · Run #2613.1",
            "display_title": "untrusted human-readable run label",
            "workflow_id": 356198495,
            "path": ".github/workflows/ci.yml",
            "repository": {"full_name": repo},
            "head_repository": {"full_name": repo},
            "event": "workflow_dispatch",
            "head_branch": "main",
            "head_sha": SHA_B,
            "status": "completed",
            "conclusion": "success",
            "run_attempt": 1,
            "actor": {"login": "planner77"},
            "html_url": "https://github.com/planner77/masterGantt/actions/runs/100",
        }
        artifact = identity().artifact(100, 1)

        def evidence(run_value=None, workflow_value=None, artifact_value=None):
            actual_run = run if run_value is None else run_value
            actual_workflow = workflow if workflow_value is None else workflow_value
            actual_artifact = artifact if artifact_value is None else artifact_value
            requests = []

            def fake_gh(path):
                requests.append(path)
                if path == endpoint + "/actions/runs/100":
                    return actual_run
                if path == endpoint + "/actions/workflows/ci.yml":
                    return actual_workflow
                raise AssertionError("unexpected network/GitHub API request: " + path)

            with patch.object(recovery, "gh", side_effect=fake_gh), \
                 patch.object(recovery, "get_attestation", return_value=actual_artifact), \
                 patch.object(recovery, "validate", side_effect=lambda i, **kw: i), \
                 patch.object(recovery, "all_jobs", return_value=jobs()), \
                 patch.object(recovery, "digest_for_tag", return_value="sha256:" + "a" * 64):
                result = recovery.completed_evidence(repo, 100, SHA_A)
            self.assertIn(endpoint + "/actions/workflows/ci.yml", requests)
            return result

        got, url, digest = evidence()
        self.assertEqual(got.sha, SHA_A)
        self.assertEqual(url, run["html_url"])
        self.assertEqual(digest, "sha256:" + "a" * 64)
        # The run's display name never authenticates its actual workflow.
        evidence(run_value={**run, "name": "CI", "display_title": "spoofed"})
        evidence(run_value={**run, "name": "arbitrary-localized-dynamic-run-name"})
        evidence(run_value={key: value for key, value in run.items() if key != "name"})

        wrong_runs = (
            {"id": 101},
            {"id": "100"},
            {"workflow_id": 356198496, "name": "CI"},
            {"workflow_id": None, "name": "CI"},
            {"workflow_id": True, "name": "CI"},
            {"workflow_id": "356198495", "name": "CI"},
            {"path": ".github/workflows/other.yml", "name": "CI"},
            {"repository": {"full_name": "attacker/masterGantt"}, "name": "CI"},
            {"head_repository": {"full_name": "attacker/masterGantt"}, "name": "CI"},
            {"event": "push"},
            {"head_branch": "feature"},
            {"status": "in_progress"},
            {"conclusion": "failure"},
            {"run_attempt": 0},
            {"run_attempt": 2},
            {"head_sha": SHA_A},
        )
        for changed in wrong_runs:
            with self.subTest(forged_run=changed), self.assertRaises(recovery.Blocked):
                evidence(run_value={**run, **changed})

        wrong_workflows = (
            {"id": 356198496},
            {"id": None},
            {"id": "356198495"},
            {"id": True},
            {"name": "not CI"},
            {"path": ".github/workflows/attacker.yml"},
            {"state": "disabled_manually"},
            {"state": None},
        )
        for changed in wrong_workflows:
            with self.subTest(forged_workflow=changed), self.assertRaises(recovery.Blocked):
                evidence(workflow_value={**workflow, **changed})

        with self.assertRaises(recovery.Blocked):
            evidence(workflow_value={})
        with self.assertRaises(recovery.Blocked):
            evidence(workflow_value=[])  # wrong API response type
        with self.assertRaises(recovery.Blocked):
            evidence(artifact_value={**artifact, "target_sha": SHA_B})
        with self.assertRaises(recovery.Blocked):
            evidence(artifact_value={**artifact, "run_attempt": 2})

    def test_read_only_registry_inventory(self):
        with patch.object(recovery, "gh", return_value=[]):
            self.assertEqual(recovery.package_tag_state("planner77/masterGantt", "ci-" + SHA_A),
                             "ABSENT")
        with patch.object(recovery, "gh", return_value=[
            {"metadata": {"container": {"tags": ["ci-" + SHA_A]}}}
        ]):
            self.assertEqual(recovery.package_tag_state("planner77/masterGantt", "ci-" + SHA_A),
                             "PRESENT")
        with patch.object(recovery, "gh", return_value=[{"metadata": {}}]):
            with self.assertRaises(recovery.Blocked):
                recovery.package_tag_state("planner77/masterGantt", "ci-" + SHA_A)

    def test_no_inherited_implicit_recovery(self):
        with patch.dict(os.environ, {}, clear=True), \
             patch.object(recovery, "discover_completed_recovery", return_value=None) as discover:
            self.assertIsNone(
                recovery.verified_recovery_from_environment("planner77/masterGantt", SHA_A))
            discover.assert_called_once_with("planner77/masterGantt", SHA_A)
        with patch.dict(os.environ,
                        {"MAIN_RECOVERY_RUN_ID": "123", "MAIN_RECOVERY_TARGET_SHA": SHA_B}):
            with self.assertRaises(recovery.Blocked):
                recovery.verified_recovery_from_environment("planner77/masterGantt", SHA_A)


    def test_finalizer_private_digest_provenance_order(self):
        from pathlib import Path
        workflow = (Path(__file__).resolve().parents[1]
                    / ".github/workflows/release-finalizer.yml").read_text(encoding="utf-8")
        finalize = workflow.split("  finalize:", 1)[1].split("\n  owner_recovery:", 1)[0]
        expected = (
            "trusted default-main checkout SHA 검증",
            "GHCR 버전 원장 조회 도구 준비",
            "비공개 GHCR 인증 (감사 + 신규 릴리스 확인)",
            "인증된 수동 Main 복구 Run·Attempt·digest 증거 확인",
            "정확한 merge lifecycle 해석 및 실행",
        )
        indices = [finalize.index(name) for name in expected]
        self.assertEqual(indices, sorted(indices))
        self.assertIn("from scripts import main_ci_recovery as recovery", finalize)
        self.assertIn("identity.source_sha == os.environ[\"SOURCE_SHA\"]", finalize)
        self.assertIn("if: github.event.workflow_run.event == 'workflow_dispatch'", finalize)

    def test_different_sha_or_old_version_not_reusable(self):
        with self.assertRaises(recovery.Blocked):
            recovery.owner_decision([owner_comment(44, True), release_comment()],
                                    replace(identity(), sha=SHA_B), "planner77")
        with self.assertRaises(recovery.Blocked):
            recovery.owner_decision([owner_comment(44, True), release_comment()],
                                    replace(identity(), version="0.108.0"), "planner77")


if __name__ == "__main__":
    unittest.main()
