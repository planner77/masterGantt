#!/usr/bin/env bash
set -euo pipefail

baseline_image=${1:?usage: verify-image-size-reduction.sh BASELINE_IMAGE CANDIDATE_IMAGE MIN_PERCENT [--summary]}
candidate_image=${2:?usage: verify-image-size-reduction.sh BASELINE_IMAGE CANDIDATE_IMAGE MIN_PERCENT [--summary]}
minimum_percent=${3:?usage: verify-image-size-reduction.sh BASELINE_IMAGE CANDIDATE_IMAGE MIN_PERCENT [--summary]}
mode=${4:-}

case "$mode" in
  ""|--summary|--summary-only) ;;
  *)
    echo "Unsupported mode: $mode" >&2
    exit 2
    ;;
esac

baseline_bytes="$(docker image inspect --format '{{.Size}}' "$baseline_image")"
candidate_bytes="$(docker image inspect --format '{{.Size}}' "$candidate_image")"

python3 - "$baseline_bytes" "$candidate_bytes" "$minimum_percent" "$mode" <<'PY'
import sys

baseline = int(sys.argv[1])
candidate = int(sys.argv[2])
minimum = float(sys.argv[3])
mode = sys.argv[4]

if baseline <= 0 or candidate <= 0:
    raise SystemExit("Docker image size must be positive.")

reduction = (baseline - candidate) * 100.0 / baseline

def mib(value: int) -> str:
    return f"{value / 1024 / 1024:.1f} MiB"

if mode in {"--summary", "--summary-only"}:
    print(f"- Baseline: `{mib(baseline)}` ({baseline} bytes)")
    print(f"- Candidate: `{mib(candidate)}` ({candidate} bytes)")
    requirement = "observational only" if mode == "--summary-only" else f"required >= {minimum:.2f}%"
    print(f"- Reduction: `{reduction:.2f}%` ({requirement})")
else:
    print(
        f"Docker image size: baseline={mib(baseline)}, "
        f"candidate={mib(candidate)}, reduction={reduction:.2f}%"
    )

if mode != "--summary-only" and reduction + 1e-9 < minimum:
    raise SystemExit(
        f"Docker image reduction {reduction:.2f}% is below required {minimum:.2f}%."
    )
PY
