#!/usr/bin/env python3
"""Issue #629 preflight contract tests: synthetic replays, no network."""
import copy
import unittest
from pathlib import Path

import qa_final_automated as qa
import qa_preflight as preflight

H = "a" * 40
B = "b" * 40
N = 629


def packet(doc_entries=None):
    docs = sorted(qa.QA_DOCS) if doc_entries is None else doc_entries
    return ("# Issue #629\n\n## DOCUMENTATION_SYNC\n" +
            "".join(f"- \x60{doc}\x60: UPDATED\n" for doc in docs) +
            "\n## AC_TEST_COVERAGE\n" +
            "".join(f"- AC{i}: scripts/test_qa_preflight.py 시나리오와 원격 검증 PENDING\n"
                    for i in range(1, 9)))


class GH:
    repo = "planner77/masterGantt"
    prefix = "/repos/planner77/masterGantt"

    def __init__(self):
        self.pr = {
            "number": N, "state": "open",
            "title": "[Issue #629] QA Preflight",
            "body": ("Refs #629\nrisk_level: HIGH\nqa_method: OWNER_MANAGED\n"
                     "qa_required: true\nrelease_required: false\nrelease_authorized: false\n"),
            "head": {"sha": H, "ref": "ci/issue-629-qa-preflight"},
            "base": {"sha": B, "ref": "main", "repo": {"full_name": self.repo}},
            "mergeable": True,
        }
        self.files = [{"filename": "scripts/qa_preflight.py"}] + [
            {"filename": x} for x in sorted(qa.QA_DOCS)]
        self.plan = packet()
        self.issue = {"body": "\n".join(f"- AC{i}: 검증" for i in range(1, 9))}
        self.calls = []

    def get(self, route):
        self.calls.append(route)
        if route.endswith(f"/pulls/{N}"):
            return self.pr
        if route.endswith(f"/issues/{N}"):
            return self.issue
        raise AssertionError("Unexpected GitHub API path: " + route)

    def pages(self, route):
        self.calls.append(route)
        if route.endswith(f"/pulls/{N}/files"):
            return self.files
        raise AssertionError("Unexpected GitHub pagination: " + route)

    def head_text(self, path, sha):
        assert path == f"docs/exec-plans/active/ISSUE_{N}.md"
        assert sha == H
        return self.plan


def event():
    return {"action": "opened", "number": N,
            "pull_request": {"number": N, "head": {"sha": H},
                             "base": {"sha": B}}}


def env():
    return {"GITHUB_EVENT_NAME": "pull_request",
            "PR_NUMBER": str(N), "EVENT_HEAD_SHA": H, "EVENT_BASE_SHA": B,
            "GITHUB_RUN_ID": "38179746368", "GITHUB_RUN_ATTEMPT": "1"}


def failure(result, code):
    return [c for c in result["checks"]
            if c["status"] == "FAIL" and c["name"] == code]


