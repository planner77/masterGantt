# Issue #874 — 단일 실패 원장 (Release Runner 환경 드리프트)

## F874-001 — confirmed GHCR Release #216.1 / 2026-11-04

| Field | Immutable evidence |
| --- | --- |
| Linked issue/PR | Issue #865, PR #871; follow-up #874 |
| Main SHA | 78a48b29f3a6e5ec1a0a9817ffa1976dc4de74aa |
| SemVer tag | annotated v0.141.0; preserve |
| PR actual Docker Job | 126371984402; hosted runner ImageVersion 20261101.186.1 |
| Main Full | #3489.1 / Run 41776085393 SUCCESS; Docker Job 126396726096 ImageVersion 20261101.186.1 |
| Main OCI index | sha256:a6a2b658f440280eca66a218b83ec5eb8b86c80d657d8082a7cabb794dcce842 |
| Finalizer | #1346.1 / Run 41779125648 SUCCESS = dispatch initiation, not completed release |
| Release | #216.1 / Run 41779185247; candidate Job 126417402392; hosted runner ImageVersion 20261025.179.1 |
| Direct failure | step Main verified candidate exact digest 확인: PR_ORIGIN_RELEASE_SOURCE_UNAVAILABLE:PR_MAIN_BUILDER_OR_INPUT_DRIFT |
| Successfully executed | GHCR login + exact digest pull, Release static, Release Chromium8 |
| NOT RUN | Release candidate runtime smoke, promotion, GHCR SemVer and Finalizer completion |

### Causal classification

POLICY_CI / RUNNER_ENVIRONMENT_CROSS_RUN. Existing scripts/verify_ci_image_release.py calls verify_source() which invokes ci_image_contract.verify() and fingerprint(root). The latter compares **current Release runner ImageVersion** to historical PR receipt as if Release runner rebuilt the image. PR and Main source/builders were matching; the newly provisioned Release host is not authoritative build provenance. No independent evidence of a different OCI digest or tampered receipt was supplied. Do not reclassify PR/Main as green from Release failure or claim that cause alone establishes registry integrity.

### Corrective action and control

- Source+build phase: PR origin and Main builder attestation/job/archive/OCI+Git tree match still required. Continue to block PR/Main mismatch or tampering; Main-only safe rebuild fallback remains.
- Promotion phase: separately authenticate original successful Main Run/Attempt and Main builder witness artifact, compare PR receipt and Main receipt (including exact OCI archive hash/index/source/Run/Attempt) and re-hash source files/tree. Release host ImageVersion is verifier environment only.
- Added regression positive 20261101.186.1 vs 20261025.179.1; negatives for builder/source/digest/run/receipt/publisher mismatch. Existing unique-security tests preserved.
- Existing Release #216.1 and v0.141.0 are **immutable failures**: no retroactive rewriting, tag moves or blind rerun. New verifier does not run on old tag source.
- risk_level HIGH; qa_method OWNER_MANAGED; qa_required true; release_required false; release_authorized false. Owner HIGH risk acceptance and merge permission NOT GIVEN.
- This task ends at new PR Full CI trigger; remote result NOT TESTED; no CI monitoring/merge/Release/Issue closure.

## F874-002 — Implementation review / non-execution classification

- Prior occurrence #849 / Release #207 had a different job-name duplicate recognition bug: same display-name Docker implementation SUCCESS + PR-only SKIPPED. This existing correction is retained; #874 is *not* a reason to accept duplicate success/failure or skipped Main work.
- Branch changes emit an exact Main receipt artifact. Older Main runs lack it and must BLOCK (not silently self-approve). A retry of the old v0.141.0 tag still uses the previous source and cannot gain the new behavior.
- Python unit/integration and remote PR Full results remain NOT TESTED until observed. A new PR can trigger Full CI without claiming PASS. Individual validation results should be appended only after direct evidence from their Run/Attempt.

## REFERENCES

- https://github.com/planner77/masterGantt/issues/874
- https://github.com/planner77/masterGantt/actions/runs/41779185247
- https://github.com/planner77/masterGantt/actions/runs/41776085393
- https://github.com/planner77/masterGantt/actions/runs/41779125648
- docs/exec-plans/active/ISSUE_874.md and original docs/ISSUE_836_FAILURE_ANALYSIS.md.
