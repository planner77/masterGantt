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
from pathlib import Path

SHA = re.compile(r"[0-9a-f]{40}\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")
AC = re.compile(r"AC[0-9]{2,4}\Z")
FILE = re.compile(r"ui-evidence-[a-zA-Z0-9_-]+\.png\Z")
SCHEMA = "mastergantt-ui-evidence/v1"
PNG_MAGIC = bytes.fromhex("89504e470d0a1a0a")


class EvidenceError(ValueError):
    pass


def ensure(ok: bool, message: str) -> None:
    if not ok:
        raise EvidenceError(message)


def validate_manifest(manifest_path: Path) -> dict:
    """Fail closed on malformed/unsafe artifacts; allow only synthetic fixtures."""
    ensure(manifest_path.is_file() and not manifest_path.is_symlink(),
           "manifest file not found or is symlink")
    ensure(manifest_path.stat().st_size <= 32 * 1024, "manifest too large")
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    ensure(isinstance(data, dict) and data.get("schema") == SCHEMA,
           "unsupported evidence schema")
    ensure(data.get("verdict") == "OBSERVED_NOT_APPROVED",
           "screenshot cannot self-attest UI acceptance")
    ensure(isinstance(data.get("issue"), int) and 0 < data["issue"] < 1_000_000_000,
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
    ensure(image.is_file() and not image.is_symlink() and
           16 <= image.stat().st_size <= 12 * 1024 * 1024,
           "screenshot missing, symlink, or too large")
    image_bytes = image.read_bytes()
    ensure(image_bytes.startswith(PNG_MAGIC), "screenshot not PNG")
    ensure(hashlib.sha256(image_bytes).hexdigest() == screenshot["sha256"],
           "screenshot checksum mismatch")
    return {"issue": data["issue"], "sourceSha": data["sourceSha"],
            "state": data["state"], "ac": acs,
            "verdict": "EVIDENCE_INTEGRITY_VERIFIED_NOT_UAT"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="Playwright test-results root")
    args = parser.parse_args()
    try:
        ensure(args.directory.is_dir(), "test-results directory missing")
        files = list(args.directory.rglob("ui-evidence-*.json"))
        ensure(bool(files), "NOT TESTED: no synthetic Visual Evidence captured")
        ensure(len(files) <= 150, "too many evidence manifests")
        outcomes = [validate_manifest(file) for file in files]
        print(json.dumps({"status": "EVIDENCE_VERIFIED_NOT_UAT",
                          "count": len(outcomes), "results": outcomes},
                         ensure_ascii=False, sort_keys=True))
        return 0
    except (EvidenceError, OSError, json.JSONDecodeError, UnicodeError) as exc:
        print(json.dumps({"status": "BLOCKED",
                          "reason": str(exc)[:300]}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
