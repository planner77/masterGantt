## Issue #651 — #633 v0.106.1 정식 발행 완료에 따른 이전 실행 절차 폐기 (2026-10-13)

- **완료된 과거 릴리스:** #633 PR #635 merge `09bee924032b4126ff794ec7a485542fd72dd7bf`, Main CI [#2579.1](https://github.com/planner77/masterGantt/actions/runs/38215065244) SUCCESS, 정식 Release CI [#165.2](https://github.com/planner77/masterGantt/actions/runs/38221400193) SUCCESS, 기존 digest `sha256:0ab78272f2637ca73ae0a1e7bec4f41b24fcc35e35f13cfc94b7e13a9cad560f`. #550/#615 각각 Owner 철회 및 bot `release-debt-retired:v1` 완료 원장 존재.
- **아래 #633 B2 승인 marker 신규 작성·v0.106.1 Finalizer 재진입·재발행 단계는 2026-10-12 당시의 과거 절차이며 현재 실행 금지.** 과거 로그/명령은 감사 자료로 보존하고 이미 존재하는 annotated tag·GHCR digest를 삭제·재지정하지 않는다. GitHub Release by-tag 404는 Git tag/GHCR 부재 증명이 아니다.
- 이후 운영상 실행 대상은 #616의 신규 승계 후보 **v0.108.0 준비 감사**뿐이며, 이 역시 #616 v0.107.0 기존 Owner 승인 명시 철회와 신규 Owner 결정, authenticated Git/GHCR 원장 없이는 BLOCKED. #651은 read-only 정책 수정이며 신규 게시/퇴역/Issue #616 종료 승인 아님.

## Issue #633 — GHCR Private 404 read-only 증거 보강 및 기존 승인 SHA 보존 (2026-10-12)

