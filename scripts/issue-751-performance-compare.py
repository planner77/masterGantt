#!/usr/bin/env python3
"""Issue #751: compare sanitized E2E timing receipts; never read raw HAR/Trace.

Only complete 6-shard or 8-shard successful immutable source groups qualify. Missing,
cancelled, expired, and mixed-environment evidence remains INSUFFICIENT_DATA.
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import re
from collections import defaultdict

HEX_SHA = re.compile(r"^[0-9a-f]{40}$", re.I)
RUN_ID = re.compile(r"^[1-9][0-9]*$")
MAX_JSON_BYTES = 10_000_000
MAX_ARTIFACTS = 900
ALLOWED_METRICS = {"fixture", "server", "api", "sql", "http_calls"}


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return round(ordered[max(0, math.ceil(len(ordered) * fraction) - 1)], 2)


def valid_source(row: object) -> bool:
    return (
        isinstance(row, dict)
        and row.get("schemaVersion") == 1
        and isinstance(row.get("runId"), str)
        and RUN_ID.fullmatch(row["runId"]) is not None
        and type(row.get("runAttempt")) is int and row["runAttempt"] >= 1
        and isinstance(row.get("headSha"), str) and HEX_SHA.fullmatch(row["headSha"])
        and row.get("eventName") in {"push", "pull_request"}
        and row.get("status") == "passed"
        and type(row.get("shardCount")) is int and row["shardCount"] in {6, 8}
        and type(row.get("shard")) is int and 1 <= row["shard"] <= row["shardCount"]
        and isinstance(row.get("receipts"), list)
        and isinstance(row.get("environment"), dict)
        and isinstance(row["environment"].get("node"), str)
        and row["environment"].get("os") in {"linux", "win32", "darwin"}
        and type(row["environment"].get("fullyParallel")) is bool
    )


def scanned_artifacts(directory: pathlib.Path) -> tuple[list[dict], list[dict]]:
    artifacts: list[dict] = []
    rejected: list[dict] = []
    files = sorted(directory.rglob("e2e-timing-shard-*.json"))[:MAX_ARTIFACTS + 1]
    if len(files) > MAX_ARTIFACTS:
        return [], [{"reason": "ARTIFACT_LIMIT_EXCEEDED"}]
    for file in files:
        try:
            if file.stat().st_size > MAX_JSON_BYTES:
                raise ValueError("large")
            item = json.loads(file.read_text(encoding="utf-8"))
            if not valid_source(item):
                raise ValueError("source")
            artifacts.append(item)
        except (OSError, ValueError, TypeError):
            rejected.append({"reason": "INVALID_OR_UNREADABLE"})
    return artifacts, rejected


def complete_runs(artifacts: list[dict]) -> tuple[list[dict], list[dict]]:
    by_run: dict[str, list[dict]] = defaultdict(list)
    for artifact in artifacts:
        by_run[artifact["runId"]].append(artifact)
    accepted: list[dict] = []
    failures: list[dict] = []
    for run_id, items in sorted(by_run.items(), key=lambda pair: int(pair[0])):
        sig = {(i["runAttempt"], i["headSha"], i["eventName"], i["shardCount"]) for i in items}
        shards = [i["shard"] for i in items]
        counts = {i["shardCount"] for i in items}
        count = next(iter(counts)) if len(counts) == 1 else 0
        if count not in {6, 8} or len(items) != count or set(shards) != set(range(1, count + 1)) or len(sig) != 1:
            failures.append({"runId": run_id, "reason": "INCOMPLETE_OR_MIXED_RUN"})
            continue
        accepted.extend(items)
    return accepted, failures


def observations(artifacts: list[dict]) -> dict[tuple, dict[str, float]]:
    """At most one result per (immutable run, stable test, stage/route metric)."""
    groups: dict[tuple, dict[str, float]] = defaultdict(dict)
    for artifact in artifacts:
        env = artifact["environment"]
        source_context = (env["os"], env["node"], env["fullyParallel"],
                          artifact["eventName"], artifact["shardCount"], artifact["shard"])
        for receipt in artifact["receipts"]:
            if not isinstance(receipt, dict):
                continue
            source = receipt.get("source") or {}
            if (receipt.get("schemaVersion") != 2 or receipt.get("resultStatus") != "passed"
                or receipt.get("status") != "ok" or source.get("retry") != 0
                or source.get("runId") != artifact["runId"]
                or source.get("attempt") != artifact["runAttempt"]
                or source.get("checkoutSha") != artifact["headSha"]
                or not isinstance(source.get("testId"), str)
                or not isinstance(source.get("project"), str)):
                continue
            key_prefix = (*source_context, source["project"], source["testId"])
            run_id = artifact["runId"]
            stages: dict[str, float] = defaultdict(float)
            for stage in receipt.get("stages", []):
                if not isinstance(stage, dict) or stage.get("outcome") != "ok":
                    continue
                value = stage.get("durationMs")
                name = stage.get("stage")
                if isinstance(name, str) and type(value) in (int, float) and math.isfinite(value) and value >= 0:
                    stages[name] += value
            for name, value in stages.items():
                groups[(*key_prefix, "fixture", name)][run_id] = value

            # Browser and fixture API are independent observers: do not add their
            # durations to get wall-clock or deduplicate overlapping operations.
            browser_count: dict[str, int] = defaultdict(int)
            for request in receipt.get("requests", []):
                if not isinstance(request, dict) or request.get("source") != "browser":
                    continue
                route = request.get("route")
                duration = request.get("durationMs")
                if (isinstance(route, str) and request.get("outcome") == "complete"
                    and type(duration) in (int, float) and math.isfinite(duration) and duration >= 0):
                    browser_count[route] += 1
            for name, count in browser_count.items():
                groups[(*key_prefix, "http_calls", name)][run_id] = count

            # Server samples are bounded: truncated/missing samples cannot prove
            # request or SQL counts and must not become zero-value successes.
            if receipt.get("serverEventsDiscarded") != 0:
                continue
            server: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
            for request in receipt.get("serverRequests", []):
                if not isinstance(request, dict):
                    continue
                route = request.get("route")
                if not isinstance(route, str):
                    continue
                for field in ("serverMs", "sqlStatementCount", "sqlExecutionMs"):
                    value = request.get(field)
                    if type(value) in (int, float) and math.isfinite(value) and value >= 0:
                        server[route][field] += value
            for name, metrics in server.items():
                for key, metric_name in (("serverMs", "server"),
                                         ("sqlStatementCount", "sql"),
                                         ("sqlExecutionMs", "sql")):
                    if key in metrics:
                        groups[(*key_prefix, metric_name, name + "/" + key)][run_id] = metrics[key]
    return groups


def compare(baseline_artifacts: list[dict], candidate_artifacts: list[dict],
            minimum_runs: int = 10) -> dict:
    baseline_complete, baseline_rejected = complete_runs(baseline_artifacts)
    candidate_complete, candidate_rejected = complete_runs(candidate_artifacts)
    old = observations(baseline_complete)
    new = observations(candidate_complete)
    rows = []
    for key in sorted(set(old) | set(new), key=str):
        left, right = old.get(key, {}), new.get(key, {})
        # Each independent test run contributes at most one observation.
        enough = len(left) >= minimum_runs and len(right) >= minimum_runs
        row = {
            "context": list(key[:8]), "kind": key[8], "metric": key[9],
            "baselineRuns": len(left), "candidateRuns": len(right),
            "status": "OBSERVED_WARNING_ONLY" if enough else "INSUFFICIENT_DATA",
        }
        if enough:
            old_values, new_values = list(left.values()), list(right.values())
            b50, b95 = percentile(old_values, .5), percentile(old_values, .95)
            c50, c95 = percentile(new_values, .5), percentile(new_values, .95)
            row.update({"baselineP50": b50, "baselineP95": b95,
                        "candidateP50": c50, "candidateP95": c95,
                        "p95DeltaPercent": round((c95 / b95 - 1) * 100, 2) if b95 > 0 else None})
        rows.append(row)
    return {
        "schemaVersion": 1, "warningOnly": True, "minimumIndependentRuns": minimum_runs,
        "baselineCompleteShardArtifacts": len(baseline_complete),
        "candidateCompleteShardArtifacts": len(candidate_complete),
        "baselineRejected": baseline_rejected, "candidateRejected": candidate_rejected,
        "rows": rows,
        "interpretation": "Comparative measurements only; no proven SQL/compile/fan-out causality.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-dir", type=pathlib.Path, required=True)
    parser.add_argument("--candidate-dir", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--summary", type=pathlib.Path, required=True)
    args = parser.parse_args()
    baseline, bad_baseline = scanned_artifacts(args.baseline_dir)
    candidate, bad_candidate = scanned_artifacts(args.candidate_dir)
    report = compare(baseline, candidate)
    report["invalidBaselineArtifacts"] = len(bad_baseline)
    report["invalidCandidateArtifacts"] = len(bad_candidate)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["## Issue #751 before/after — warning only", "",
             "- Evidence: exact 6/6 or 8/8 source-matched runs (never mixed), >=10 independent successful runs per cohort",
             f"- Baseline shards {report['baselineCompleteShardArtifacts']}; candidate shards {report['candidateCompleteShardArtifacts']}",
             f"- Invalid baseline/candidate artifact(s): {len(bad_baseline)}/{len(bad_candidate)}",
             "- Same OS/Node/parallelism/event/shard/project/test stable ID; incomplete never PASS."]
    for row in report["rows"][:30]:
        lines.append(f"- {row['kind']}/{row['metric']}: {row['baselineRuns']} -> {row['candidateRuns']} ({row['status']})"
                     + (f"; P95 {row['baselineP95']} -> {row['candidateP95']} ({row['p95DeltaPercent']}%)"
                        if row["status"] == "OBSERVED_WARNING_ONLY" else ""))
    if not report["rows"]:
        lines.append("- INSUFFICIENT_DATA (no comparable samples)")
    with args.summary.open("a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
