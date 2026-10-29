# Issue #857 — cumulative PR CI failure, review and merge-conflict ledger

- Primary Issue: https://github.com/planner77/masterGantt/issues/857
- Release branch: `release/issue-857-v0.138.3`, PR [#858](https://github.com/planner77/masterGantt/pull/858)
- Original main baseline: `3dd20ff3da5f3b3f8a6c337bdc61593c81c4daae`
- Risk HIGH, OWNER_MANAGED, required PR Quality/Chromium E2E8/Docker, Trusted QA and exact main/release gates **unchanged**.
- Authorized `0.138.3` formal release: [trusted Owner comment](https://github.com/planner77/masterGantt/issues/857#issuecomment-6509116199), but it is not a substitute for failed CI.
- Historical #854 failures and FINAL are preserved in their own ledger; #857 failures are not reattributed.

## Cumulative records

| ID | PR HEAD / Run & Attempt | Classification | Original cause/evidence | Downstream impact | Action / status |
| --- | --- | --- | --- | --- | --- |
| F857-PR-001 | `b0315fcc4ffd6116c90cd45c0301c33fac4e7b3b`; [40961264343.1](https://github.com/planner77/masterGantt/actions/runs/40961264343) | **Direct QA Preflight** | Job `123754488561` failed `ISSUE_AC`: Issue body had six unlabelled checkbox criteria; `Primary Issue 본문에 AC1.. 식별자 없음`. Other seven metadata/route checks passed. | PR Fast `123754636298` FAIL; Required Quality `123754797467`, E2E `123754797704`, Docker `123754797681`, Automated QA `123754843560` **derived FAIL**. Actual TypeScript, ESLint, Vitest, Next, Chromium8, Docker and GHCR **SKIPPED/NOT RUN**. | Label original Issue criteria **AC1–AC6**; align docs/test mapping and this cumulative ledger; new exact-HEAD PR CI **NOT TESTED** until started/completed |
| DOC857-001 | Original `b0315fcc` Work Packet | Preventive, **not another executed failure** | `qa_preflight.py` only invokes `docs_gate` when Issue AC markers exist. Old Work Packet had combined heading and human-formatted `N/A (...)` lines; trusted validator expects standalone `## AC_TEST_COVERAGE` and `N/A(reason)` exact format. | Potential second deterministic preflight failure if original doc format retained; **not observed** in Run 40961264343.1. | Restructure headings and all required `DOCUMENTATION_SYNC` entries, map AC1–AC6 before new CI |
| REV857-001 | PR #858, source Head `b0315fcc` | Review audit | GraphQL review threads `[]`, GitHub PR reviews `[]`. | No unresolved review thread as inspected, not an independent QA PASS. | No thread to resolve; recheck at future latest Head |
| CONFLICT857-001 | Main `3dd20ff`, Head `b0315fcc` | Source/merge audit | GitHub `mergeable=true`; comparison `status=ahead`, `ahead_by=1`, `behind_by=0`, exact Base `3dd20ff`. | No content merge conflict at inspection. | Preserve main, no force push/rebase necessary, re-evaluate if base advances |

## F857-PR-001 — direct vs derived analysis

The trusted base `scripts/qa_preflight.py` uses regex `\\bAC\\d+\\b` on Issue text. Without labels, a deterministic FAIL occurs while `DOCUMENTATION_SYNC` is **not executed**. The original Run [#3436.1](https://github.com/planner77/masterGantt/actions/runs/40961264343) Preflight summary records **FAIL=1, DEFERRED=5** with metadata/path checks PASS. Fast Gate's `PREFLIGHT_RESULT=failure` caused cancellation/skipping of the heavy path. Aggregated Required failures are not equivalent to actual failing browser or Docker assertions. Do not change QA validators, required gate policy or unrelated product code.

The correction covers both the immediately observed direct error and the bounded, source-identified deferred docs gate, without inventing a second historical failure. Previous run ID, attempt and original HEAD are immutable. A new synchronized full run is needed.

## Review / Main alignment and next gate

As checked before corrective commit: no open review threads, no human reviews, and no detected merge conflicts; original HEAD aligned with latest main `3dd20ff...` (ahead 1, behind 0). Because the corrective commit changes HEAD, all previous PR CI/QA verdicts become stale. New PR CI must run, Owner review remain pending, and merging/Main CI/Release/GHCR publishing are outside this request.
