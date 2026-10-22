#!/usr/bin/env python3
"""Issue #752: bounded provenance, non-authoritative reporting, and negative replay."""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import issue_752_diagnostics as d


HEAD = "a"*40
BASE = "b"*40
MERGE = "c"*40


def row(run_id, attempt, head=HEAD, status="FAILED"):
    return {"runId":run_id, "attempt":attempt, "headSha":head, "baseSha":BASE,
            "testMergeSha":MERGE, "status":status, "shards":[],"roots":[]}


class IdentityAndHistory(unittest.TestCase):
    def test_single_canonical_issue(self):
        self.assertEqual(d.issue_from_pr({"title":"Issue #752: implementation",
                                          "body":"Refs #752\n"}),752)
        for body in ("Refs #753\n", "Refs #752\nRefs #752\n", "hello Refs #752"):
            with self.subTest(body=body), self.assertRaises(d.EvidenceError):
                d.issue_from_pr({"title":"Issue #752: implementation", "body":body})

    def test_two_distinct_full_failures_and_stale_head(self):
        rows=[row(3001,1,"d"*40),row(3003,1)]
        self.assertTrue(d.classify(rows,HEAD,3003,1)["recommended"])
        self.assertEqual(d.classify(rows,HEAD,3001,1)["status"],"NOT_RECOMMENDED")
        self.assertEqual(d.classify(rows,HEAD,3003,2)["status"],"NOT_RECOMMENDED")
        self.assertFalse(d.classify([rows[1]],HEAD,3003,1)["recommended"])

    def test_cancelled_derived_and_metadata_are_not_direct_failures(self):
        jobs={
            d.META:{"conclusion":"skipped"},
            d.PREFLIGHT:{"conclusion":"success"},
            "Chromium E2E shard 1/8 · PR":{"conclusion":"cancelled", "started_at":"2026-10-20T00:00:00Z",
                                          "completed_at":"2026-10-20T00:34:59Z","id":1},
            "Chromium end-to-end tests":{"conclusion":"failure"},
        }
        state,roots,shards=d.attempt_status(jobs)
        self.assertEqual((state,roots),("CANCELLED", []))
        self.assertEqual(len(shards),1)
        self.assertEqual(shards[0]["conclusion"],"cancelled")
        jobs[d.META]["conclusion"]="success"
        self.assertEqual(d.attempt_status(jobs)[0],"METADATA_OR_DRAFT")

    def test_one_direct_root_not_three_aggregate_failures(self):
        jobs={d.META:{"conclusion":"skipped"},
              d.PREFLIGHT:{"conclusion":"failure"},
              d.FAST_GATE:{"conclusion":"failure"},
              **{key:{"conclusion":"failure"} for key in d.AGGREGATES}}
        state,roots,_=d.attempt_status(jobs)
        self.assertEqual(state,"FAILED")
        self.assertEqual([x["job"] for x in roots],[d.PREFLIGHT])

    def test_historical_source_check_against_attempt_merge(self):
        class GH:
            repo="planner77/masterGantt"
            prefix="/repos/planner77/masterGantt"
            def get(self,route):
                return {"parents":[{"sha":BASE},{"sha":HEAD}]} if route.endswith(MERGE) else {}
        payload={"schema":"mastergantt-ci-pr-source-v1","repository":GH.repo,
                 "run_id":393933,"run_attempt":1,"pr_number":747,
                 "head_sha":HEAD,"base_sha":BASE,"test_merge_sha":MERGE,
                 "base_repository":GH.repo,"base_ref":"main",
                 "head_repository":GH.repo,"head_ref":"feature"}
        run={"id":393933,"event":"pull_request",
             "path":".github/workflows/ci.yml@refs/heads/main",
             "head_sha":MERGE,"head_branch":"feature",
             "repository":{"full_name":GH.repo}}
        with patch.object(d.qa,"source_artifact",return_value=payload):
            self.assertEqual(d.authentic_source(GH(),run,1,pr_number=747)["head_sha"],HEAD)
            run["head_sha"]="0"*40
            with self.assertRaises(d.EvidenceError):
                d.authentic_source(GH(),run,1,pr_number=747)

    def test_sanitize_file_selection_and_path_traversal_rejection(self):
        a="tests/e2e/issue-623-resource-mvp.spec.ts"
        b="tests/e2e/milestone-dashboard-state.spec.ts"
        ordered,parts=d.select_files([a],[b])
        self.assertEqual(ordered,sorted([a,b]))
        self.assertEqual(sum(map(len,parts)),2)
        with self.assertRaises(d.EvidenceError):
            d.select_files([a],["tests/e2e/../evil.spec.ts"])
        with self.assertRaises(d.EvidenceError):
            d.select_files([],[])
        self.assertEqual(d.parse_ledger("historical "+a+"\n"+a),[a])

    def test_p50_p95_cancelled_rate_observation_not_ci_pass(self):
        history=[{"shards":[{"name":"Chromium E2E shard 1/8 · PR",
                             "conclusion":"cancelled" if i==0 else "success",
                             "minutes":i+1}]} for i in range(4)]
        s=d.performance(history)["Chromium E2E shard 1/8 · PR"]
        self.assertEqual(s["p50Minutes"],2)
        self.assertEqual(s["p95Minutes"],4)
        self.assertEqual(s["cancelledRate"],.25)

    def test_stale_live_source_is_blocked(self):
        old={"headSha":HEAD,"baseSha":BASE,"testMergeSha":MERGE}
        pr={"state":"open","head":{"sha":"0"*40},"base":{"sha":BASE},
            "merge_commit_sha":MERGE}
        with self.assertRaises(d.EvidenceError):
            d.ensure_current(pr,old)


