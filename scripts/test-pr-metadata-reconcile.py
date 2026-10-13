#!/usr/bin/env python3
"""Issue #600: pure, no-token metadata reconciliation scenarios."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

P = pathlib.Path(__file__).resolve().parent / "reconcile-pr-metadata.py"
spec = importlib.util.spec_from_file_location("reconcile_metadata", P)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
H = "a" * 40
B = "b" * 40
REPO = "planner77/masterGantt"
N = 600

def pr(head=H, base=B, title="[Issue #600] 자동 복구", body="Refs #600"):
    return {"number": N, "state": "open", "head": {"sha": head, "ref": "ci/issue-600-metadata-reconcile", "repo": {"full_name": REPO}},
            "base": {"sha": base}, "title": title, "body": body, "user": {"login": "planner77"}}

def run(id=22, marker=m.META_MARKER, conclusion="failure", status="completed", attempt=1, head=H, base=B, number=N):
    return {"id": id, "run_number": id, "run_attempt": attempt, "event": "pull_request",
            "status": status, "conclusion": conclusion, "head_sha": head,
            "head_branch": "ci/issue-600-metadata-reconcile",
            "head_repository": {"full_name": REPO}, "repository": {"full_name": REPO},
            "path": ".github/workflows/ci.yml", "display_title": marker,
            "pull_requests": [{"number": number, "head": {"sha": head}, "base": {"sha": base}}]}

class GH:
    repo = REPO
    prefix = "/repos/" + REPO
    def __init__(self, source=None, meta=None, jobs=None):
        self.source = source or run(id=20, marker=m.META_MARKER)
        self.meta = meta or [run()]
        self.jobs = jobs if jobs is not None else [
            {"name": "변경 경로 판정", "conclusion": "success"},
            {"name": m.META_JOB, "conclusion": "failure"},
            *({"name": name, "conclusion": "failure"} for name in m.REQUIRED)]
        self.live = pr()
    def pages(self, path):
        if "/pulls?" in path:
            return [self.live]
        raise AssertionError(path)
    def get(self, path):
        if "/pulls/" in path:
            return self.live
        if "/actions/runs/" in path:
            run_id = int(path.rsplit("/", 1)[-1])
            matched = [entry for entry in [self.source, *self.meta] if entry["id"] == run_id]
            assert len(matched) == 1, f"unexpected run id: {path}"
            return matched[0]
        raise AssertionError(path)
    def collection(self, path, name):
        if name == "workflow_runs":
            return self.meta
        if name == "jobs":
            return self.jobs
        raise AssertionError(path)

def full(*args):
    return 77

class Reconcile(unittest.TestCase):
    @staticmethod
    def artifact(gh, run_id, attempt):
        # #593 zip/API authenticity is separately checked by QA provenance tests.
        if attempt != 1:
            raise m.Blocked("BLOCKED", "wrong run attempt")
        return {"run_id": run_id, "attempt": attempt}

    @staticmethod
    def verified(gh, run, payload):
        if payload["run_id"] != run.get("id") or payload["attempt"] != run.get("run_attempt"):
            raise m.Blocked("BLOCKED", "artifact run/attempt mismatch")
        refs = run.get("pull_requests") or []
        if len(refs) > 1:
            raise m.Blocked("BLOCKED", "multiple PRs")
        live = gh.live
        number = refs[0]["number"] if refs else live["number"]
        head = refs[0]["head"]["sha"] if refs else live["head"]["sha"]
        base = refs[0]["base"]["sha"] if refs else live["base"]["sha"]
        if (live.get("state") != "open" or number != live["number"]
                or head != live["head"]["sha"] or base != live["base"]["sha"]
                or run.get("head_sha") != head):
            raise m.Blocked("BLOCKED", "stale/forged source")
        return number, head, base, "c" * 40, live

    def checked(self, gh, verify_full=full, *, reject_artifact=False):
        reader = (lambda *args: (_ for _ in ()).throw(
            m.Blocked("BLOCKED", "missing provenance"))) if reject_artifact else self.artifact
        with patch.object(m, "source_artifact", side_effect=reader), patch.object(
                m, "verified_source", side_effect=self.verified):
            return m.classify(gh, gh.source, verify_full=verify_full)
    def test_ready_exact_source(self):
        self.assertEqual(self.checked(GH())["metadata_run_id"], 22)
    def test_full_pending_or_failed_stays_red(self):
        for label in ("pending", "failure", "cancelled", "missing"):
            with self.subTest(label=label):
                def rejected(*args):
                    raise m.Blocked("FAIL", label)
                with self.assertRaises(m.NoRecovery) as ctx:
                    self.checked(GH(), verify_full=rejected)
                self.assertEqual(ctx.exception.state, "WAIT_FULL")
    def test_later_metadata_edit_blocks_old(self):
        g = GH(meta=[run(id=22), run(id=23, status="in_progress", conclusion=None)])
        with self.assertRaises(m.NoRecovery) as ctx:
            self.checked(g)
        self.assertEqual(ctx.exception.state, "WAIT_METADATA")
    def test_old_success_never_overrides_latest_failure(self):
        g = GH(meta=[run(id=22, conclusion="success"), run(id=23)])
        self.assertEqual(self.checked(g)["metadata_run_id"], 23)
    def test_retry_cap_and_bad_base(self):
        for bad in [run(attempt=2), run(base="c"*40)]:
            with self.assertRaises(m.NoRecovery):
                self.checked(GH(meta=[bad]))
    def test_bad_trace_cannot_rerun(self):
        g = GH()
        for title, body in [("[Issue #601] 위조", "Refs #600"), ("[Issue #600] 누락", "Refs #601"), ("[Issue #600] 누락", "")]:
            g.live = pr(title=title, body=body)
            with self.assertRaises(m.NoRecovery) as ctx:
                self.checked(g)
            self.assertEqual(ctx.exception.state, "TRACE_INVALID")
    def test_failed_nonmetadata_job_is_not_retried(self):
        for name in ("변경 경로 판정", m.META_JOB, *m.REQUIRED):
            with self.subTest(job=name):
                g = GH()
                for job in g.jobs:
                    if job["name"] == name:
                        # A failed trace/changes step is not an evidence-only
                        # failure; other jobs must fail in the original case.
                        job["conclusion"] = "failure" if name == "변경 경로 판정" else "success"
                with self.assertRaises(m.NoRecovery) as caught:
                    self.checked(g)
                self.assertEqual(caught.exception.state, "NO_RETRY")
    def test_other_pr_and_stale_head_rejected(self):
        for source in [run(id=20, number=999), run(id=20, head="c"*40)]:
            with self.assertRaises(m.NoRecovery):
                self.checked(GH(source=source))
    def test_closed_or_foreign_source_rejected(self):
        g = GH()
        g.live["state"] = "closed"
        with self.assertRaises(m.NoRecovery):
            self.checked(g)
        g = GH(source={**run(id=20), "head_repository": {"full_name": "elsewhere/repo"}})
        with self.assertRaises(m.NoRecovery):
            self.checked(g)
    def test_success_cancelled_and_partial_do_not_retry(self):
        for state in ["success", "cancelled", None]:
            with self.assertRaises(m.NoRecovery):
                self.checked(GH(meta=[run(conclusion=state)]))
    def test_empty_github_pr_refs_use_verified_event_artifact(self):
        trigger = run(id=20)
        trigger["pull_requests"] = []
        metadata = run(id=22)
        metadata["pull_requests"] = []
        g = GH(source=trigger, meta=[metadata])
        self.assertEqual(self.checked(g)["metadata_run_id"], 22)
        with self.assertRaises(m.NoRecovery) as captured:
            self.checked(g, reject_artifact=True)
        self.assertEqual(captured.exception.state, "BLOCKED")

    def test_metadata_artifact_rejects_wrong_live_base(self):
        g = GH(meta=[run(id=22, base="d" * 40)])
        with self.assertRaises(m.NoRecovery):
            self.checked(g)
    def test_no_write_or_polling_on_deferred(self):
        self.assertNotIn("time.sleep", P.read_text())
        self.assertNotIn("pull_request_target", P.read_text())

if __name__ == "__main__":
    unittest.main()
