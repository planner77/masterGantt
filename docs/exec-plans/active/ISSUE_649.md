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
- UPDATED: 이 문서, scripts/release_succession_preflight.py, tests/python/test_release_succession_preflight.py.
- N/A: DESIGN.md/UI_UX_GUIDELINES.md/API.md/DB_SCHEMA.md (UI/API/DB 무변경).
- 기존 AGENTS.md/QA_REVIEW_POLICY.md/ISSUE_LIFECYCLE.md/GITHUB_OPERATIONS.md/GENERIC_RELEASE_FINALIZER.md/CI_CD.md/REMOTE_VALIDATION.md/TEST_PLAN.md는 **보안 및 검증 조건 변경 없이 상속**. 본 문서는 #649의 추가 read-only 제약과 NOT TESTED 범위만 규정.
- 테스트: Python unittest 정상 후보(준비만), SHA 변조·v0.107.0 중복·UNKNOWN·digest 불일치·Owner flag·first-parent 중복·누락 inventory 부정. 실제 PR CI와 원격 자격 증명 감사는 별도 증거 전 NOT TESTED.
