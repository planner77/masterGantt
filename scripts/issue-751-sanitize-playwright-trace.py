#!/usr/bin/env python3
"""Sanitize a local Playwright trace.zip into bounded HTTP timing evidence.

Never extracts archive members onto disk; SQL text, URLs, public IDs, headers,
cookies, post-data, response bodies, stack traces and error strings are excluded.
"""
from __future__ import annotations

import argparse
import json
import math
import pathlib
import re
import zipfile

MAX_ARCHIVE_BYTES = 150 * 1024 * 1024
MAX_NETWORK_MEMBER_BYTES = 30 * 1024 * 1024
MAX_EVENTS = 4000
MAX_LINE_BYTES = 250_000
METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
ROUTES = [
    (re.compile(r"/logistics/process-context$"), "process-context"),
    (re.compile(r"/assignment-targets$"), "assignment-targets"),
    (re.compile(r"/tasks/[^/]+/logistics-links$"), "task-logistics-links"),
    (re.compile(r"/resource-dashboard(?:/details)?$"), "resource-dashboard"),
    (re.compile(r"/target-bindings$"), "target-bindings"),
]


def route_category(url: object) -> str | None:
    if not isinstance(url, str):
        return None
    from urllib.parse import urlsplit
    try:
        location = urlsplit(url)
        path = location.path
    except ValueError:
        return None
    if not path.startswith("/api/"):
        return None
    for pattern, name in ROUTES:
        if pattern.search(path):
            return name
    return "other-api"


def valid_ms(value: object) -> float | None:
    if type(value) in (float, int) and math.isfinite(value) and value >= 0:
        return round(float(value), 2)
    return None


def snapshot_event(item: object) -> dict | None:
    if not isinstance(item, dict) or item.get("type") != "resource-snapshot":
        return None
    record = item.get("snapshot")
    if not isinstance(record, dict):
        return None
    request, response = record.get("request") or {}, record.get("response") or {}
    if not isinstance(request, dict) or not isinstance(response, dict):
        return None
    route = route_category(request.get("url"))
    if route is None:
        return None
    timings = record.get("timings") or {}
    if not isinstance(timings, dict):
        timings = {}
    duration = valid_ms(record.get("time"))
    if duration is None:
        begin = timings.get("startTime")
        end = timings.get("responseEnd")
        duration = valid_ms(end - begin) if type(begin) in (int, float) and type(end) in (int, float) else None
    method = request.get("method") if request.get("method") in METHODS else "OTHER"
    raw_status = response.get("status")
    status = raw_status if type(raw_status) is int and 100 <= raw_status <= 599 else None
    message = record.get("_failureText") or record.get("failure") or ""
    reason = str(message)[:1000] if isinstance(message, str) else ""
    if re.search(r"ABORT|CANCEL", reason, flags=re.I):
        outcome = "abort"
    elif re.search(r"TIMEOUT|timed out", reason, flags=re.I):
        outcome = "timeout"
    elif reason:
        outcome = "network"
    elif status is None:
        outcome = "incomplete"
    elif status >= 400:
        outcome = "http_error"
    else:
        outcome = "complete"
    # Synthetic monotonically ordered list; absolute timing is NOT inferred
    # when an original resource-snapshot supplies only a duration.
    return {"route": route, "method": method, "durationMs": duration,
            "status": status, "outcome": outcome,
            "startMs": valid_ms(record.get("_monotonicTime"))}


def sanitize_zip(source: pathlib.Path) -> dict:
    if source.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("trace.zip too large")
    events: list[dict] = []
    errors: list[str] = []
    dropped = 0
    network_members = 0
    with zipfile.ZipFile(source) as bundle:
        for member in bundle.infolist():
            if not member.filename.endswith(".network"):
                continue
            network_members += 1
            if member.file_size > MAX_NETWORK_MEMBER_BYTES:
                errors.append("NETWORK_MEMBER_TOO_LARGE")
                continue
            with bundle.open(member) as handle:
                for line in handle:
                    if len(line) > MAX_LINE_BYTES:
                        dropped += 1
                        continue
                    try:
                        event = snapshot_event(json.loads(line))
                    except (ValueError, TypeError, UnicodeDecodeError):
                        dropped += 1
                        continue
                    if not event:
                        continue
                    if len(events) < MAX_EVENTS:
                        events.append(event)
                    else:
                        dropped += 1
    # A missing network trace must not be treated as an empty successful capture.
    if not network_members:
        errors.append("NETWORK_TRACE_ABSENT")
    starts = [e["startMs"] for e in events if e["startMs"] is not None]
    minimum = min(starts) if starts else None
    for event in events:
        event["startMs"] = round(event["startMs"] - minimum, 2) if minimum is not None and event["startMs"] is not None else None
    return {
        "schemaVersion": 1, "source": "UNVERIFIED_LOCAL_PLAYWRIGHT_TRACE",
        "status": "OBSERVED_UNVERIFIED" if events and not errors and not dropped else "INCOMPLETE",
        "events": events, "dropped": dropped, "errors": errors,
        "provenance": "Original run/job/attempt/head/artifact must be independently authenticated",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--run-id", type=int)
    parser.add_argument("--attempt", type=int)
    parser.add_argument("--job-id", type=int)
    parser.add_argument("--artifact-id", type=int)
    parser.add_argument("--head-sha", default="")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        raise SystemExit("BLOCKED: input and output cannot coincide")
    result = sanitize_zip(args.input)
    if any(value is not None and value <= 0 for value in
           (args.run_id, args.attempt, args.job_id, args.artifact_id)):
        raise SystemExit("BLOCKED: invalid provenance")
    if args.head_sha and re.fullmatch(r"[a-fA-F0-9]{40}", args.head_sha) is None:
        raise SystemExit("BLOCKED: invalid SHA")
    result["sourceAttribution"] = {
        "runId": args.run_id, "attempt": args.attempt, "jobId": args.job_id,
        "artifactId": args.artifact_id, "headSha": args.head_sha or None,
        "verification": "CALLER_ASSERTED_UNVERIFIED",
    }
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
