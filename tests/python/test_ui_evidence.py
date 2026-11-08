"""Issue #896: synthetic screenshot/geometry evidence guard tests."""
import hashlib
import json
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


if __name__ == "__main__":
    unittest.main()
