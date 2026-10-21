# Issue #770 — trusted impact classifier & Shadow full-CI observation

- Primary Issue: [#770](https://github.com/planner77/masterGantt/issues/770), Epic [#769](https://github.com/planner77/masterGantt/issues/769).
- 2026-10-22 baseline: main `71f9b9ddb61be7f6e076accc027188f362e18bb1`, branch `ci/issue-770-trusted-impact-shadow`; application version `0.129.0` stays unchanged.
- Approval scope: Owner's subsequent instruction requests implementation and PR CI, **not** merge/production, GHCR or Release authorization. The old Issue description's registration-only boundary is superseded only for implementation and PR CI.
- `risk_level: HIGH`; `qa_method: OWNER_MANAGED`; `qa_required: true`; `independent_qa: N/A(OWNER_MANAGED)`; `manager_decision: NOT TESTED`.
- `release_required: false`; `release_authorized: false` (CI/QA infrastructure-only, no application behavior or SemVer change).
- Main/Ruleset/Release/QA/Finalizer/Rollback authority: **UNCHANGED**. No self-approved risk reduction.
- Owners: Manager (scope and acceptance), infra (CI read-only classifier), QA (trusted validation after new exact-head full PR CI).

## Design & trust boundary

1. `.github/workflows/ci.yml` appends `impact_shadow`, a separately named **nonblocking** advisory job after Quality/E2E/Docker results; it does not feed those aggregate `needs` or any QA/Release consumer. Existing PR 6-shard, Main 6-shard, fast gate, path filter and Docker smoke are untouched.
2. At PR time checkout the **event's exact base SHA**, never execute PR test-merge supplied Python. On the introducing PR, base lacks `scripts/ci_impact_plan.py`: output `NOT_TESTED` bootstrap. Later PRs use a trusted base policy blob. Main push uses its exact trusted commit. Event/run/attempt/PR, Head/Base/test-merge identity and synthetic merge parents are checked; ambiguous/refetch failure is `UNKNOWN`. Source JSON, tests and imports are read as **data** using Git; no PR code execution in Shadow.
3. Combine the base's existing #699 `scripts/prepr-core.mjs` producer→consumer map (which incorporates #697) with high-risk shared-core/server/security/calendar, direct Unit imports, explicit known independent UI/CSS, cross-consumer and historical failure evidence. Statuses include rename, add and delete. New/removed/undiscovered files, missing mapped test, test.skip/only, dynamic imports, unregistered asset or ambiguous consumer cause `FULL_REQUIRED`; path count and PR-declared LOW never downgrade it.
4. Output `mastergantt-impact-plan-v1`: trusted policy blob SHA, input diff binary SHA256, Head/Base/test-merge, PR/Issue candidate attribution, Run ID/attempt, risk, mode, selected/excluded discovered test IDs, basis, immutable plan SHA256, Python and #699 tool info, observation/evidence status. No trace/raw DB/secrets.
5. `ci-impact-shadow-<run>-<attempt>` retains 30-day sanitized JSON and Job Summary. Read-only GitHub API verifies actual same-attempt aggregate and six shard Job identities; if available, cross-check exact source in six E2E timing ZIPs, full test spec coverage, counted case entries and elapsed shard job timestamps. Reporter artifacts are *untrusted observations*, not PASS or permission. Actual failed, cancelled, partial, expired, missing or API-unknown results never turn into PASS.
6. Recommendation `FAST_TARGETED` and counterfactual `excluded_test_body_minutes_upper_bound` are **not** the actual CI reduction. Job elapsed runner-minutes, wall time and untrusted test-body theoretical upper bound are separated. No new full test suite executes in Shadow.
7. Rollback: remove only the new `impact_shadow` and Policy regression step (or temporarily disable the advisory job). Existing Full PR/Main CI and three Required checks remain the fallback; no Ruleset change.

## Change-impact/ledger replay source

- #697 and [#667 failure analysis](../../ISSUE_667_FAILURE_ANALYSIS.md): canonical peer-return, Delete, Gantt axis, grid reveal and Copy/Paste must include the adjacent six known browser families when Gantt files change.
- #730/#731/#736: edit authorization/assignment/resource response/real E2E timeout and fixture consumer guard.
- #732: Milestone/Calendar/full Gate UI cross-consumers.
- #767: newest primary issue and former #736 correction. Baseline had **no authenticated #767-dedicated failure ledger**, so do not invent one; representative security/revision path falls back to Full, source linkage remains to Issue/PR.
- The `tests/python/test_ci_impact_plan.py` fixed regression matrix covers representative file classes and source spoofing, **not exact historical commit replay**. Actual prior failed CI still needs its original source Head, run/attempt, failing spec/trace and test inventory to measure missed regressions. Missing history is `INSUFFICIENT_DATA`.

## Ten authenticated-looking historical Full CI candidates (snapshot)

Read on 2026-10-22 from GitHub Actions: event `pull_request`, workflow path `.github/workflows/ci.yml`, overall `success` and name `[전체 검증]`. For each row, an independent returned Job list contained **Quality=success, Chromium aggregate=success, Docker aggregate=success, and all six distinct PR E2E shard Jobs=success**. Each also had a not-expired `ci-pr-source-<run>-1` artifact and all six E2E timing artifact *metadata*. **The ZIP contents, exact historical Base/Test-Merge/diff and duration timestamps were not downloaded/cross-authenticated in this snapshot**. Thus none is a validated counterfactual replay, and no false-negative or elapsed-time figure is asserted.

| Run ID | Run #.attempt | PR (run title only) | Head SHA | observed 3 gates / 6 shards | exact diff, tests & timings |
|---|---|---|---|---|---|
| [39602089760](https://github.com/planner77/masterGantt/actions/runs/39602089760) | 3092.1 | 764 | `5abc65880879647a563c0469bf53c4cd4f654b6b` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39576210249](https://github.com/planner77/masterGantt/actions/runs/39576210249) | 3086.1 | 766 | `2c8cad503a98d145d29e833442db47097744a286` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39519738008](https://github.com/planner77/masterGantt/actions/runs/39519738008) | 3080.1 | 759 | `50fa26ce6c2a49652b13135ad59a9d9b8668dc0f` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39510527726](https://github.com/planner77/masterGantt/actions/runs/39510527726) | 3075.1 | 763 | `16165f695fd2edbabbd52b0bdf8ba8ac182ded97` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39501650409](https://github.com/planner77/masterGantt/actions/runs/39501650409) | 3072.1 | 763 | `1a776b0769d1d0f4bf5d1915059e96a2c3104aae` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39493898903](https://github.com/planner77/masterGantt/actions/runs/39493898903) | 3069.1 | 760 | `e7560fa9a117c3e72113901242d450f1021c2d8b` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39485797851](https://github.com/planner77/masterGantt/actions/runs/39485797851) | 3063.1 | 761 | `4995648542c0b16af5b5b5722985b6bacb7b4414` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39431198772](https://github.com/planner77/masterGantt/actions/runs/39431198772) | 3056.1 | 757 | `72849251df4dc6e57325ed91c6d2dd02aadeb015` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39411202743](https://github.com/planner77/masterGantt/actions/runs/39411202743) | 3052.1 | 758 | `f1ddf6bfeeddcbef98f75724a526aa521bdb55a3` | 3/3 + 6/6 success | INSUFFICIENT_DATA |
| [39396314489](https://github.com/planner77/masterGantt/actions/runs/39396314489) | 3049.1 | 755 | `a64f861547846a5eb9577c2aa9cc5bd85d2f860f` | 3/3 + 6/6 success | INSUFFICIENT_DATA |

The Epic #769 separately reports historical run-level E2E body/runner measurements (85.1→162.5 Runner-minutes for two specific runs) and PR medians; they are **not** measurements produced by this PR or these ten complete retro-replays.

### Shadow analysis acceptance boundaries

- Actual `false_negative` denominator = authenticated known failed regression source with corresponding intended full test, exact source and compatible test inventory. The current six issue families' source *representative paths* cannot serve as proof, thus actual FN / FP / precision / claimed cost savings = **INSUFFICIENT_DATA / NOT TESTED**.
- When enough new Shadow observations exist, compare same-attempt full E2E passed test IDs and selected/excluded IDs; compute upper bound on eliminated *test-body* work, not proposed true CI wall improvement. For real gain perform controlled before/after A/B with matched risk, runner, env and test inventory. Do not use metadata-only edited runs as Full samples.
- If any reporting job fails, required CI remains unchanged. No retroactive PASS, no release evidence reuse.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/QA_REVIEW_POLICY.md`: N/A(existing OWNER_MANAGED, Trusted QA/independent reviewer policy and Owner acceptance rules unchanged; new result explicitly lacks QA authority)
- `docs/GITHUB_OPERATIONS.md`: N/A(existing PR creation/approval, branch Ruleset, Run and GHCR procedures unchanged; Shadow read-only observation needs no new manual publication command)
- `docs/ISSUE_LIFECYCLE.md`: N/A(unchanged full Required3/QA/Owner/Finalizer gate, Issue phase and failure-ledger contract; references from AGENTS and TEST_PLAN)
- `docs/exec-plans/active/ISSUE_770.md`: UPDATED
- `DESIGN.md`: N/A(no customer-facing layout/style, Gantt behavior, resource or domain design change; issue scope is CI analysis only)
- `docs/API.md`: N/A(no application API endpoints or data contracts changed; GitHub Actions read-only API only)
- `docs/DB_SCHEMA.md`: N/A(no SQLite schema, data files or migration changes)
- `CHANGELOG.md`: N/A(no application feature, binary or SemVer change; protected CI instrumentation documented here and in CI_CD)
- `package.json`: N/A(no dependency/npm script/version changes)
- `package-lock.json`: N/A(no dependency or version changes)
- `docs/exec-plans/active/PLAN.md`: UPDATED

## AC_TEST_COVERAGE

- AC1: `tests/python/test_ci_impact_plan.py` docs-only, protected docs, local CSS, exact screen, one-test change, shared Gantt, SQLite, security, package/workflow, rename/delete, added, unknown cases. Real run remote still NOT TESTED.
- AC2: base-only #699 map + seeded #667/#730/#731/#732/#736/#767 representative adversarial cross-consumer scenarios, missing test and malicious LOW self-declaration; **actual historical run repro INSUFFICIENT_DATA**.
- AC3: `scripts/ci_impact_plan.py` exact source/run/attempt/merge parent, sanitized plan SHA, actual six-shard Job observations and reporter ZIP checks; cancelling/missing/source-spoof negative tests; trust boundary in CI bootstrap. First introducing PR Shadow expected NOT TESTED by design.
- AC4: ten run metadata/Job/available artifacts sampled above; exact diff, test-level replay, per-run timings, FN/FP and claimed savings **INSUFFICIENT_DATA** until authenticated artifact/full replay and A/B.
- AC5: `.github/workflows/ci.yml` diff, no changes to required `quality`/`e2e`/`docker` job names/dependencies or six shards; no Ruleset, main release or QA gate changes. Verify remotely on new Head.
- AC6: AGENTS, TEST_PLAN, CI_CD, REMOTE_VALIDATION and this Work Packet; DESIGN, API, DB_SCHEMA each explicitly N/A(reason).
- AC7: `tests/python/test_ci_impact_plan.py` added to existing full policy Job. New PR requires actual full same-Head Quality/E2E6/Docker, Trusted QA and Owner HIGH acceptance; until remote results `NOT TESTED`, no release authority.

## Test & handoff record

- Static tests authored: Python unit tests for deterministic classification, source spoofing, partial/missing shards and source-risk negative cases.
- Local Node/Python/Playwright: **NOT TESTED** here (repository execution on attached GitHub connection; no working local checkout). Tests run in remote Policy Job after creating new PR.
- Initial introducing PR `impact_shadow`: intentionally `TRUSTED_BASE_POLICY_NOT_INSTALLED` / NOT_TESTED; cannot self-certify its own source. Once merged after Owner acceptance, later runs execute the base-trusted classifier.
- Exact new PR Head/Run/Attempt and full CI test results: **NOT TESTED** until PR opened/run begins; CI monitor intentionally omitted by Owner direction.
- Release `0.129.0` unchanged; no version/tag/GHCR formal publish, merge or Issue closure authorized.
