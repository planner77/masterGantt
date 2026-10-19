import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

MODULE = pathlib.Path(__file__).resolve().parents[2] / "scripts" / "issue-751-sanitize-playwright-trace.py"
spec = importlib.util.spec_from_file_location("issue751_trace", MODULE)
assert spec and spec.loader
trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trace)


class Issue751TraceSanitizerTest(unittest.TestCase):
    def test_sanitizes_real_trace_member_structure_and_original_timing(self):
        with tempfile.TemporaryDirectory(prefix="issue751-trace-") as temp:
            archive = pathlib.Path(temp) / "trace.zip"
            examples = [
                {"type": "resource-snapshot", "snapshot": {
                    "_monotonicTime": 423127.487,
                    "request": {"url": "https://private.example/api/projects/SECRET/logistics/process-context?token=SECRET",
                                "method": "GET", "headers": {"Cookie": "DO_NOT_LEAK"}},
                    "response": {"status": 200, "content": {"text": "SQL private"}},
                    "time": 3517,
                }},
                {"type": "resource-snapshot", "snapshot": {
                    "_monotonicTime": 423227.487,
                    "request": {"url": "https://private.example/api/projects/SECRET/assignment-targets",
                                "method": "GET"},
                    "response": {"status": 0},
                    "_failureText": "net::ERR_ABORTED cookie=SECRET",
                    "time": 200,
                }},
                {"type": "resource-snapshot", "snapshot": {
                    "request": {"url": "https://private.example/api/projects/SECRET/resource-dashboard",
                                "method": "POST"}, "response": {"status": 500},
                    "timings": {"startTime": 120, "responseEnd": 390},
                }},
            ]
            with zipfile.ZipFile(archive, "w") as target:
                target.writestr("test.trace", '{"type":"context-options"}')
                target.writestr("test.network", "\n".join(map(json.dumps, examples)) + "\n")
            result = trace.sanitize_zip(archive)
            self.assertEqual(result["status"], "OBSERVED_UNVERIFIED")
            self.assertEqual(len(result["events"]), 3)
            self.assertEqual(result["events"][0]["durationMs"], 3517)
            self.assertEqual(result["events"][1]["outcome"], "abort")
            self.assertEqual(result["events"][1]["startMs"], 100)
            self.assertEqual(result["events"][2]["durationMs"], 270)
            output = json.dumps(result)
            for private in ("SECRET", "private.example", "SQL private", "DO_NOT_LEAK"):
                self.assertNotIn(private, output)

    def test_missing_network_is_not_a_passing_empty_trace(self):
        with tempfile.TemporaryDirectory() as temp:
            archive = pathlib.Path(temp) / "missing.zip"
            with zipfile.ZipFile(archive, "w") as target:
                target.writestr("just.trace", "{}")
            result = trace.sanitize_zip(archive)
            self.assertEqual(result["status"], "INCOMPLETE")
            self.assertIn("NETWORK_TRACE_ABSENT", result["errors"])


if __name__ == "__main__":
    unittest.main()
