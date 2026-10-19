import importlib.util
import pathlib
import unittest

MODULE = pathlib.Path(__file__).resolve().parents[2] / "scripts" / "issue-751-performance-compare.py"
spec = importlib.util.spec_from_file_location("issue751_compare", MODULE)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def shard(run, number, value, sha="a" * 40, os="linux", status="passed"):
    return {
        "schemaVersion": 1, "runId": str(run), "runAttempt": 1,
        "headSha": sha, "eventName": "push", "status": status,
        "shard": number, "shardCount": 6,
        "environment": {"os": os, "node": "22.16.0", "fullyParallel": True},
        "receipts": [{
            "schemaVersion": 2, "resultStatus": status, "status": "ok",
            "source": {"runId": str(run), "attempt": 1,
                       "checkoutSha": sha, "project": "chromium", "testId": "stable-623", "retry": 0},
            "stages": [{"stage": "fixture_setup", "durationMs": value, "outcome": "ok"}],
            "requests": [{"source": "browser", "route": "process-context", "durationMs": 20,
                          "outcome": "complete"}],
            "serverEventsDiscarded": 0,
            "serverRequests": [{"route": "process-context", "status": 200,
                                "serverMs": value / 2, "sqlStatementCount": 3,
                                "sqlExecutionMs": value / 4}],
        }],
    }


def cohort(first, value, count=10, os="linux"):
    return [shard(run, shard_number, value, os=os)
            for run in range(first, first + count) for shard_number in range(1, 7)]


class Issue751ComparisonTests(unittest.TestCase):
    def test_no_replay_of_partial_cancelled_or_mixed_provenance(self):
        complete = cohort(100, 100, 1)
        self.assertEqual(len(module.complete_runs(complete)[0]), 6)
        self.assertEqual(module.complete_runs(complete[:-1])[0], [])
        wrong = complete.copy()
        wrong[0] = shard(100, 1, 100, sha="b" * 40)
        self.assertEqual(module.complete_runs(wrong)[0], [])
        cancelled = complete.copy()
        cancelled[2] = shard(100, 3, 100, status="failed")
        self.assertFalse(module.valid_source(cancelled[2]))

    def test_no_fictitious_p95_without_ten_separate_runs(self):
        old, new = cohort(1000, 100, 3), cohort(2000, 75, 3)
        result = module.compare(old, new)
        stage = next(row for row in result["rows"] if row["kind"] == "fixture")
        self.assertEqual(stage["status"], "INSUFFICIENT_DATA")
        self.assertNotIn("candidateP95", stage)

    def test_comparable_successes_produce_p50_p95_and_call_counts(self):
        base, new = cohort(1000, 100), cohort(2000, 80)
        result = module.compare(base, new)
        stage = next(row for row in result["rows"]
                     if row["kind"] == "fixture" and row["metric"] == "fixture_setup")
        self.assertEqual(stage["status"], "OBSERVED_WARNING_ONLY")
        self.assertEqual((stage["baselineP50"], stage["candidateP95"]), (100, 80))
        self.assertEqual(stage["p95DeltaPercent"], -20.0)
        counts = next(row for row in result["rows"] if row["kind"] == "http_calls")
        self.assertEqual((counts["baselineP95"], counts["candidateP95"]), (1, 1))
        sql = next(row for row in result["rows"]
                   if row["kind"] == "sql" and row["metric"].endswith("sqlStatementCount"))
        self.assertEqual(sql["candidateP95"], 3)

    def test_non_matching_environment_and_failed_tests_do_not_pass(self):
        base = cohort(1000, 100)
        different = cohort(2000, 80, os="win32")
        result = module.compare(base, different)
        self.assertTrue(all(row["status"] == "INSUFFICIENT_DATA" for row in result["rows"]))
        failed = cohort(3000, 80)
        for item in failed:
            item["receipts"][0]["resultStatus"] = "failed"
        result = module.compare(base, failed)
        self.assertTrue(all(row["status"] == "INSUFFICIENT_DATA" for row in result["rows"]))


if __name__ == "__main__":
    unittest.main()
