#!/usr/bin/env python3
"""Validate deterministic synthetic Playwright Visual Evidence (Issue #896).

This is an artifact integrity/geometry guard, NOT autonomous DESIGN.md
approval, functional UAT, GitHub Trusted QA, or CI release authorization.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import time
from urllib.parse import quote
from pathlib import Path

SHA = re.compile(r"[0-9a-f]{40}\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")
AC = re.compile(r"AC[0-9]{2,4}\Z")
FILE = re.compile(r"ui-evidence-[a-zA-Z0-9_-]+\.png\Z")
SCHEMA = "mastergantt-ui-evidence/v1"
SCHEMA_V2 = "mastergantt-ui-evidence/v2"
PNG_MAGIC = bytes.fromhex("89504e470d0a1a0a")


class EvidenceError(ValueError):
    """불충분한 출처는 BLOCKED, 실행된 증거의 불일치는 FAIL이다."""
    def __init__(self, message: str, status: str = "BLOCKED"):
        super().__init__(message)
        self.status = status


def ensure(ok: bool, message: str) -> None:
    if not ok:
        raise EvidenceError(message)


def checked_json(parent: Path, metadata: dict, pattern: str) -> object:
    ensure(isinstance(metadata, dict) and isinstance(metadata.get("name"), str) and
           re.fullmatch(pattern, metadata["name"]) and
           DIGEST.fullmatch(str(metadata.get("sha256", ""))), "JSON 산출물 식별자 오류")
    path = parent / metadata["name"]
    ensure(path.is_file() and not path.is_symlink() and path.stat().st_size <= 512 * 1024,
           "JSON 산출물 누락, symlink 또는 크기 초과")
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != metadata["sha256"]:
        raise EvidenceError("JSON 산출물 checksum 불일치", "FAIL")
    return json.loads(raw)


def validate_v2(data: dict, parent: Path, expected: dict) -> None:
    for key in ("baselineSha", "testMergeSha"):
        ensure(SHA.fullmatch(str(data.get(key, ""))) is not None, key + " 누락 또는 형식 오류")
    ensure(isinstance(expected, dict), "기대 출처 구조 오류")
    ensure(isinstance(data.get("provenance"), dict), "실행 출처 누락")
    for key, value in expected.items():
        if key == "environment":
            ensure(isinstance(value, dict), "기대 환경 구조 오류")
            for field, expected_value in value.items():
                ensure(data["environment"].get(field) == expected_value,
                       "환경 drift: " + field)
        elif key in ("pr", "repository", "runId", "runAttempt"):
            ensure(data["provenance"].get(key) == value, "Actions/PR 출처 불일치: " + key)
        else:
            ensure(data.get(key) == value, "증거 출처 불일치: " + key)
    provenance = data.get("provenance")
    ensure(isinstance(provenance, dict) and provenance.get("kind") in ("local", "github-actions") and
           type(provenance.get("workingTreeDirty")) is bool, "실행 출처 누락")
    for field in ("workingDiffSha256", "testSourceSha256", "helperSourceSha256"):
        ensure(DIGEST.fullmatch(str(provenance.get(field, ""))), "실행 fingerprint 누락: " + field)
    ensure(type(data.get("captureDurationMs")) is int and data["captureDurationMs"] >= 0,
           "수집 소요시간 누락")
    pr = provenance.get("pr")
    ensure(pr is None or type(pr) is int and pr > 0, "PR 출처 형식 오류")
    if provenance["kind"] == "github-actions":
        ensure(re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", str(provenance.get("repository", ""))) and
               all(type(provenance.get(k)) is int and provenance[k] > 0
                   for k in ("runId", "runAttempt")), "Actions 출처 누락")
    env = data["environment"]
    for field in ("browserVersion", "playwrightVersion", "os", "osRelease", "font", "theme",
                  "cssZoom", "timezone", "documentLocale", "observedTime"):
        ensure(isinstance(env.get(field), str) and 0 < len(env[field]) <= 500,
               "렌더링 환경 누락: " + field)
    ensure(type(env.get("deviceScaleFactor")) in (float, int) and
           math.isfinite(env["deviceScaleFactor"]) and 0 < env["deviceScaleFactor"] <= 8,
           "장치 배율 오류")
    ensure(re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z", env["observedTime"]), "브라우저 시간 오류")
    geometry = checked_json(parent, data.get("geometryFile"), r"geometry-[A-Za-z0-9_-]+\.json")
    if geometry != data["geometry"]:
        raise EvidenceError("embedded geometry와 원본 JSON 불일치", "FAIL")
    fixture = data["fixture"]
    ensure(fixture.get("scope") in ("DATA_CAPTURED", "DECLARATION_ONLY"), "Fixture 검증 범위 누락")
    fixture_data = checked_json(parent, {"name": fixture.get("file"), "sha256": fixture.get("sha256")},
                                r"fixture-[A-Za-z0-9_-]+\.json")
    ensure(isinstance(fixture_data, (dict, list)), "합성 Fixture JSON 구조 오류")
    test = data.get("test")
    ensure(isinstance(test, dict) and all(isinstance(test.get(k), str) and 0 < len(test[k]) <= 1000
           for k in ("id", "title", "project")) and
           test.get("outcome") == "CAPTURED_BEFORE_TEST_COMPLETION", "실제 테스트 참조 누락")
    flow = data.get("flow")
    ensure(isinstance(flow, dict) and isinstance(flow.get("id"), str) and 0 < len(flow["id"]) <= 100 and
           flow.get("outcome") in ("PASS", "FAIL", "NOT TESTED") and isinstance(flow.get("steps"), list) and
           len(flow["steps"]) <= 30 and all(isinstance(s, str) and 0 < len(s) <= 500 for s in flow["steps"]),
           "업무 흐름 참조 오류")
    ensure(flow["outcome"] == "NOT TESTED" or bool(flow["steps"]), "업무 흐름 단계 누락")
    ensure(data.get("ownerReview") == "NOT TESTED", "자동 증거로 Owner 수용 위조 불가")
    exclusions = data.get("exclusions")
    ensure(isinstance(exclusions, list) and len(exclusions) <= 30 and all(
           isinstance(item, dict) and all(isinstance(item.get(k), str) and 0 < len(item[k]) <= 500
               for k in ("scope", "reason")) for item in exclusions), "미검증 제외 근거 오류")
    checks = data.get("checks")
    ensure(isinstance(checks, list) and len(checks) <= 50, "측정 참조 오류")
    for check in checks:
        ensure(isinstance(check, dict) and check.get("ac") in data["acceptanceCriteria"] and
               all(isinstance(check.get(k), str) and 0 < len(check[k]) <= 500
                   for k in ("designRef", "measurement")) and
               check.get("outcome") in ("PASS", "FAIL", "NOT TESTED"), "측정 DESIGN/AC 참조 오류")
        for key in ("expected", "actual"):
            value = check.get(key)
            ensure(type(value) in (str, bool, int, float) and
                   (not isinstance(value, float) or math.isfinite(value)), "측정값 오류")
        if "tolerance" in check:
            ensure(type(check["tolerance"]) in (int, float) and math.isfinite(check["tolerance"]) and
                   check["tolerance"] >= 0, "측정 허용오차 오류")
        if check["outcome"] == "PASS":
            actual, expected_value = check["actual"], check["expected"]
            both_numeric = type(actual) in (int, float) and type(expected_value) in (int, float)
            matches = abs(actual - expected_value) <= check.get("tolerance", 0) if both_numeric else type(actual) is type(expected_value) and actual == expected_value
            if not matches:
                raise EvidenceError("PASS 측정값이 기대값/허용오차와 불일치", "FAIL")


def validate_manifest(manifest_path: Path, *, expected: dict | None = None,
                      require_v2: bool = False) -> dict:
    """Fail closed on malformed/unsafe artifacts; allow only synthetic fixtures."""
    ensure(manifest_path.is_file() and not manifest_path.is_symlink(),
           "manifest file not found or is symlink")
    ensure(manifest_path.stat().st_size <= 32 * 1024, "manifest too large")
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    ensure(isinstance(data, dict) and data.get("schema") in (SCHEMA, SCHEMA_V2),
           "unsupported evidence schema")
    ensure(not require_v2 or data["schema"] == SCHEMA_V2,
           "v1은 과거 무결성 증거이며 v2 계약 검증을 대체할 수 없음")
    ensure(data.get("verdict") == "OBSERVED_NOT_APPROVED",
           "screenshot cannot self-attest UI acceptance")
    ensure(type(data.get("issue")) is int and 0 < data["issue"] < 1_000_000_000,
           "issue identity invalid")
    ensure(SHA.fullmatch(str(data.get("sourceSha", ""))) is not None,
           "source SHA invalid")
    acs = data.get("acceptanceCriteria")
    ensure(isinstance(acs, list) and 0 < len(acs) <= 12 and
           all(isinstance(a, str) and AC.fullmatch(a) for a in acs) and
           len(set(acs)) == len(acs), "AC identities invalid")
    fixture = data.get("fixture")
    ensure(isinstance(fixture, dict) and fixture.get("kind") == "synthetic" and
           isinstance(fixture.get("name"), str) and 0 < len(fixture["name"]) <= 80,
           "public CI artifacts must contain synthetic fixtures only")
    env = data.get("environment")
    ensure(isinstance(env, dict) and env.get("browser") == "chromium",
           "browser environment unknown")
    viewport = env.get("viewport")
    ensure(isinstance(viewport, dict) and
           all(type(viewport.get(k)) is int and 1 <= viewport[k] <= 8192
               for k in ("width", "height")), "viewport invalid")
    ensure(env.get("locale") in ("ko", "en", "vi"), "locale invalid")
    ensure(isinstance(data.get("state"), str) and
           re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", data["state"]),
           "state identifier invalid")
    geo = data.get("geometry")
    ensure(isinstance(geo, list) and 1 <= len(geo) <= 20, "geometry missing")
    names = set()
    for rect in geo:
        ensure(isinstance(rect, dict) and isinstance(rect.get("name"), str) and
               re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", rect["name"]) and
               rect["name"] not in names, "geometry identity invalid")
        names.add(rect["name"])
        ensure(all(type(rect.get(k)) in (float, int) and
                   math.isfinite(rect[k]) and abs(rect[k]) <= 1_000_000
                   for k in ("x", "y", "width", "height")) and
               rect["width"] > 0 and rect["height"] > 0,
               "geometry contains missing/non-finite/empty element")
    screenshot = data.get("screenshot")
    ensure(isinstance(screenshot, dict) and
           isinstance(screenshot.get("name"), str) and
           FILE.fullmatch(screenshot["name"]) and
           DIGEST.fullmatch(str(screenshot.get("sha256", ""))),
           "screenshot metadata invalid")
    image = manifest_path.parent / screenshot["name"]
    ensure(not image.is_symlink(), "screenshot symlink 차단")
    if not image.is_file():
        raise EvidenceError("필수 screenshot 누락", "NOT TESTED")
    ensure(16 <= image.stat().st_size <= 12 * 1024 * 1024,
           "screenshot 크기 오류")
    image_bytes = image.read_bytes()
    if not image_bytes.startswith(PNG_MAGIC):
        raise EvidenceError("screenshot not PNG", "FAIL")
    if hashlib.sha256(image_bytes).hexdigest() != screenshot["sha256"]:
        raise EvidenceError("screenshot checksum mismatch", "FAIL")
    if data["schema"] == SCHEMA_V2:
        validate_v2(data, manifest_path.parent, expected or {})
    elif expected:
        ensure(False, "v1은 확장 출처/환경 비교 검증 불가")
    return {"issue": data["issue"], "sourceSha": data["sourceSha"],
            "state": data["state"], "ac": acs, "schema": data["schema"],
            "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
            "flowOutcome": (data.get("flow") or {}).get("outcome", "NOT TESTED"),
            "fixtureScope": fixture.get("scope", "DECLARATION_ONLY"),
            "failedMeasurementCount": sum(check.get("outcome") == "FAIL" for check in data.get("checks", [])),
            "verdict": "EVIDENCE_INTEGRITY_VERIFIED_NOT_UAT"}


def canonical_manifests(directory: Path) -> list[Path]:
    """Only producer originals are canonical; Playwright /attachments are renamed copies.

    testInfo.attach(path=...) copies both JSON and PNG to a nested attachments
    directory with a content-hash suffix. The copied JSON still references the
    original PNG basename, so validating it as a new manifest is a false FAIL.
    The original sibling pair remains subject to every integrity check.
    """
    return sorted(
        path for path in directory.rglob("ui-evidence-*.json")
        if "attachments" not in path.relative_to(directory).parts[:-1]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Playwright test-results root")
    parser.add_argument("--source-sha")
    parser.add_argument("--baseline-sha")
    parser.add_argument("--test-merge-sha")
    parser.add_argument("--pr", type=int)
    parser.add_argument("--repository")
    parser.add_argument("--run-id", type=int)
    parser.add_argument("--run-attempt", type=int)
    parser.add_argument("--require-v2", action="store_true")
    parser.add_argument("--summary", type=Path)
    parser.add_argument("--allow-empty", action="store_true")
    args = parser.parse_args()
    started = time.monotonic()
    empty_evidence = False
    try:
        ensure(args.directory.is_dir(), "test-results directory missing")
        files = canonical_manifests(args.directory)
        if not files:
            empty_evidence = True
            raise EvidenceError("캡처된 합성 UI 증거 없음", "NOT TESTED")
        ensure(len(files) <= 150, "too many evidence manifests")
        expected = {key: value for key, value in (("sourceSha", args.source_sha),
                    ("baselineSha", args.baseline_sha), ("testMergeSha", args.test_merge_sha), ("pr", args.pr),
                    ("repository", args.repository), ("runId", args.run_id), ("runAttempt", args.run_attempt))
                    if value is not None}
        outcomes = [validate_manifest(file, expected=expected, require_v2=args.require_v2) for file in files]
        failed = any(result["flowOutcome"] == "FAIL" or result["failedMeasurementCount"] > 0 for result in outcomes)
        if args.summary:
            lines = ["## 합성 UI 증거 (Owner UAT 수용 아님)", "",
                     f"무결성 검증: {len(outcomes)}건; 검증 소요 {time.monotonic() - started:.3f}초.", "",
                     "|상태|Source / Base / Test merge|Run / Attempt|Flow / 실패 측정|산출물 / Manifest SHA256|Bytes|", "|---|---|---|---|---|---|"]
            for path, result in zip(files, outcomes):
                data = json.loads(path.read_text(encoding="utf-8"))
                sibling_names = [data["screenshot"]["name"]]
                if data.get("geometryFile"):
                    sibling_names += [data["geometryFile"]["name"], data["fixture"]["file"]]
                artifact_paths = [path] + [path.parent / name for name in sibling_names]
                links = " / ".join("[" + label + "](" + quote(str(file.relative_to(args.directory)), safe="/") + ")"
                                   for label, file in zip(("Manifest", "PNG", "Geometry", "Fixture"), artifact_paths))
                provenance = data.get("provenance") or {}
                source = result["sourceSha"] + " / " + data.get("baselineSha", "NOT TESTED") + " / " + data.get("testMergeSha", "NOT TESTED")
                lines.append(f"|{result['state']}|{source}|{provenance.get('runId')} / {provenance.get('runAttempt')}|{result['flowOutcome']} / {result['failedMeasurementCount']}|{links}<br>{result['manifestSha256']}|{sum(f.stat().st_size for f in artifact_paths)}|")
            lines += ["", "링크는 업로드된 artifact 내부 상대 경로입니다. 실제 Test 최종 결과·수동 화면 수용은 별도 확인합니다.", ""]
            args.summary.write_text("\n".join(lines), encoding="utf-8")
        print(json.dumps({"status": "EVIDENCE_VERIFIED_NOT_UAT",
                          "observationStatus": "FAIL" if failed else "OBSERVED_NOT_APPROVED",
                          "observedFailures": sum(result["flowOutcome"] == "FAIL" or result["failedMeasurementCount"] > 0 for result in outcomes),
                          "count": len(outcomes), "results": outcomes},
                         ensure_ascii=False, sort_keys=True))
        return 0
    except (EvidenceError, OSError, json.JSONDecodeError, UnicodeError) as exc:
        print(json.dumps({"status": exc.status if isinstance(exc, EvidenceError) else "BLOCKED",
                          "reason": str(exc)[:300]}, ensure_ascii=False))
        if args.summary:
            status = exc.status if isinstance(exc, EvidenceError) else "BLOCKED"
            args.summary.write_text("## 합성 UI 증거\n\n상태: " + status +
                                    ". 자세한 사유는 검증 로그에서 확인합니다.\n", encoding="utf-8")
        return 0 if args.allow_empty and empty_evidence else 1


if __name__ == "__main__":
    sys.exit(main())