class Contract(unittest.TestCase):
    def test_owner_managed_protected_pass_preflight_but_not_owner_approval(self):
        gh = GH()
        result = preflight.check(event(), env(), gh)
        self.assertEqual(result["status"], "PASS")
        self.assertIn("scripts/qa_preflight.py", result["protected_paths"])
        self.assertEqual(result["risk_floor"], "HIGH")
        self.assertEqual(result["qa_method"], "OWNER_MANAGED")
        self.assertGreaterEqual(sum(c["status"] == "DEFERRED"
                                    for c in result["checks"]), 4)
        self.assertNotIn("MERGE_READY=PASS", result["decision"])
        self.assertTrue(all("/actions/runs/" not in call for call in gh.calls))

    def test_replay_550_2373_primary_title_refs_before_heavy(self):
        # Failure category from #2373.1, not a claim of original full payload.
        gh = GH()
        gh.pr["title"] = "feat: Milestone 독립 관리"  # missing Issue #550
        gh.pr["body"] = gh.pr["body"].replace("Refs #629", "Refs #550")
        result = preflight.check(event(), env(), gh)
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(failure(result, "PRIMARY_ISSUE"))

    def test_replay_626_2522_missing_required_docs_before_heavy(self):
        # #2522.1 category: docs/GITHUB_OPERATIONS.md was not recorded.
        gh = GH()
        gh.plan = packet([x for x in sorted(qa.QA_DOCS)
                          if x != "docs/GITHUB_OPERATIONS.md"])
        result = preflight.check(event(), env(), gh)
        self.assertEqual(result["status"], "FAIL")
        self.assertIn("docs/GITHUB_OPERATIONS.md",
                      failure(result, "DOCUMENTATION_SYNC")[0]["reason"])
        gh.plan = packet()
        self.assertEqual(preflight.check(event(), env(), gh)["status"], "PASS")

    def test_policy_risk_required_and_mode_distinct(self):
        gh = GH()
        gh.pr["body"] = gh.pr["body"].replace("risk_level: HIGH", "risk_level: LOW")
        gh.pr["body"] = gh.pr["body"].replace("qa_required: true", "qa_required: false")
        result = preflight.check(event(), env(), gh)
        self.assertTrue(failure(result, "PATH_POLICY"))
        gh.pr["body"] = gh.pr["body"].replace("risk_level: LOW", "risk_level: HIGH")
        gh.pr["body"] = gh.pr["body"].replace("qa_method: OWNER_MANAGED", "qa_method: AGENT")
        self.assertTrue(failure(preflight.check(event(), env(), gh), "PATH_POLICY"))
        gh.pr["body"] = gh.pr["body"].replace("qa_required: false", "qa_required: true")
        self.assertEqual(preflight.check(event(), env(), gh)["status"], "PASS")

    def test_doubles_invalid_enum_and_release_contradiction(self):
        gh = GH()
        gh.pr["body"] += "qa_method: AGENT\n"
        self.assertTrue(failure(preflight.check(event(), env(), gh), "QA_METHOD"))
        gh.pr["body"] = gh.pr["body"].replace("qa_method: AGENT\n", "")
        gh.pr["body"] = gh.pr["body"].replace("qa_required: true", "qa_required: maybe")
        self.assertTrue(failure(preflight.check(event(), env(), gh), "QA_REQUIRED"))
        gh.pr["body"] = gh.pr["body"].replace("qa_required: maybe", "qa_required: true")
        gh.pr["body"] = gh.pr["body"].replace("release_authorized: false",
                                           "release_authorized: true")
        self.assertTrue(failure(preflight.check(event(), env(), gh), "PATH_POLICY"))

    def test_renamed_protected_execution_path(self):
        gh = GH()
        gh.files = [{"filename": "docs/moved.md",
                     "previous_filename": "scripts/qa_final_automated.py",
                     "status": "renamed"}] + [
                         {"filename": x} for x in sorted(qa.QA_DOCS)]
        result = preflight.check(event(), env(), gh)
        self.assertEqual(result["status"], "PASS")
        self.assertIn("scripts/qa_final_automated.py", result["protected_paths"])

    def test_merge_conflict_fail_pending_is_deferred(self):
        gh = GH()
        gh.pr["mergeable"] = False
        self.assertTrue(failure(preflight.check(event(), env(), gh), "MERGE_CONFLICT"))
        gh.pr["mergeable"] = None
        result = preflight.check(event(), env(), gh)
        self.assertEqual(result["status"], "PASS")
        self.assertIn("DEFERRED", [c["status"] for c in result["checks"]
                                   if c["name"] == "MERGE_CONFLICT"])

    def test_stale_head_base_and_api_fail_closed(self):
        gh = GH()
        gh.pr["head"]["sha"] = "c" * 40
        with self.assertRaises(qa.Blocked):
            preflight.check(event(), env(), gh)
        gh.pr["head"]["sha"] = H
        gh.pr["base"]["sha"] = "c" * 40
        with self.assertRaises(qa.Blocked):
            preflight.check(event(), env(), gh)
        gh.pr["base"]["sha"] = B
        gh.pr["base"]["repo"]["full_name"] = "other/fork"
        with self.assertRaises(qa.Blocked):
            preflight.check(event(), env(), gh)
        gh.pr["base"]["repo"]["full_name"] = gh.repo
        gh.head_text = lambda *args: (_ for _ in ()).throw(
            qa.Blocked("BLOCKED", "API outage"))
        with self.assertRaises(qa.Blocked):
            preflight.check(event(), env(), gh)

    def test_event_boundary(self):
        gh = GH()
        for action in ("edited", "closed", ""):
            e = event()
            e["action"] = action
            with self.assertRaises(qa.Blocked):
                preflight.check(e, env(), gh)
        e = event()
        e["pull_request"]["base"]["sha"] = "z" * 40
        with self.assertRaises(qa.Blocked):
            preflight.check(e, env(), gh)

    def test_workflow_aggregate_guard_contract(self):
        ci = (Path(__file__).resolve().parents[1] / ".github/workflows/ci.yml").read_text(
            encoding="utf-8")
        self.assertIn("  preflight:\n", ci)
        self.assertIn("needs: [changes, preflight, metadata_evidence, policy,", ci)
        self.assertIn("needs: [changes, preflight, metadata_evidence, e2e_shard, pr_e2e_shard, pr_fast_gate]", ci)
        self.assertIn("needs: [changes, preflight, metadata_evidence, docker_smoke, pr_docker_smoke, pr_fast_gate]", ci)
        self.assertGreaterEqual(ci.count('"$PREFLIGHT" != "success"'), 3)
        self.assertIn("scripts/test_qa_preflight.py", ci)
        # Compare against literal Actions syntax; an escaped dollar prefix
        # would always fail despite a valid bootstrap workflow.
        self.assertIn("ref: ${{ github.event.pull_request.base.sha }}", ci)
        self.assertNotIn("ref: \\$"+"{{ github.event.pull_request.base.sha }}", ci)


if __name__ == "__main__":
    unittest.main()
