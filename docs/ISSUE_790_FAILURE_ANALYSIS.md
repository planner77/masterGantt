# Issue #790 — single cumulative failure/decision ledger (2026-10-31)

Primary [#790](https://github.com/planner77/masterGantt/issues/790) · Parent [#444](https://github.com/planner77/masterGantt/issues/444) · Legacy [PR #791](https://github.com/planner77/masterGantt/pull/791)

## Source and scope

- Latest Main at implementation start: `3c73737968dfdbd6817657f3a17bed07c209a528`, app `0.138.5`, Chromium E2E **8 shards**; new branch `ci/issue-790-cache-audit-current-main`.
- Old PR #791 Head `b5898d49b4e0f8b610744bc22494b12687d29473`, old base `4ce403a1e410ca599a780446f39513e1f1158326`, app `0.130.2`. Prior [Full PR #3218.1](https://github.com/planner77/masterGantt/actions/runs/40056085324) belongs to the old source only. **It is not a PASS for new Head.**
- All changes are CLI comparison/test/report documentation. No actual cache writes or workflow changes, no required checks removed, no semantic version release authorization.

## Historical measurements (not current causal results)

| ID | Provenance/observation | Classification | Disposition |
| --- | --- | --- | --- |
| H790-001 | [Historical readiness 38109419594](https://github.com/planner77/masterGantt/actions/runs/38109419594) vs [40046472198](https://github.com/planner77/masterGantt/actions/runs/40046472198): PR Docker 97.482s → 90.520s, PR job renamed `docker_smoke` → `pr_docker_smoke` | `REVIEW_REQUIRED` | Do not claim same workload or `ADOPT` |
| H790-002 | Same baseline/after: Main Docker 112.402s → 144.491s (+28.55%), runner-minutes also up | `REGRESSION_CANDIDATE`, causal UNKNOWN | #444 retains Main cost investigation |
| H790-003 | [2026-10-31 readiness 41149264718](https://github.com/planner77/masterGantt/actions/runs/41149264718): PR 14/19 groups; min distinct successful runs 5/10 (Main 20/10, Release 25/10) | `COLLECTING` | No new cache policy or global rollout |
| H790-004 | Old PR #791 code/docs are anchored to app 0.130.2, older workflow/CI paths | `STALE_SOURCE` | Selective port onto latest Main, do not overwrite modern source/docs or reuse old CI success |

## Test lifecycle / negative cases

- Reuse `tests/scripts/ci-cache-phase2.test.ts` (EXTEND) and keep `tests/scripts/ci-setup-provenance.test.ts`, `tests/scripts/ci-setup-readiness.test.ts`, `scripts/verify-ci-cache-contract.mjs` independent (KEEP_UNIQUE).
- Numeric comparison may report metrics only when complete explicit scope, validated statistics, minimum ten successful distinct runs and trusted provenance assertions are supplied. A local JSON `requireBoundProvenance` flag is not a signed source attestation; even an unchanged focused job improving costs remains **REVIEW_REQUIRED, ADOPT=0** until a separately audited source is accepted.
- Missing renamed-job evidence link, partial scope, unrelated events, duplicate metric keys, invalid runner minutes, false provenance and insufficient samples are negative cases. Preserve old global output compatibility and test names; no skip/retry/timeout changes.
- Local Node/Vitest test environment here is not connected to the complete repository. **Typecheck, Vitest, CI policy and Docker runtime have not been executed locally**. Do not convert the old CI results to new Head PASS.

## New source CI/QA ledger

| Run/Attempt | Head/Base/Tree | Primary Failure / Derived / Not-run | Corrective action |
| --- | --- | --- | --- |
| PENDING | New exact PR Head and Main base to be recorded after PR creation | `NOT TESTED` | Required Quality/Chromium8/Docker + Trusted QA/Owner review before merge; Main CI/Release N/A until appropriate lifecycle |

## Parent close safety

- #790 is eligible for `completed` only after **its own** exact PR/Trusted QA/Owner approval, merge, Main CI/OCI if required, and Finalizer.
- #444 remains **OPEN** until measured cache miss/stale/secret safety, trustworthy before/after ROI, and explicit `ADOPT / DO_NOT_ADOPT / INSUFFICIENT_DATA` decision.
- A PASS for #790 is not a PASS for #444 AC4–AC7 and never authorizes CI guard changes or GHCR formal tags.
