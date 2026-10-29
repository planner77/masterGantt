# Issue #857 — v0.138.3 정식 GHCR Release Work Packet

- Primary Issue: https://github.com/planner77/masterGantt/issues/857
- Related implemented Issue: https://github.com/planner77/masterGantt/issues/854
- Main baseline: `3dd20ff3da5f3b3f8a6c337bdc61593c81c4daae`, CI [40957911031.1](https://github.com/planner77/masterGantt/actions/runs/40957911031) SUCCESS, artifact ID 12933143973 verified OCI retained.
- Base tree: `dedca627c221f0be87886dc67bc9cfbba3615c95`
- Branch: `release/issue-857-v0.138.3`
- Risk: `HIGH`, QA `OWNER_MANAGED`, `qa_required=true`, `release_required=true`, `release_authorized=true`.
- Owner's version-scoped release authorization: [comment 6509116199](https://github.com/planner77/masterGantt/issues/857#issuecomment-6509116199) — user's 2026-10-30 explicit request to publish formally, reusing validated OCI if eligible, rebuilding otherwise.
- Exact target version `0.138.3`; existing annotated `v0.138.2` peeled to `5ba0c275669a3521be120751ab260099df2c40aa`. Tag immutability is mandatory.
- PR/Main/Release requirements cannot be bypassed. New source package version makes old `0.138.2` OCI ineligible for formal `0.138.3`; PR→Main OCI conditional reuse (#836) is still preferred when exact source policy allows, otherwise rebuild.

## Scope / Non-scope

**Scope:** update `package.json`, `package-lock.json`, `CHANGELOG.md` and this packet; obtain PR Full CI/Trusted/Owner, zero unresolved reviews, latest Main merge, new exact Main Full CI, registry candidate/digest/policy/smoke and Release `v0.138.3` promotion, verified GHCR digest and lifecycle close.

**Non-scope:** app logic, SQLite schema/migrations, HTTP authorization, Gantt UI, issue #854 failure/FINAL audit, existing tags/images, workflow policies, QA gates, Docker deployment.

## TEST_LIFECYCLE_REVIEW

- KEEP_UNIQUE: `scripts/verify-release-version.mjs` and its existing version/lock/SemVer-policy regression; version validation must compare package manifest, lockfile root and immutable annotated tags.
- KEEP_UNIQUE: original #854 `tests/server/projects/project-issues.test.ts` and `tests/e2e/project-issues.spec.ts`; this release metadata change does not alter product runtime logic.
- KEEP_UNIQUE: Full PR required Quality + Chromium8/8 + Docker, Trusted QA/Owner, Main Full and Release static/E2E/OCI runtime/supply-chain checks. No new tests, exclusions, relaxed assertions, retries or timeout changes.
- Observed PR Run `40961264343.1` preflight failed *before* actual static/Chromium/Docker implementations ran. Skipped tests are **NOT EXECUTED**, not PASS. This correction changes acceptance-criteria metadata and Work Packet/ledger, not the QA validator.

## AC_TEST_COVERAGE

- AC1: Existing `scripts/verify-release-version.mjs` contract + Required Policy job cross-check the package manifest and lockfile root against `0.138.3`; CHANGELOG and the unchanged `v0.138.2` reference are independently audited.
- AC2: PR Required Quality, Chromium E2E 8/8 and Docker, Trusted QA, OWNER_MANAGED final review, latest HEAD/Base/test-merge source validation, zero unresolved inline threads and GitHub mergeability; all newly rechecked for latest Head.
- AC3: Exact Main push Full Required Quality/E2E8/Docker + OCI archive provenance, PR conditional reuse or fallback build, digest and live smoke evidence on its own new Merge SHA; the old #854 OCI does not substitute.
- AC4: Existing Release SemVer/annotated tag verifier checks immutable `v0.138.2` reference and newly created `v0.138.3` annotated tag peeled to the successful exact Main SHA.
- AC5: `release-image.yml` static/E2E quality, candidate OCI source and image-policy/runtime/API/SQLite smoke, live GHCR immutable SemVer digest/pull and promotion verification.
- AC6: Generic Release Finalizer provenance, Owner version-scoped authorization, #857 closure only after formal publication; historical #854 FINAL, tag and failure ledger remain unchanged.

## DOCUMENTATION_SYNC

- `package.json`: UPDATED
- `package-lock.json`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/exec-plans/active/ISSUE_857.md`: UPDATED
- `docs/ISSUE_857_FAILURE_ANALYSIS.md`: UPDATED
- `AGENTS.md`: N/A(existing agent and product release authority policy is unchanged)
- `docs/QA_REVIEW_POLICY.md`: N/A(existing OWNER_MANAGED review and QA gates are unchanged)
- `docs/CI_CD.md`: N/A(existing immutable SemVer and full CI release process is unchanged)
- `docs/TEST_PLAN.md`: N/A(existing release version and product test suites are unchanged)
- `docs/GITHUB_OPERATIONS.md`: N/A(existing CI dispatch and verified digest operations are unchanged)
- `docs/REMOTE_VALIDATION.md`: N/A(existing exact SHA run and remote evidence protocol is unchanged)
- `DESIGN.md`: N/A(no product UI design or application behavior change)
- `docs/API.md`: N/A(no API route or permission contract change)
- `docs/SECURITY.md`: N/A(no authentication authorization or runtime security change)
- `docs/DB_SCHEMA.md`: N/A(no database schema or migration change)
- `docs/ARCHITECTURE.md`: N/A(no runtime architecture or deployment topology change)

## F857-PR-001 — First Full PR CI direct failure and bounded remediation (2026-10-30 KST)

- Original [Run #3436.1 / 40961264343.1](https://github.com/planner77/masterGantt/actions/runs/40961264343) for PR [#858](https://github.com/planner77/masterGantt/pull/858), immutable original Head `b0315fcc4ffd6116c90cd45c0301c33fac4e7b3b`, event Base `3dd20ff3da5f3b3f8a6c337bdc61593c81c4daae`, status FAILURE.
- **Direct**: QA Preflight job `123754488561`, step `원본 base SHA의 QA Preflight 실행 (read-only)` failed `ISSUE_AC` because primary Issue #857 body listed six checkbox criteria without the required `AC1`... markers. The other checks PRIMARY_ISSUE, RISK_LEVEL, QA_METHOD, QA_REQUIRED, RELEASE_REQUIRED/AUTHORIZED and PATH_POLICY all passed. `DOCUMENTATION_SYNC` was not evaluated because no AC marker was found.
- **Derived**: Fast Gate `123754636298` failed on preflight, Required Quality `123754797467`, Chromium `123754797704`, Docker `123754797681`, Automated QA `123754843560` also failed as downstream. Typecheck, ESLint, Vitest, Next build, Chromium8 implementations, Docker smoke and GHCR publication were **SKIPPED/NOT EXECUTED**; no actual app regression was proven.
- **Correction**: Edit Issue #857 acceptance criteria to explicitly label AC1–AC6 without changing requirements. Structure this Work Packet using exact `## AC_TEST_COVERAGE` and `## DOCUMENTATION_SYNC` titles and canonical `N/A(reason)` entries required by trusted `qa_final_automated.py::docs_gate`, proactively removing the otherwise latent secondary documentation failure. Add the cumulative failure ledger, leave validator/CI/workflow/product/version unchanged.
- **Review/conflict** at source of remediation: inline review threads `0`, reviews `0`; GitHub PR mergeable `true`; Main `3dd20ff...` is ancestor of source Head, compare `ahead=1, behind=0`. No unresolved review thread nor textual conflict at this snapshot; repeat latest-main assessment before any eventual merge. Owner release approval for version `0.138.3` is on #857 but is not CI PASS.
- **Next**: create new HEAD by committing this packet and failure ledger; new Full PR CI begins on `synchronize`. Do not monitor or claim outcome as PASS.

