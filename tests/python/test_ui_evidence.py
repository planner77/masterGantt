"""Issue #896: synthetic screenshot/geometry evidence guard tests."""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import ui_evidence


class UiEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.image = self.root / "ui-evidence-view.png"
        self.image.write_bytes(ui_evidence.PNG_MAGIC + b"synthetic-fixture-only")
        self.manifest = self.root / "ui-evidence-view.json"
        self.source = {
            "schema": ui_evidence.SCHEMA,
            "verdict": "OBSERVED_NOT_APPROVED",
            "issue": 889,
            "sourceSha": "a" * 40,
            "acceptanceCriteria": ["AC01", "AC03"],
            "state": "resource-1440-ko",
            "fixture": {"kind": "synthetic", "name": "schedule-views"},
            "environment": {"browser": "chromium", "locale": "ko",
                            "viewport": {"width": 1440, "height": 900}},
            "geometry": [{"name": "toolbar", "x": 0, "y": 5,
                          "width": 300, "height": 44}],
            "screenshot": {"name": self.image.name,
                           "sha256": hashlib.sha256(self.image.read_bytes()).hexdigest()},
        }
        self.write()

    def write(self):
        self.manifest.write_text(json.dumps(self.source), encoding="utf-8")

    def test_valid_manifest_proves_integrity_not_ui_approval(self):
        result = ui_evidence.validate_manifest(self.manifest)
        self.assertEqual(result["verdict"], "EVIDENCE_INTEGRITY_VERIFIED_NOT_UAT")

    def test_playwright_attached_copies_are_not_canonical(self):
        # Real #3577.1 Playwright report duplicated JSON/PNG under attachments/
        # with hashed names. The copied JSON's screenshot refers to the original
        # basename and must not be treated as another independent manifest.
        attachments = self.root / "attachments"
        attachments.mkdir()
        (attachments / "ui-evidence-view-json-hash.json").write_bytes(
            self.manifest.read_bytes())
        (attachments / "ui-evidence-view-png-hash.png").write_bytes(
            self.image.read_bytes())
        original_only = ui_evidence.canonical_manifests(self.root)
        self.assertEqual(original_only, [self.manifest])
        self.assertEqual(
            ui_evidence.validate_manifest(original_only[0])["verdict"],
            "EVIDENCE_INTEGRITY_VERIFIED_NOT_UAT")

    def test_original_missing_still_not_approved_by_attachment(self):
        attachments = self.root / "attachments"
        attachments.mkdir()
        (attachments / "ui-evidence-view-json-hash.json").write_bytes(
            self.manifest.read_bytes())
        self.manifest.unlink()
        self.assertEqual(ui_evidence.canonical_manifests(self.root), [])

    def test_data_must_be_synthetic(self):
        self.source["fixture"]["kind"] = "production"
        self.write()
        with self.assertRaisesRegex(ui_evidence.EvidenceError, "synthetic"):
            ui_evidence.validate_manifest(self.manifest)

    def test_forged_verdict_never_accepted(self):
        self.source["verdict"] = "PASS"
        self.write()
        with self.assertRaisesRegex(ui_evidence.EvidenceError, "self-attest"):
            ui_evidence.validate_manifest(self.manifest)

    def test_tampered_png_is_rejected(self):
        self.image.write_bytes(ui_evidence.PNG_MAGIC + b"mutated-synthetic-image")
        with self.assertRaisesRegex(ui_evidence.EvidenceError, "checksum"):
            ui_evidence.validate_manifest(self.manifest)

    def test_nan_geometry_is_rejected(self):
        self.source["geometry"][0]["width"] = float("nan")
        self.write()
        with self.assertRaisesRegex(ui_evidence.EvidenceError, "geometry"):
            ui_evidence.validate_manifest(self.manifest)

    def test_missing_ac_and_bad_source_rejected(self):
        for update in ({"acceptanceCriteria": []}, {"sourceSha": "a" * 39}):
            previous = self.source.copy()
            self.source.update(update)
            self.write()
            with self.assertRaises(ui_evidence.EvidenceError):
                ui_evidence.validate_manifest(self.manifest)
            self.source = previous

    def test_traversal_and_symlink_rejected(self):
        self.source["screenshot"]["name"] = "../../ui-evidence-view.png"
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest)
        self.source["screenshot"]["name"] = "ui-evidence-link.png"
        (self.root / "ui-evidence-link.png").symlink_to(self.image)
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest)


