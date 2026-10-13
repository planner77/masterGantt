# Issue #649 — #616 신규 SHA 릴리스 승계 준비

## 결정과 변경 금지 경계
- HIGH / OWNER_MANAGED / QA_REQUIRED=true, manager_decision=NOT TESTED.
- 원본 #616 PR #631 merge `b97709df8b5c0974f3c8252ac97819f45f73a5b9`, v0.107.0 및 #2621.1 Chromium 실패는 불변 FAIL이다. 원본 Owner 승인 marker는 삭제·수정하지 않는다.
- #647 PR #648 수정 merge `f8d0036ab4a5566df418a09f2eb9b5e1b918d08b`; #2630.1 / Finalizer #198.1 성공은 #647 증거만이다.
- 현재 main에 F2 및 #647이 있어도 v0.107.0 재지정, 기존 tag overwrite, 자동 발행·과거 실패 PASS 승계 금지.
- 신규 후보 버전 제안: **v0.108.0 (승인 전 가안)**. 앱 package version은 이 준비 PR에서 변경하지 않는다. 신규 버전의 공식 release_required 판정과 게시 허가는 인증 기반 원장 확인 후 Owner 별도 결정을 요구한다.

## READ-ONLY 감사 원장과 보수적 차단
- `scripts/release_succession_preflight.py`는 source/correction/candidate SHA, first-parent ancestry, F2/교정 포함 검증, 선행 v0.105.0/v0.106.0/v0.106.1/v0.107.0 Git tag/GitHub Release/authenticated GHCR tag/digest를 모두 **외부 인증 조회로 수집된 값**으로 요구한다.
- GitHub/GHCR 조회 실패, 빈 응답과 권한 부족은 ABSENT로 치환할 수 없으며 UNKNOWN으로 차단한다. GHCR digest 없는 PRESENT 및 중복·불일치 역시 차단한다.
- 감사 결정 `PREPARE_ONLY`는 PR 준비 적합성에만 해당하며 새 버전 release_authorized=false, publish=false, retire=false, close_issue_616=false를 강제한다. 이 함수 자체는 GitHub·GHCR에 접근하거나 쓰지 않는다. 거짓/미검증 입력을 인증된 증거처럼 공급하면 안 되며 실행 운영자는 수집한 URL·시각·API principal·digest·SHA를 별도 첨부한다.
- 실제 전체 원격 registry 확인 및 first-parent 실측, 선행 version 부채 정산, Owner revocation (기존 #616 v0.107.0 별도 명시 철회) 및 신규 v0.108.0 승인, #633 정책 교차 검증은 **NOT TESTED**. 이 준비 검증기는 별도 write-enabled Finalizer의 승계 권한이 아니다.

## 다음 단계 Gate
1. 기존 #616 Owner comment 원장과 #633 선행 부채, annotated Git tag/GitHub Release/GHCR package inventory를 인증 기반 READ-ONLY로 수집한다. published tag가 존재하면 즉시 BLOCKED하고 재사용하지 않는다.
2. 정확한 신규 immutable SHA, SemVer, Issue·PR 범위가 결정되면 별도 Owner 명시 revocation과 신규 버전별 publication authorization을 기록한다. 일반 채팅 요청/PR 본문을 marker로 위장하지 않는다.
3. 별도 corrective release-required PR의 exact Head CI Required 3 + Chromium shard 6/6, default-main Trusted QA, 리뷰 스레드 0, Owner HIGH 위험 승인을 확보한 후 **별도 병합 지시**를 받는다.
4. 신규 merge SHA의 push Main CI + exact GHCR candidate digest·SBOM/provenance를 확인하고 별도 version-scoped Finalizer로 게시한다. 선행 부채별 retired 기록과 #616 F2 채무 확인 후 종료한다.

## DOCUMENTATION_SYNC
- `AGENTS.md`: N/A(기존 개발 및 CI 원칙 준수, 정책 파일 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 Owner 관리 QA 정책 유지)
- `docs/CI_CD.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `DESIGN.md`: N/A(제품 UI 화면 수정 없음)
- `docs/API.md`: N/A(API 계약 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB 구조 및 마이그레이션 변경 없음)
- `docs/GENERIC_RELEASE_FINALIZER.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_616.md`: UPDATED
- `docs/exec-plans/active/ISSUE_649.md`: UPDATED
- `CHANGELOG.md`: UPDATED

## AC_TEST_COVERAGE
- AC1: 원본 SHA와 교정 SHA, 실패 증거 보존 및 검증기는 tests/python/test_release_succession_preflight.py에 대응. 실 Run 감사 NOT TESTED.
- AC2: authenticated inventory 및 GHCR digest 입력의 fail-closed 부정 테스트 작성. 실제 원격 감사 NOT TESTED.
- AC3: 신규 SemVer 유효성 및 기존 v0.107.0 재사용 차단 테스트 작성. Owner revocation/new authorization NOT TESTED.
- AC4: 원본 SHA 변조, 중복, UNKNOWN, foreign candidate SHA, 역전 first-parent, 잘못된 digest 차단 테스트 작성.
- AC5: Required CI 세 집계 및 Chromium E2E6, Trusted QA, 미해결 스레드 0은 신규 Head PR CI와 최종 리뷰 전 NOT TESTED.
- AC6: 병합/Main GHCR/Finalizer와 #616 완료는 신규 Owner 명시 게시 승인 전 BLOCKED로 유지. 본 PR에서 실행하지 않음.

## 2026-10-13 — CI #2634 QA Preflight 정정

- CI #2634.1 실패 근본 원인은 Product 테스트가 아니라 Primary Issue #649 인수 기준의 `A`~`F` 표기에서 검증기가 `AC1`~`AC6`를 찾지 못한 문서 형식 불일치다. `ISSUE_AC` FAIL 후 세 필수 aggregate는 FAIL, 실제 E2E/Docker는 SKIPPED였다.
- Issue #649 인수 기준을 `AC1 (A)`~`AC6 (F)`로 명시하여 원래 의미·Owner 승인 경계를 유지한다. 본 Work Packet의 AC 대응 및 테스트 증거는 해당 번호를 따른다. 신규 HEAD의 Required 3개/Trusted QA는 NOT TESTED; merge/release 미승인이다.
