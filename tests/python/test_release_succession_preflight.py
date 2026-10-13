import copy
import unittest

from scripts.release_succession_preflight import (
    CORRECTION, ORIGINAL, VERSIONS, SuccessionBlocked, evaluate,
)


def valid():
    sha = "a" * 40
    return {
        "source_sha": ORIGINAL, "correction_sha": CORRECTION,
        "main_sha": sha, "candidate_sha": sha, "candidate_version": "0.108.0",
        "first_parent": [ORIGINAL, CORRECTION, sha],
        "contains_f2": True, "contains_correction": True,
        "original_ci": "FAIL", "original_owner_marker_preserved": True,
        "inventory_authenticated": True, "owner_new_version_authorized": False,
        "release_inventory": {
            v: {"git_tag": "ABSENT", "github_release": "ABSENT",
                "ghcr_tag": "ABSENT", "ghcr_digest": None} for v in (*VERSIONS, "0.108.0")
        },
    }


class TestSuccessionPreflight(unittest.TestCase):
    def test_prepare_never_authorizes_release(self):
        result = evaluate(valid())
        self.assertEqual(result["decision"], "PREPARE_ONLY")
        self.assertFalse(result["publish"])
        self.assertFalse(result["close_issue_616"])

    def test_unknown_duplicate_conflict_and_foreign_sha_block(self):
        cases = []
        for field, value in (
            ("source_sha", "b" * 40), ("candidate_version", "0.107.0"),
            ("inventory_authenticated", False), ("owner_new_version_authorized", True),
            ("original_ci", "PASS"), ("contains_correction", False),
            ("original_owner_marker_preserved", False)
        ):
            x = valid()
            x[field] = value
            cases.append(x)
        for edit in ("UNKNOWN", "PRESENT"):
            x = valid()
            x["release_inventory"]["0.107.0"]["ghcr_tag"] = edit
            cases.append(x)
        x = valid()
        x["release_inventory"]["0.108.0"]["git_tag"] = "PRESENT"
        cases.append(x)
        x = valid()
        x["release_inventory"]["0.106.0"]["github_release"] = "PRESENT"
        cases.append(x)
        x = valid()
        x["first_parent"].insert(1, ORIGINAL)
        cases.append(x)
        x = valid()
        del x["release_inventory"]["0.106.1"]
        cases.append(x)
        x = valid()
        x["release_inventory"]["0.107.0"]["ghcr_tag"] = "PRESENT"
        x["release_inventory"]["0.107.0"]["ghcr_digest"] = "sha256:invalid"
        cases.append(x)
        x = valid()
        x["candidate_sha"] = "b" * 40
        cases.append(x)
        x = valid()
        x["first_parent"] = [CORRECTION, ORIGINAL, x["main_sha"]]
        cases.append(x)
        x = valid()
        del x["candidate_sha"]
        cases.append(x)
        for case in cases:
            with self.subTest(case=case), self.assertRaises(SuccessionBlocked):
                evaluate(copy.deepcopy(case))


if __name__ == "__main__":
    unittest.main()
