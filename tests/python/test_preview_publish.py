"""Issue #703: Preview authorization, source identity and release isolation."""
from __future__ import annotations

import os
import re
import tempfile
import unittest
from pathlib import Path

from scripts import preview_publish as p

SHA = "a" * 40
MAIN = "b" * 40
ISSUE = "703"
BRANCH = "ci/issue-703-preview-publish"


def fixtures():
    request = p.parse_request(ISSUE, BRANCH, SHA)
    repo = {"full_name": p.EXPECTED_REPO, "default_branch": "main"}
    issue = {"number": 703, "state": "open"}
    branch = {"name": BRANCH, "commit": {"sha": SHA}}
    default = {"name": "main", "commit": {"sha": MAIN}}
    identity = {
        "actor": "planner77", "owner": "planner77",
        "event_name": "workflow_dispatch", "ref": "refs/heads/main",
        "workflow_sha": MAIN, "repository": p.EXPECTED_REPO,
    }
    return request, repo, issue, branch, default, identity


class RequestTests(unittest.TestCase):
    def test_valid_exact_identity(self):
        out = p.validate_snapshot(*fixtures()[:5], **fixtures()[5])
        self.assertEqual(out["source_sha"], SHA)
        self.assertEqual(out["image_name"], "ghcr.io/planner77/mastergantt-preview")
        self.assertEqual(out["image_ref"], f"ghcr.io/planner77/mastergantt-preview:issue-703-{SHA}")
        self.assertNotIn(":ci-", out["image_ref"])
        self.assertNotIn(":latest", out["image_ref"])

    def test_bad_issue_sha_and_branch(self):
        for issue, branch, sha in [
            ("0", BRANCH, SHA), ("0703", BRANCH, SHA),
            ("703", BRANCH, "a" * 39), ("703", BRANCH, "A" * 40),
            ("703", "main", SHA), ("703", "ci/issue-704-preview", SHA),
            ("703", "ci/issue-703/../main", SHA),
            ("703", "ci//issue-703", SHA),
            ("703", "ci/issue-703.lock", SHA),
        ]:
            with self.subTest(issue=issue, branch=branch, sha=sha):
                with self.assertRaises(p.Blocked):
                    p.parse_request(issue, branch, sha)

    def test_negative_snapshot_cases_fail_closed(self):
        changes = [
            ("actor", "other"),
            ("event_name", "pull_request"),
            ("ref", "refs/heads/ci/issue-703-preview"),
            ("workflow_sha", "c" * 40),
            ("repository", "other/masterGantt"),
        ]
        for key, value in changes:
            with self.subTest(key=key):
                request, repo, issue, branch, default, identity = fixtures()
                identity[key] = value
                with self.assertRaises(p.Blocked):
                    p.validate_snapshot(request, repo, issue, branch, default, **identity)

        for kind in ("issue_closed", "issue_pr", "branch_changed", "main_changed",
                     "repo_changed", "branch_mismatch"):
            with self.subTest(kind=kind):
                request, repo, issue, branch, default, identity = fixtures()
                if kind == "issue_closed":
                    issue["state"] = "closed"
                elif kind == "issue_pr":
                    issue["pull_request"] = {"url": "fake"}
                elif kind == "branch_changed":
                    branch["commit"]["sha"] = "c" * 40
                elif kind == "main_changed":
                    default["commit"]["sha"] = "c" * 40
                elif kind == "repo_changed":
                    repo["full_name"] = "other/masterGantt"
                else:
                    branch["name"] = "feat/issue-703-other"
                with self.assertRaises(p.Blocked):
                    p.validate_snapshot(request, repo, issue, branch, default, **identity)

    def test_remote_authorization_and_recheck(self):
        req, repo, issue, branch, default, identity = fixtures()
        env = {
            "ISSUE_NUMBER": ISSUE,
            "SOURCE_BRANCH": BRANCH,
            "SOURCE_SHA": SHA,
            "GH_TOKEN": "placeholder-token",
            "GITHUB_ACTOR": identity["actor"],
            "GITHUB_REPOSITORY_OWNER": identity["owner"],
            "GITHUB_EVENT_NAME": identity["event_name"],
            "GITHUB_REF": identity["ref"],
            "GITHUB_SHA": identity["workflow_sha"],
            "GITHUB_REPOSITORY": identity["repository"],
        }
        def fetch(path, token):
            self.assertEqual(token, "placeholder-token")
            if path.endswith("/branches/main"):
                return default
            if path.endswith("/branches/ci%2Fissue-703-preview-publish"):
                return branch
            if path.endswith("/issues/703"):
                return issue
            return repo

        result = p.authorize(env, fetch)
        self.assertEqual(result["image_tag"], "issue-703-" + SHA)
        branch["commit"]["sha"] = "c" * 40
        with self.assertRaises(p.Blocked):
            p.authorize(env, fetch)

    def test_github_errors_do_not_become_absence(self):
        with self.assertRaises(p.Blocked):
            p.github_json("/repos/not-present", "")

    def test_manifest_status_only_404_is_absent(self):
        output = p.validate_snapshot(*fixtures()[:5], **fixtures()[5])
        for code in (200, 401, 403, 429, 500):
            with self.subTest(code=code), self.assertRaises(p.Blocked):
                p.assert_absent(output, "planner77", "placeholder",
                                lookup=lambda *args: code)
        p.assert_absent(output, "planner77", "placeholder", lookup=lambda *args: 404)

    def test_output_is_one_line_per_key(self):
        output = p.validate_snapshot(*fixtures()[:5], **fixtures()[5])
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "output")
            p.write_output(output, path)
            emitted = Path(path).read_text()
            for key, value in output.items():
                self.assertIn(key + "=" + value + "\n", emitted)
            with self.assertRaises(p.Blocked):
                p.write_output({"unsafe": "test\ninjection"}, path)


class WorkflowContractTests(unittest.TestCase):
    def test_preview_dispatch_and_permissions_are_isolated(self):
        text = Path(".github/workflows/preview-publish.yml").read_text(encoding="utf-8")
        self.assertIn("  workflow_dispatch:", text)
        self.assertNotIn("\n  pull_request:", text)
        self.assertNotIn("\n  push:", text)
        self.assertNotIn("\n  workflow_run:", text)
        self.assertIn("cancel-in-progress: false", text)
        self.assertIn("    needs: [authorize, build]", text)
        self.assertIn("      packages: write", text)
        self.assertEqual(text.count("packages: write"), 1)
        build_segment = text.split("\n  build:", 1)[1].split("\n  publish:", 1)[0]
        self.assertNotIn("packages: write", build_segment)
        self.assertIn("push: false", build_segment)
        self.assertIn("verified", text.lower() + " verified")  # local smoke/verification documented
        self.assertIn("org.opencontainers.image.revision=", text)
        self.assertIn("io.mastergantt.preview=true", text)
        self.assertIn("trusted/scripts/verify-image-policy.sh", text)
        self.assertIn("trusted/scripts/verify-registry-api-smoke.mjs", text)
        publish_segment = text.split("\n  publish:", 1)[1]
        self.assertNotIn("docker build ", publish_segment)
        self.assertNotIn("docker run ", publish_segment)
        self.assertIn("sha256sum --check --status", publish_segment)
        self.assertIn("preview_publish.py check-absent", publish_segment)
        self.assertIn("docker push", publish_segment)
        self.assertIn("UNVERIFIED_PREVIEW", publish_segment)
        self.assertNotIn("release-image", publish_segment.lower())


if __name__ == "__main__":
    unittest.main()
