#!/usr/bin/env python3
"""Issue #836: exact Main Full publication is required for PR-origin Release."""
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
import verify_ci_image_release as release
from ci_image_reuse import Blocked

MAIN = "a" * 40
REVISION = "b" * 40
DIGEST = "sha256:" + "d" * 64


def good_jobs():
    return ([{"name": name, "conclusion": "success"} for name in release.REQUIRED]
            + [{"name": release.MAIN_DOCKER_JOB, "conclusion": "success"},
               {"name": release.MAIN_IMAGE_JOB, "conclusion": "success"}])


class MainCandidateMappingTest(unittest.TestCase):
    def run_verifier(self, *, source_digest=DIGEST, run_status="success",
                     main_jobs=None, runs=1):
        source = {"index_digest": source_digest, "source_revision": REVISION,
                  "main_sha": MAIN, "source_run_id": 123, "source_run_attempt": 2}
        workflow_runs = [
            {"id": 44+i, "run_attempt": 1, "head_sha": MAIN, "event": "push",
             "path": ".github/workflows/ci.yml", "status": "completed",
             "conclusion": run_status} for i in range(runs)]
        with mock.patch.object(release, "verify_source", return_value=source), \
             mock.patch.object(release, "page_items",
                               side_effect=[workflow_runs, main_jobs or good_jobs()]*1):
            with tempfile.TemporaryDirectory() as tmp:
                return release.validate_release_source(
                    "planner77/masterGantt", MAIN, "0.136.0", REVISION,
                    DIGEST, "token", pathlib.Path(tmp))

    def test_positive_all_required_and_main_publish_success(self):
        report = self.run_verifier()
        self.assertEqual(report["main_run_id"], 44)
        self.assertEqual(report["source_run_attempt"], 2)

    def test_wrong_oci_digest_blocks(self):
        with self.assertRaisesRegex(Blocked, "SUBJECT"):
            self.run_verifier(source_digest="sha256:" + "e" * 64)

    def test_no_main_full_success_blocks(self):
        with self.assertRaisesRegex(Blocked, "MAIN_PUBLISH"):
            self.run_verifier(run_status="failure")

    def test_missing_publisher_job_blocks(self):
        jobs = [j for j in good_jobs() if j["name"] != release.MAIN_IMAGE_JOB]
        with self.assertRaisesRegex(Blocked, "MAIN_PUBLISH"):
            self.run_verifier(main_jobs=jobs)

    def test_synthetic_main_source_sha_cannot_be_passed(self):
        with self.assertRaisesRegex(Blocked, "INVALID"):
            self.run_verifier(source_digest=DIGEST[:12])


if __name__ == "__main__":
    unittest.main()