class UiEvidenceV2Tests(unittest.TestCase):
    write = UiEvidenceTests.write

    def setUp(self):
        UiEvidenceTests.setUp(self)
        self.geometry = self.root / "geometry-view.json"
        self.geometry.write_text(json.dumps(self.source["geometry"]), encoding="utf-8")
        self.fixture = self.root / "fixture-view.json"
        self.fixture.write_text('{"tasks":[{"name":"합성 작업"}]}', encoding="utf-8")
        self.source.update({
            "schema": ui_evidence.SCHEMA_V2, "baselineSha": "b" * 40, "testMergeSha": "c" * 40,
            "provenance": {"kind": "github-actions", "pr": 900, "repository": "planner77/masterGantt",
                           "runId": 123, "runAttempt": 2, "workingTreeDirty": False,
                           "workingDiffSha256": "d" * 64, "testSourceSha256": "e" * 64,
                           "helperSourceSha256": "f" * 64},
            "test": {"id": "id1", "title": "합성 브라우저", "project": "chromium",
                     "outcome": "CAPTURED_BEFORE_TEST_COMPLETION"},
            "captureDurationMs": 12,
            "flow": {"id": "roundtrip", "steps": ["Resource", "설비", "WBS"], "outcome": "PASS"},
            "checks": [{"ac": "AC01", "designRef": "DESIGN.md", "measurement": "toolbarHeight",
                        "actual": 44, "expected": 44, "tolerance": 1, "outcome": "PASS"}],
            "ownerReview": "NOT TESTED",
            "exclusions": [{"scope": "125%-native", "reason": "별도 실제 브라우저 수용 필요"}],
            "geometryFile": {"name": self.geometry.name,
                             "sha256": hashlib.sha256(self.geometry.read_bytes()).hexdigest()},
        })
        self.source["fixture"].update({"scope": "DATA_CAPTURED", "file": self.fixture.name,
                                      "sha256": hashlib.sha256(self.fixture.read_bytes()).hexdigest()})
        self.source["environment"].update({"browserVersion": "145.0.0", "playwrightVersion": "1.63.0",
            "os": "linux", "osRelease": "6.8", "font": "Arial", "theme": "light", "cssZoom": "1",
            "deviceScaleFactor": 1, "timezone": "UTC", "documentLocale": "ko",
            "observedTime": "2026-10-14T12:00:00.000Z"})
        self.write()

    def test_v2_expected_identity_matches_and_never_approves_uat(self):
        result = ui_evidence.validate_manifest(self.manifest, require_v2=True,
            expected={"sourceSha": "a" * 40, "baselineSha": "b" * 40,
                      "testMergeSha": "c" * 40, "pr": 900, "environment": {"font": "Arial"}})
        self.assertEqual(result["flowOutcome"], "PASS")
        self.assertEqual(result["verdict"], "EVIDENCE_INTEGRITY_VERIFIED_NOT_UAT")

    def test_identity_drift_is_blocked(self):
        for expected in ({"sourceSha": "f" * 40}, {"baselineSha": "f" * 40},
                         {"testMergeSha": "f" * 40}, {"pr": 901}):
            with self.assertRaises(ui_evidence.EvidenceError) as caught:
                ui_evidence.validate_manifest(self.manifest, expected=expected)
            self.assertEqual(caught.exception.status, "BLOCKED")

    def test_ci_run_repository_attempt_mismatch_is_blocked(self):
        for expected in ({"repository": "foreign/repository"}, {"runId": 999}, {"runAttempt": 3}):
            with self.assertRaises(ui_evidence.EvidenceError) as caught:
                ui_evidence.validate_manifest(self.manifest, expected=expected)
            self.assertEqual(caught.exception.status, "BLOCKED")

    def test_malformed_expected_and_provenance_fail_closed(self):
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest, expected={"environment": "unknown"})
        self.source["provenance"] = []
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest, expected={"pr": 900})

    def test_font_os_or_browser_drift_is_blocked(self):
        for key, value in (("font", "Unknown"), ("os", "win32"), ("browserVersion", "146.0.0")):
            with self.assertRaises(ui_evidence.EvidenceError) as caught:
                ui_evidence.validate_manifest(self.manifest, expected={"environment": {key: value}})
            self.assertEqual(caught.exception.status, "BLOCKED")

    def test_failed_flow_and_forged_measurement_are_fail(self):
        self.source["flow"]["outcome"] = "FAIL"
        self.write()
        result = ui_evidence.validate_manifest(self.manifest)
        self.assertEqual(result["flowOutcome"], "FAIL")
        self.source["flow"]["outcome"] = "PASS"
        self.source["checks"][0]["actual"] = 99
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError) as caught:
            ui_evidence.validate_manifest(self.manifest)
        self.assertEqual(caught.exception.status, "FAIL")

    def test_explicit_negative_observation_keeps_integrity_without_uat_pass(self):
        self.source["checks"][0]["outcome"] = "FAIL"
        self.source["checks"][0]["actual"] = 99
        self.write()
        result = subprocess.run([sys.executable, str(Path(ui_evidence.__file__)), str(self.root)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        outcome = json.loads(result.stdout)
        self.assertEqual(outcome["status"], "EVIDENCE_VERIFIED_NOT_UAT")
        self.assertEqual(outcome["observationStatus"], "FAIL")
        self.assertEqual(outcome["observedFailures"], 1)

    def test_missing_environment_is_not_pass(self):
        del self.source["environment"]["font"]
        self.write()
        with self.assertRaisesRegex(ui_evidence.EvidenceError, "font"):
            ui_evidence.validate_manifest(self.manifest)

    def test_corrupt_geometry_is_fail(self):
        self.geometry.write_text('[]', encoding="utf-8")
        with self.assertRaises(ui_evidence.EvidenceError) as caught:
            ui_evidence.validate_manifest(self.manifest)
        self.assertEqual(caught.exception.status, "FAIL")

    def test_modified_fixture_is_fail(self):
        self.fixture.write_text('{"tasks":[]}', encoding="utf-8")
        with self.assertRaises(ui_evidence.EvidenceError) as caught:
            ui_evidence.validate_manifest(self.manifest)
        self.assertEqual(caught.exception.status, "FAIL")

    def test_rehashed_geometry_still_must_match_embedded_values(self):
        self.geometry.write_text('[]', encoding="utf-8")
        self.source["geometryFile"]["sha256"] = hashlib.sha256(self.geometry.read_bytes()).hexdigest()
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError) as caught:
            ui_evidence.validate_manifest(self.manifest)
        self.assertEqual(caught.exception.status, "FAIL")

    def test_missing_screenshot_never_counts_as_evidence(self):
        self.image.unlink()
        with self.assertRaises(ui_evidence.EvidenceError) as caught:
            ui_evidence.validate_manifest(self.manifest)
        self.assertEqual(caught.exception.status, "NOT TESTED")
        result = subprocess.run([sys.executable, str(Path(ui_evidence.__file__)), str(self.root), "--allow-empty"],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["status"], "NOT TESTED")

    def test_owner_approval_cannot_be_injected(self):
        self.source["ownerReview"] = "ACCEPTED"
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest)

    def test_flow_without_actual_steps_is_not_pass(self):
        self.source["flow"]["steps"] = []
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest)

    def test_missing_ci_provenance_is_blocked(self):
        del self.source["provenance"]["runAttempt"]
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest)

    def test_geometry_symlink_is_rejected(self):
        link = self.root / "geometry-link.json"
        link.symlink_to(self.geometry)
        self.source["geometryFile"]["name"] = link.name
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest)

    def test_v1_cannot_satisfy_v2_contract(self):
        self.source["schema"] = ui_evidence.SCHEMA
        self.write()
        with self.assertRaises(ui_evidence.EvidenceError):
            ui_evidence.validate_manifest(self.manifest, require_v2=True)

    def test_cli_summary_has_safe_links_and_missing_is_not_tested(self):
        summary = self.root / "SUMMARY.md"
        script = str(Path(ui_evidence.__file__))
        result = subprocess.run([sys.executable, script, str(self.root), "--summary", str(summary),
                                 "--require-v2", "--source-sha", "a" * 40], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("[PNG](ui-evidence-view.png)", summary.read_text(encoding="utf-8"))
        self.manifest.unlink()
        result = subprocess.run([sys.executable, script, str(self.root), "--summary", str(summary),
                                 "--allow-empty"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertEqual(json.loads(result.stdout)["status"], "NOT TESTED")


if __name__ == "__main__":
    unittest.main()
