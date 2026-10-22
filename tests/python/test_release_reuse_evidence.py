#!/usr/bin/env python3
"""Issue #773 negative/positive replay: source, run, skipped, artifact and scope."""
import importlib.util
import io
import json
from pathlib import Path
import sys
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]

def load(filename, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

V = load("release-reuse-evidence.py", "release_reuse_evidence")
M = load("release-reuse-main-manifest.py", "release_reuse_main_manifest")

def zipped(name, payload):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr(name, json.dumps(payload))
    return output.getvalue()

class ReleaseReuseTests(unittest.TestCase):
    def test_plan_full_coverage_no_duplicates(self):
        self.assertEqual(V.assert_coverage({
            "schemaVersion": 1, "shardCount": 2,
            "shards": [{"shard": 1, "files": ["a"]}, {"shard": 2, "files": ["b"]}]
        }, {"a", "b"}), 2)
        for files in (["a", "a"], ["a", "c"]):
            with self.assertRaises(V.Ineligible):
                V.assert_coverage({
                    "schemaVersion": 1, "shardCount": 2,
                    "shards": [{"shard": 1, "files": ["a"]},
                               {"shard": 2, "files": [files[1]]}]
                }, {"a", "b"})
        with self.assertRaises(V.Ineligible):
            V.assert_coverage({"schemaVersion": 1, "shardCount": 8, "shards": []}, {"a"})

    def test_manifest_case_count(self):
        payload = {"suites": [{"specs": [{"file": "tests/e2e/a.spec.ts",
                    "tests": [{}, {}]}], "suites": [{
                    "specs": [{"file": "tests/e2e/b.spec.ts", "tests": [{}]}]
                    }]}]}
        self.assertEqual(M.list_cases(payload), ({"tests/e2e/a.spec.ts", "tests/e2e/b.spec.ts"}, 3))
        with self.assertRaises(ValueError):
            M.list_cases({"suites": []})

    def test_zipped_single_exact_path(self):
        body = {"source_sha": "a" * 40}
        valid = zipped("release-reuse-main-manifest.json", body)
        self.assertEqual(V.zip_json(valid, "release-reuse-main-manifest.json"), body)
        with self.assertRaises(V.Ineligible):
            V.zip_json(zipped("../release-reuse-main-manifest.json", body),
                       "release-reuse-main-manifest.json")
        with self.assertRaises(V.Ineligible):
            V.zip_json(valid, "different.json")
        with self.assertRaises(zipfile.BadZipFile):
            V.zip_json(b"not-a-zip", "release-reuse-main-manifest.json")

    def test_owner_marker_latest_revocation(self):
        def comment(n, authorized, author="planner77", relationship="OWNER"):
            return {"id": n, "user": {"login": author},
                    "author_association": relationship,
                    "body": '<!-- mastergantt-release-authorization:v1 ' +
                    json.dumps({"authorized": authorized, "expected_version": "1.2.3"}) + ' -->'}
        self.assertTrue(V.latest_owner_approval([comment(1, True)], "planner77", "1.2.3"))
        self.assertFalse(V.latest_owner_approval(
            [comment(1, True), comment(2, False)], "planner77", "1.2.3"))
        self.assertFalse(V.latest_owner_approval([comment(1, True, "attacker")],
                                                "planner77", "1.2.3"))
        self.assertFalse(V.latest_owner_approval([comment(1, True, "planner77", "NONE")],
                                                "planner77", "1.2.3"))
        self.assertFalse(V.latest_owner_approval([comment(1, True)], "planner77", "1.2.4"))

    def sample(self):
        names = [
            "병렬 quality 결과 집계", "정책·저장소 계약 검사", "TypeScript 타입 검사", "ESLint",
            "Vitest 단위·통합 테스트", "Next.js production build",
            "Docker smoke 구현", "Docker build and runtime smoke test",
            "Main 임시 commit 이미지 게시·검증·정리", "Chromium end-to-end tests",
            "Chromium E2E shard 1/2", "Chromium E2E shard 2/2",
        ]
        mandatory = {
            "정책·저장소 계약 검사": ["범용 Issue Lifecycle 계약·시나리오 검증",
                                  "Issue #773 Release reuse fail-closed 출처·샤드·Owner 회귀"],
            "TypeScript 타입 검사": ["Run npm run typecheck"],
            "ESLint": ["Run npm run lint"],
            "Vitest 단위·통합 테스트": ["Run npm test"],
            "Next.js production build": ["Run npm run build"],
            "Docker smoke 구현": ["Docker image build"],
            "Main 임시 commit 이미지 게시·검증·정리": [
                "임시 commit 이미지 빌드·게시", "exact published digest pull",
                "게시 image policy 검증", "게시 image readiness 검증",
                "게시 image SQLite persistence 검증",
                "Project·Task API persistence 검증",
                "게시 digest HTTP·HTTPS browser 검증",
                "GHCR main commit image lifecycle handoff",
                "Main reuse candidate receipt 업로드",
            ],
            "Chromium E2E shard 1/2": ["E2E shard 실행", "E2E timing artifact 업로드"],
            "Chromium E2E shard 2/2": ["E2E shard 실행", "E2E timing artifact 업로드"],
        }
        return [{"name": name, "run_attempt": 1, "status": "completed", "conclusion": "success",
                 "steps": [{"name": item, "conclusion": "success"} for item in mandatory.get(name, [])]}
                for name in names]

    def test_full_job_provenance(self):
        jobs = self.sample()
        self.assertEqual(len(V.select_jobs(jobs, 2, 1)), len(jobs))
        cases = [
            lambda rows: rows.pop(-1),  # shard missing
            lambda rows: rows.append(dict(rows[-1])),  # same-name forged duplicate
            lambda rows: rows[0].update(conclusion="skipped"),
            lambda rows: rows[0].update(run_attempt=2),
            lambda rows: rows[-1]["steps"][0].update(conclusion="skipped"),
        ]
        for mutation in cases:
            with self.subTest(mutation=mutation):
                rows = self.sample()
                mutation(rows)
                with self.assertRaises(V.Ineligible):
                    V.select_jobs(rows, 2, 1)

    def timing_rows(self, bad=None):
        rows = []
        for shard in (1, 2):
            rec = {"schemaVersion": 1, "runId": "1234", "runAttempt": 1,
                   "headSha": "a" * 40, "eventName": "push", "status": "passed",
                   "shard": shard, "shardCount": 2, "skippedFiles": [],
                   "skippedCaseCount": 0,
                   "environment": {
                       "fullyParallel": True, "os": "linux",
                       "imageVersion": "20261022", "imageOS": "ubuntu24",
                       "runnerArch": "X64", "runnerOS": "Linux", "node": "22.1.0",
                   },
                   "entries": [{"file": f"tests/e2e/{shard}.spec.ts", "durationMs": 100}]}
            if bad and shard == 2:
                bad(rec)
            rows.append({"name": f"e2e-timing-ci-shard-{shard}", "id": shard,
                         "expired": False, "_zip": zipped(f"e2e-timing-shard-{shard}.json", rec)})
        return rows

    def test_main_e2e_reporter_fails_closed(self):
        manifest = {"profile": {
            "image_version": "20261022", "image_os": "ubuntu24",
            "runner_os": "Linux",
            "runner_arch": "X64", "node": "v22.1.0"},
            "test_inventory": {"case_count": 2},
            "_specs": ["tests/e2e/1.spec.ts", "tests/e2e/2.spec.ts"]}
        self.assertEqual(V.verify_timing(self.timing_rows(), 1234, 1, "a" * 40, 2, manifest), 2)
        changes = (
            lambda r: r.update(skippedCaseCount=1),
            lambda r: r.update(runAttempt=2),
            lambda r: r.update(status="interrupted"),
            lambda r: r["entries"].clear(),
            lambda r: r["environment"].update(imageVersion="another"),
            lambda r: r["entries"][0].update(file="tests/e2e/unknown.spec.ts"),
            lambda r: r["entries"].append(dict(r["entries"][0])),
        )
        for bad in changes:
            with self.subTest(bad=bad):
                with self.assertRaises(V.Ineligible):
                    V.verify_timing(self.timing_rows(bad), 1234, 1, "a" * 40, 2, manifest)

    def test_release_rollout_is_shadow_by_default(self):
        release = (ROOT / ".github/workflows/release-image.yml").read_text()
        main = (ROOT / ".github/workflows/ci.yml").read_text()
        self.assertIn("vars.RELEASE_REUSE_ENABLED || 'false'", release)
        self.assertIn("vars.RELEASE_REUSE_MAX_AGE_HOURS || ''", release)
        self.assertEqual(release.count("needs.prepare.outputs.reuse_mode != 'REUSED_VERIFIED'"), 2)
        self.assertIn("REUSE_MODE == \"REUSED_VERIFIED\"", release.replace("$REUSE_MODE", "REUSE_MODE"))
        self.assertIn("REUSE_VERIFIED_DIGEST", release)
        self.assertIn("source_sha", (ROOT / "scripts/release-reuse-evidence.py").read_text())
        self.assertIn("Main reuse candidate receipt 업로드", main)
        self.assertIn("Main reuse Playwright inventory 및 manifest (advisory)", main)
        self.assertIn("CI_E2E_FULLY_PARALLEL=true npm run --silent test:e2e -- --list --reporter=json", main)
        self.assertIn("Main verified candidate exact digest 확인", release)
        self.assertIn("최종 exact·rolling tag를 verified digest로 promotion", release)
        self.assertIn("Release 완료 lifecycle handoff", release)

    def test_absolute_or_relative_playwright_spec_normalization(self):
        payload = {"suites": [{"specs": [
            {"file": "a.spec.ts", "tests": [{}, {}]},
            {"file": "tests/e2e/b.spec.ts", "tests": [{}]},
            {"file": str(ROOT / "tests/e2e/c.spec.ts"), "tests": [{}]},
        ]}]}
        self.assertEqual(M.list_cases(payload), (
            {"tests/e2e/a.spec.ts", "tests/e2e/b.spec.ts", "tests/e2e/c.spec.ts"}, 4
        ))
        for bad in ("../outside.spec.ts", "/outside/e2e/a.spec.ts"):
            with self.subTest(file=bad), self.assertRaises(ValueError):
                M.list_cases({"suites": [{"specs": [{"file": bad, "tests": [{}]}]}]})

    def test_missing_artifact_and_expired(self):
        rows = self.timing_rows()
        with self.assertRaises(V.Ineligible):
            V.unique_artifact(rows + [dict(rows[0])], "e2e-timing-ci-shard-1")
        rows[0]["expired"] = True
        with self.assertRaises(V.Ineligible):
            V.unique_artifact(rows, "e2e-timing-ci-shard-1")

if __name__ == "__main__":
    unittest.main()
