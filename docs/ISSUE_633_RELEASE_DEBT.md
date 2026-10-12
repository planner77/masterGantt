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
