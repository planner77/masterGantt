#!/usr/bin/env python3
"""Issue #577 M1-M8 deterministic metadata evidence state scenarios."""
import importlib.util
import pathlib

P = pathlib.Path(__file__).resolve().parent / "verify-pr-metadata-evidence.py"
spec = importlib.util.spec_from_file_location("pr_metadata", P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SHA1 = "1" * 40
SHA2 = "2" * 40
REPO = "planner77/masterGantt"
NUMBER = 577

def run(run_id=20, sha=SHA1, state="completed", conclusion="success", label=m.FULL_MARKER, pr=NUMBER):
    return dict(id=run_id, event="pull_request", head_sha=sha, path=".github/workflows/ci.yml",
                pull_requests=[{"number": pr}], run_number=run_id, status=state,
                conclusion=conclusion, display_title=label)

def jobs(gate="success", metadata="skipped"):
    return [dict(name=name, conclusion=gate) for name in m.FULL_GATES] + [
        dict(name=m.METADATA_JOB, conclusion=metadata)
    ]

def inspect(runs, j=jobs(), current=999):
    return m.classify_full_evidence(runs, lambda run_id: j, pr_number=NUMBER,
                                    head_sha=SHA1, current_run_id=current)

def eq(label, actual, expect):
    assert actual == expect, f"{label}: {actual!r} != {expect!r}"
    print(f"{label}: PASS")

# M1 full runs are accepted only once successful; full jobs must not be bypassed.
eq("M1-running", inspect([run(state="in_progress", conclusion=None)])[0], "DEFERRED")
eq("M1-completed", inspect([run()])[0], "VERIFIED")
# M2 exact same head/full success, no heavy rerun.
eq("M2-same-sha-success", inspect([run(), run(21, label=m.METADATA_MARKER)])[0], "VERIFIED")
# M3 old SHA must not be borrowed from new SHA run.
eq("M3-cross-sha", inspect([run(20, SHA2)])[0], "MISSING")
# M4 concurrent metadata and full must defer with no false green.
eq("M4-pending", inspect([run(state="queued", conclusion=None)])[0], "DEFERRED")
# M5 fail closed for cancelled/failure/missing and newest failed overrides older success.
for conclusion in ("failure", "cancelled"):
    eq(f"M5-{conclusion}", inspect([run(conclusion=conclusion)])[0], "FULL_FAILED")
eq("M5-missing", inspect([])[0], "MISSING")
eq("M5-newest-failed", inspect([run(19), run(20, conclusion="failure")])[0], "FULL_FAILED")
eq("M5-skipped-gate", inspect([run()], jobs("skipped"))[0], "FULL_FAILED")
eq("M5-unidentified-run", inspect([run(label="legacy-no-marker")], jobs(metadata=""))[0], "MISSING")
# M6 live trace errors fail; do not allow a new title to bypass Primary Issue validator.
pr = {"number": NUMBER, "head": {"sha": SHA1, "ref": "ci/issue-577-metadata-stale-evidence"},
      "title": "[Issue #577] 검사", "body": "Refs #577", "user": {"login": "planner77"}}
eq("M6-valid-trace", m._inspect_trace(SHA1, pr, REPO, NUMBER)[0], "TRACE_OK")
eq("M6-title-mismatch", m._inspect_trace(SHA1, {**pr, "title": "[Issue #123] 검사"}, REPO, NUMBER)[0], "TRACE_INVALID")
eq("M6-refs-missing", m._inspect_trace(SHA1, {**pr, "body": "다른 본문"}, REPO, NUMBER)[0], "TRACE_INVALID")
eq("M6-branch-mismatch", m._inspect_trace(SHA1, {**pr, "head": {"sha": SHA1, "ref": "feat/issue-123-other"}}, REPO, NUMBER)[0], "TRACE_INVALID")
# M7 stale evaluated before finding evidence, even if previously successful.
eq("M7-stale-head", m._inspect_trace(SHA1, {**pr, "head": {"sha": SHA2, "ref": "ci/issue-577-metadata-stale-evidence"}}, REPO, NUMBER)[0], "SUPERSEDED")
eq("M7-other-pr", inspect([run(pr=999)])[0], "MISSING")
# M8 metadata edits must not count as full runs.
eq("M8-metadata-only", inspect([run(label=m.METADATA_MARKER)], jobs(metadata="success"))[0], "MISSING")
eq("M8-current-run-excluded", inspect([run()], current=20)[0], "MISSING")
eq("T6-multiple-associated-PRs", inspect([{**run(),"pull_requests":[{"number":NUMBER},{"number":999}]}])[0], "MISSING")
print("Issue #577 metadata evidence scenarios: PASS")