class BoundReports(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.plan={"status":"APPROVED_BOUNDED_DIAGNOSIS",
                   "issue":752,"pr":779,"repo":"planner77/masterGantt",
                   "headSha":HEAD,"baseSha":BASE,"testMergeSha":MERGE,
                   "sourceRunId":3003,"sourceAttempt":1,
                   "runKey":"779:"+HEAD+":f00ba1",
                   "history":[row(3001,1),row(3003,1)],
                   "files":["tests/e2e/a.spec.ts"],
                   "historicalFiles":["tests/e2e/a.spec.ts"],
                   "parts":[["tests/e2e/a.spec.ts"],[],[],[]]}
        self.gh=type("GH",(),{"prefix":"/repos/planner77/masterGantt",
                              "repo":"planner77/masterGantt",
                              "get":lambda _,path:{"state":"open","head":{"sha":HEAD},
                                                     "base":{"sha":BASE},"merge_commit_sha":MERGE}})()

    def test_missing_worker_is_incomplete_without_double_count(self):
        r=d.finalize(self.gh,self.plan,self.root,44)
        self.assertEqual(r["status"],"DIAGNOSIS_INCOMPLETE")
        self.assertEqual(r["counts"]["NOT RUN"],1)
        self.assertIn("PART_0_MISSING",r["missing"])

    def test_valid_redacted_worker_result_never_claims_ci_pass(self):
        target=self.root/"part-0"
        target.mkdir()
        spec="tests/e2e/a.spec.ts"
        (target/"execution.json").write_text(json.dumps({
            "part":0,"headSha":HEAD,"diagnosisRunId":44,"files":[spec],"exitCode":1}))
        (target/"playwright.json").write_text(json.dumps({"suites":[{
            "file":spec,"specs":[{"tests":[{"id":"case-1","results":[
                {"status":"failed","duration":34,"error":{"message":"secret token"}},
            ]}]}]}]}))
        r=d.finalize(self.gh,self.plan,self.root,44)
        self.assertEqual(r["status"],"DIAGNOSIS_READY")
        self.assertEqual(r["crossRun"][0]["status"],"RECURRING")
        self.assertEqual(r["counts"]["FAIL"],1)
        self.assertNotIn("secret",json.dumps(r))
        self.assertTrue(r["notAnApproval"])

    def test_invalid_worker_provenance_is_not_green(self):
        t=self.root/"part-0"
        t.mkdir()
        (t/"execution.json").write_text(json.dumps({
            "part":0,"headSha":"e"*40,"diagnosisRunId":44,
            "files":["tests/e2e/a.spec.ts"],"exitCode":0}))
        (t/"playwright.json").write_text('{"suites":[]}')
        result=d.finalize(self.gh,self.plan,self.root,44)
        self.assertEqual(result["status"],"DIAGNOSIS_INCOMPLETE")
        self.assertTrue(result["missing"])


if __name__ == "__main__":
    unittest.main()