- [PR #635](https://github.com/planner77/masterGantt/pull/635) 신규 SemVer `0.106.1`은 SHA `09bee924032b4126ff794ec7a485542fd72dd7bf`로 병합, [Main CI #2579.1](https://github.com/planner77/masterGantt/actions/runs/38215065244) Quality/E2E/Docker/`ci-<SHA>` digest(sha256:0ab78272f2637ca73ae0a1e7bec4f41b24fcc35e35f13cfc94b7e13a9cad560f) 모두 PASS.
- [감사 #1.1](https://github.com/planner77/masterGantt/actions/runs/38216994751)의 private registry 조회에서 `v0.105.0`/`v0.106.0`/신규 `v0.106.1` Git tag / GitHub Release는 ABSENT이나, `ghcr.io/planner77/mastergantt:X.Y.Z`는 `UNKNOWN`. [Finalizer #153.1](https://github.com/planner77/masterGantt/actions/runs/38216994785) 역시 구버전 GHCR ABSENT의 정확한 인증 근거 누락으로 BLOCKED; **릴리스/Issue/branch 변경 mutation 0**.
- 보완: `scripts/release_debt_audit.py`의 Docker `imagetools inspect` 모호한 404/`not found`은 별도 `gh api /users/planner77/packages/container/mastergantt/versions?per_page=100&page=N`의 Owner Private GHCR `packages:read` 인증·완전 pagination·metadata.container.tags 검증을 수행한다. REST 200인 모든 페이지를 확인하고 exact tag가 없을 때만 ABSENT. 401/403/404/429/오염·파손 응답·pagination 누락은 UNKNOWN; 다른 tag 사용 금지. 기존 manifest unknown 외의 단순 404를 ABSENT로 변경하지 않는다.
- 원래 릴리스 Owner 승인: `#550 v0.105.0`, `#615 v0.106.0`은 각 Issue에 별도 철회 기록으로 보존. 승인된 정식 `#633 v0.106.1` Release 원본 SHA는 `09bee924032b4126ff794ec7a485542fd72dd7bf`로 고정하고, 본 `same-Issue` policy-only `0.106.1 → 0.106.1` 후속 Merge의 자체 Main CI/digest를 검증한 뒤에도 **기존 immutable release tag 대상 SHA를 이동하지 않는다**. 최신 main과 original release SHA는 first-parent ancestor로 확인하며, 다른 Issue/버전/다중 교정으로 승인 자동 확장 금지.
- PR 승인 전: 원래 실패한 구버전 Main SHA/CI FAIL 보존, 본 정책 변경 PR Required Quality/E2E/Docker·Trusted QA·리뷰0 및 Owner HIGH 위험 수용 확인. 정식 tag/Release/ghcr promotion은 후속 main CI·private authenticated inventory 모두 PASS 전 NO-GO.
- Merge 후 실행: Issue #633 Main CI push→`release-debt-audit.yml` 자동 read-only inventory 및 Generic Finalizer→new original release SHA에 정확한 v0.106.1 annotated tag/Release CI→digest 동일 확인→Resume→historical cleanup/RETIRE evidence/Issue close. 인증된 UNKNOWN/PRESENT가 있거나 target 충돌 시 모든 발행·퇴역 중단.

# Issue #633 — B2 미발행 2버전 공식 정리 및 v0.106.1 교정 Release (2026-10-12)

**현 상태: 구현 PR 검증 중, 정식 발행 NOT TESTED.** #550의 v0.105.0 및 #615의 v0.106.0은 과거 Main CI 실패·중간 병합으로 자동 발행·자동 상속 불가. 두 버전은 삭제하거나 다른 SHA로 위장하지 않고 **미발행 폐기/승계 원장**으로 보존한다. 최신 수정은 신규 **v0.106.1 후보 버전**으로 검증하되, 실제 Owner v2 승인·정확한 새 main Merge SHA·GHCR 실감사 이전에는 릴리스와 Issue close를 자동 실행하지 않는다.

## B2 결정의 선행 근거

- PR #559 / Issue #550: `40747252c389f2a4d1203a2262a4caa49c90728d`, version 0.104.4→0.105.0, Main #2515.1 **FAIL**.
- PR #627 / Issue #615: `c8949da48e7465db45d871887c3f55f9fb6dc743`, version 0.105.0→0.106.0, Main #2526.1 **FAIL**.
- PR #628 / Issue #615: `6eaec3331fcbc720ab42106789a505c5ee5eefb4`, Main #2531.1 **PASS**와 candidate digest `de76273aa07dfd2132b6a23e24501fba477692b4f3f97cc58146382ae65ac88b` (v0.106.0 정식 발행은 아님).
- PR #626 / Issue #550: `e51b99cb25f37c8909de356a089a56b4139415a3`, Main #2543.1 **FAIL**. PR #632 `d69749753fb9db002232d92d51446237a0fe042d` Main #2553.1 **PASS**, candidate digest `7700bffcf8f2bb4006d485bae440ef39da23a95d5cd8375342d437282883fa9b`.
- PR #634 / Issue #633 `f839ad01cd395004e623ae171f1684cfc49e482e`, Main #2565.1 **PASS** / candidate `c36138dd914b2c1632119fe969bd0c427dc5b9ed9ad99fb183c05f40221f38b9`. Finalizer #148.1 SUCCESS job이지만 first-parent 최초 #550 CI FAIL에서 **DEFERRED/mutation NONE**.
- 현재 GitHub API에서 v0.105.0/v0.106.0 annotated tag 및 GitHub Release **부재**, GHCR exact 이미지 부재는 **인증된 read-only Main Workflow 실조회 필요**. GHCR `:X.Y.Z` vs Git/GitHub `vX.Y.Z` 차이를 보존한다.

## 엄격한 B2 처리 계약

1. `release-debt-audit.yml`은 Issue #633의 성공한 Main CI 완료 이벤트에서 trusted **default main checkout**, `actions/packages: read` 및 pinned GHCR 로그인 후 `--inventory-only`로 자동 기동한다. `INVENTORY_ONLY_NOT_RELEASE_AUTHORIZED`는 **GHCR 부재 증거만 수집**, 미발행 폐기/Release/Issue close 승인 아님. 레지스트리 오류/미확정/기존 exact tag가 있으면 BLOCKED.
2. 최초 원본 `v0.105.0`(Issue #550)과 `v0.106.0`(Issue #615)의 Owner 정식 게시 승인 marker를 각 버전에서 **명시적으로 철회(authorized=false)**한다. 기존 승인 댓글을 수정·삭제하지 않는다.
3. 신규 versioned PR은 current main `0.106.0`을 `0.106.1`로 올리고 exact Head PR CI Quality/E2E/Docker + Trusted QA + 코드 리뷰/Owner HIGH 위험수용을 검증한다. 이를 **새 Merge SHA**로 병합해 Main CI와 `ci-<SHA>` digest/SBOM/provenance를 검증한다.
4. 위와 독립적으로 Issue #633에는 `mastergantt-release-authorization:v1` (`expected_version=0.106.1`) 및 **별도** `mastergantt-release-debt-authorization:v2` (B2_RETIRE_BOTH, #550/#615 다섯 PR SHA, 새 corrective PR number/merge SHA, Owner note ≥20자)를 최신 인증 Owner 댓글로 남긴다. 구버전 승인·일반 “GHCR 게시”를 이 marker 대신 사용하지 않는다.
5. Generic Release Finalizer는 새 코드가 이미 **trusted main**인 시점에서 Owner marker를 재조회한다. exact first-parent·원본 Issue/PR·버전·구버전 Main FAIL 및 교정 Main PASS·기존 2버전 Git tag/Release/GHCR **모두 ABSENT**·새 version main SUCCESS·Owner 철회/승인을 검사한다. 조건 하나라도 틀리면 이전 순서 BLOCKED를 유지한다. 자동 Cross-Issue 일반 supersession 계약은 그대로 유지한다.
6. 통과한 경우 **별도 인증된 B2 대상 원본만** oldest-first 처리를 보류하고, 일반 pending PR(#629/#633 등)은 기존 exact Main/cleanup gate로 수행한다. `v0.106.1`은 기존 Generic Release `release_start` → immutable annotated Git tag → `Publish release image` exact digest promotion → `Release Finalizer Resume` 경로를 사용한다.
7. **새 정식 Release SUCCESS 이후에만** 구버전 미발행 상태를 재검증하고 신규 exact digest와 보존된 main `ci-<SHA>` digest 일치 검증 → #550/#615 역사적 5개 merged branch의 safe lease preflight/cleanup, #628/#632 두 임시 후보의 check-only·정리 → 각 Issue에 별도 github-actions[bot] 작성 `mastergantt-release-debt-retired:v1` (구버전 미발행·원본 FAIL·new target SHA/digest/Owner decision) → #550/#615 close 순서. 이후 #633 새 release FINAL 및 close를 기존 Generic helper로 처리한다. 원본 실패 SHA를 PASS/F‌INAL로 위장하지 않는다.
8. Owner marker가 나중에 기록돼도 Issue #633의 Owner issue_comment 이벤트는 **기존 `release-finalizer.yml`** 에서만 trusted current main 코드를 실행한다. 임의 원격 PR/comment 본문을 실행하지 않으며 same lifecycle concurrency, 기존 secret/permissions 범위 유지. 임시 일회성 Issue workflow 추가 금지.

## Negative/positive 검증과 Rollback

- `scripts/test-release-debt-recovery.py`: Owner 위조/구 marker 재사용/최신 철회/stale SHA/원장 version mismatch/추가 PR/main failure/UNKNOWN GHCR/미완료 Release/상이한 digest/cleanup-then-close 불변을 포함한다. `scripts/verify-issue-lifecycle.py`에서 trusted workflow 권한·기본 branch checkout·oldest-first/Owner 승인 조건을 정적으로 검증한다.
- 기존 Issue #615 (adjacent same-Issue 승계), #586/#344 immutable FINAL, #595/#593 QA 검증은 변경하지 않고 PR CI에서 전체 회귀한다.
- Owner 승인 전 rollback: B2 모듈·workflow hook·version bump·문서를 revert하고 기존 Generic 자동 차단 유지. **tag 발행 후 rollback은 기존 immutability 정책에 따라 tag 이동/삭제를 하지 않고 새로운 SemVer 교정 PR로 처리**. 중간 cleanup 실패는 별도 immutable RETIRED 표시 전에서 중단해 재실행 가능, 실패 사유와 실행 원본을 보존한다.
- 프로덕션 실제 DB 백업·복구, 운영 TLS, 운영 배포는 원격 CI와 독립이며 미검증. 정식 GHCR 발행 ≠ 실제 운영 배포 승인.

## 상태·판정 기준

- 지금: B2 코드 구현 및 신규 SemVer 후보 준비. **신규 PR CI / Main CI / GHCR Registry live Audit / Formal Release / Issue close: NOT TESTED**.
- 정식 Release GO 판정: 정확한 new Merge SHA의 Main CI/GHCR 후보 digest 검증 PASS, 이전 SemVer GHCR 부재 PASS, Owner 구버전 철회·B2 exact Scope·신규 version release 승인 PASS, generic trusted validator PASS.
- 마지막 FINISH 판정: `Publish release image` SUCCESS 및 exact tag/digest 동일·Resume/역사적 cleanup/각 RETIRED marker/Issue close까지 모두 실제 GitHub evidence 확인.

## PR #634 후속: Private GHCR 검사 및 태그 명세 정합화 (2026-10-12)

- 2026-10-12 PR CI #2559.1의 Quality/E2E 6-shard/Docker Required aggregate는 모두 SUCCESS, 마지막 QA Automated는 미해결 P1 리뷰 2건 때문에 BLOCKED(전체 CI FAILURE).
- GHCR `packages:read`는 읽기 API 권한일 뿐 Docker CLI 로그인은 아니다. read-only audit workflow에서 pinned `docker/login-action`, `github.actor` 및 기존 `GITHUB_TOKEN`으로 **검사 이전에 인증**한다. token을 로그/코드에 직렬화하지 않으며 registry/tag/Issue는 수정하지 않는다.
- annotated Git tag와 GitHub Release tag는 `vX.Y.Z`; 정식 GHCR exact image tag는 `ghcr.io/planner77/mastergantt:X.Y.Z`이다. 조회 대상이 없을 때 `vX.Y.Z`를 조회하는 오류는 기존 발행물을 숨길 수 있으므로 금지한다.
- 비인증·권한 부족·모호한 404는 `UNKNOWN`으로 fail-closed한다. 인증된 레지스트리의 명시적인 `manifest unknown`만 `ABSENT`로 분류하고, 발견한 exact digest는 원장에 그대로 기록한다. 추가 fixture는 두 P1 회귀와 기존 #615·#586/#344 contract를 검증한다. Trusted main 실증·Owner 승인 및 GHCR 실제 내용 판정은 아직 NOT TESTED.

# Issue #633 — 교차 Issue 미발행 Release 부채: 읽기 전용 복구 판정

2026-10-12 / HIGH / `qa_method=OWNER_MANAGED` / `release_required=false` (본 감사 PR) / `release_authorized=false`.

## 확인된 원장

| 순서 | Issue / PR | Merge SHA | Main CI | 물리적 버전 |
| --- | --- | --- | --- | --- |
| 1 | #550 / #559 | `40747252c389f2a4d1203a2262a4caa49c90728d` | #2515.1 FAIL | 0.104.4 → 0.105.0 |
| 2 | #615 / #627 | `c8949da48e7465db45d871887c3f55f9fb6dc743` | #2526.1 FAIL | 0.105.0 → 0.106.0 |
| 3 | #615 / #628 | `6eaec3331fcbc720ab42106789a505c5ee5eefb4` | #2531.1 PASS (artifact gate PASS) | 0.106.0 유지 |
| 4 | #550 / #626 | `e51b99cb25f37c8909de356a089a56b4139415a3` | #2543.1 FAIL | 0.106.0 유지 |
| 5 | #550 / #632 | `d69749753fb9db002232d92d51446237a0fe042d` | 확인 대기 | 0.106.0 유지 |

GitHub Git refs API에서 `v0.105.0`, `v0.106.0` 모두 404, Releases by tag API에서도 모두 404 (2026-10-12 조회). **GHCR exact tag/digest의 존재/부재는 별도 authenticated registry 조회 전 NOT TESTED**. 404인 Git tag만으로 GHCR 부재를 단정하지 않는다. #550 원본 Owner 승인 v0.105.0은 v0.106.1 등으로 이월 불가; #615 Owner 승인 v0.106.0은 #615에만 적용.

## 전략

- **A — 원본 exact SHA 재검증:** 결함이 알려진 원본 #550 빌드를 우연한 retry PASS만으로 게시하면 안 된다. 원본 회귀가 안전하게 재현·수정됐다는 증거 없이 A는 BLOCKED. 기존 실패 Run을 PASS로 바꾸지 않는다.
- **B — 명시적 미발행 폐기 + 새 SemVer:** #550 v0.105.0 미발행 부채를 감사에 남기고, 별도 Owner가 **정확한 원본 SHA/버전, #615 성공 SHA/버전, #550 새 교정 SHA/버전**을 범위로 승인해야 한다. 예시 `v0.106.1`은 확정된 릴리스가 아니다. 기존 v0.106.0 승인도 재사용·변조하지 않는다. #615의 release와 #550 교정 release는 oldest-first로 각각 별도 검증해야 한다.

## 구현된 읽기 전용 신뢰 Gate

`scripts/release_debt_audit.py`는 main trusted checkout SHA와 실제 main ref가 같을 때만 first-parent graph를 검증한다. exact Issue/PR/SHA/version, 실패/성공 Main CI 및 Main candidate gate, Git tag/GitHub Release/GHCR exact digest 상태를 확인한다. 기존 `supersede_failed_issue_retries`의 **교차 Issue 자동 승계 차단**과 #615의 adjacent same-Issue 승계를 재현한다. 불확실한 GHCR 상태는 `UNKNOWN`으로 차단한다. Owner-only 최신 exact `mastergantt-release-debt-authorization:v1` marker의 폐기/재발행 결정과 두 버전의 독립 release 승인도 검사한다. Marker가 있더라도 `READY_FOR_SEPARATE_TRUSTED_RECOVERY`는 **정식 게시 허가나 실행이 아니다**.

`.github/workflows/release-debt-audit.yml`은 수동 workflow_dispatch 전용이며 `contents/actions/issues/pull-requests/packages: read`만 사용한다. PR의 코드를 checkout하지 않고 기본 브랜치의 검증기만 사용한다. Tag/Release/registry/Issue/branch mutation, Actions dispatch, 신규 token/PAT, required checks/ruleset 변경은 없다. `scripts/test-release-debt-audit.py`는 외부 네트워크 없는 negative/positive fixture다.

**신뢰 경계:** 이 PR이 검증기를 변경하므로 해당 PR의 자체 성공을 trusted 복구 권한으로 사용하지 않는다. main 병합 전에는 독립 검토와 Owner의 HIGH 잔여 위험 수용이 필요하다. 현재 구현은 안전한 B의 **read-only readiness**까지만 수행하며, 실제 미발행 폐기 원장 처리/oldest-first release 복구 실행기는 별도 설계 승인과 후속 PR이 필요하다.

## 실행 및 회복

1. 본 PR의 정적 테스트/세 Required CI/Trusted QA/Owner 승인 후에만 병합 검토.
2. main의 `release-debt-audit.yml`을 원본/후속 SHA와 **현재 main SHA**로 수동 실행. Owner marker/새 corrective SHA가 없으면 BLOCKED가 정상이다.
3. 승인된 별도 복구 실행기에서 source debt의 폐기 원장을 먼저 확정하고 #615 v0.106.0의 성공한 exact `ci-<SHA>` digest/SBOM/provenance를 검증한 뒤 immutable tag/Release CI/Promotion을 처리한다. 이어 새로운 #550 교정 SemVer도 독립적으로 검증한다. Release 성공 뒤 Resume, cleanup, FINAL/Issue close 순서를 보존한다.
4. 경쟁 Main/Finalizer가 있으면 현재 main/ref/tag/digest를 다시 읽고 불일치 시 중단한다. tag collision은 덮어쓰지 않는다. 기존 #550 실패 SHA·Run과 미발행 기록을 삭제하지 않는다.

**Rollback:** 감사 workflow를 비활성화/삭제하고 감사 스크립트·fixture·문서만 되돌린다. 읽기 전용이므로 기존 tag, GHCR, FINAL marker, Issue 상태는 변하지 않는다. 기존 generic finalizer의 fail-closed 차단은 그대로 남는다.

## Acceptance mapping

- AC1: 실제 SHA/CI/Tag 조회 및 `test-release-debt-audit.py` 원본 BLOCKED fixture. GHCR 실조회와 main head CI는 NOT TESTED.
- AC2–3: exact version/Owner marker 및 cross-Issue 자동 승계 차단 fixture.
- AC4: 순서/조건 문서화. **실제 GHCR·Release 실행 NOT TESTED**, 의도적으로 자동 실행 금지.
- AC5: 본 문서, 운영 문서/테스트 동기화. 전체 회귀는 PR CI에서 확인.
- AC6: 기본 브랜치의 읽기 전용 workflow로 판정; 실제 Actions 실증은 main 반영 후 별도 확인.
