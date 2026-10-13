# Issue #661 — Gantt 정합성 표준·독립 구현 이슈 등록 Work Packet

Refs #661

## 요청 / 범위 / 현재 상태

2026-10-13 사용자 요청: 구조적 보완 계획을 수립하고, 지속 지침과 AGENTS.md 필수 참조를 등록하며, 독립 구현 단위별 이슈를 만든다. 중단된 요청을 재개하여 기존 산출물을 재사용한다. 문서·계획·이슈 등록의 완료와 제품 구현·표준의 main 적용은 구분한다.

phase: DOCUMENTATION_SYNC / DOCUMENT_PR_REVIEW
status: REVIEW_PENDING
risk_level: HIGH
risk_reason: 향후 Gantt 변경 에이전트의 필수 규범을 추가함. 보안·권한·CI 검증기 변경은 아님.
qa_method: OWNER_MANAGED
qa_required: true
manager_decision: NOT TESTED
release_required: false
release_authorized: false
issue_comment_writer: Manager
issue_comment_allowed_types: PLAN, STATUS, HANDOFF

제품 구현, PR #561의 코드 변경·새 CI 시작, PR 병합, Main CI, GHCR/태그/릴리스 및 기존 이슈 종료는 이번 범위 밖이다. 문서 PR 생성 시 GitHub가 자동으로 실행하는 검증은 문서 변경의 검증이며 #552 제품 재검증으로 해석하지 않는다.

## 기준선 / 재개 시 확인

- 문서 base main: `89f4ab7936fe74062f0398601d4a6596e3e51924`.
- 기존 문서 branch: `docs/issue-661-gantt-state-standard`; 재개 시 Head `88db22e179c9e0e4900b1e33fc9b117a2d3eb974`.
- 제품 #552 / PR #561 분석 Head: `d9334c30c6c262d9089ac8ad99008587435092ed`. 본 작업에서 이동하지 않는다.
- 재개 시 #661 및 구현 #663~#667은 이미 OPEN으로 등록되어 있었다. 중복 이슈를 생성하지 않는다.
- 문서 branch에 GSC 규범·SC 검증표·AGENTS 필수 참조·ADR/Trace 연결·이슈 번호가 반영되어 있었으나 이 Work Packet의 링크 대상과 문서 PR이 없었다. 이 파일과 PR 등록으로 남은 인계를 완료한다.
- application `0.107.0`, `@svar-ui/react-gantt` `2.7.3`; package/lockfile 변경 없음. 실제 구현 에이전트는 당시의 최신 refs/설치 버전을 다시 읽는다.

## 필독 / 장기 원본

- [AGENTS](../../../AGENTS.md): 작업 시작·REWORK 시 필독, 버전/commit·적용 규칙·검증·예외 기록 의무.
- [GSC 표준](../../GANTT_STATE_CONSISTENCY.md): `1.0.0-candidate`, GSC-01~12. 승인/구현/테스트/배포를 분리한다.
- [SC 누적 검증표](../../GANTT_STATE_CONFORMANCE.md): SC-01~14. 기존 전체 E2E를 대체하는 축소 목록이 아니다.
- [구조적 보완 계획](GANTT_STATE_REMEDIATION.md): 독립 단위, 파일 소유권, PR base·통합·롤백 전략.
- [Architecture](../../ARCHITECTURE.md), [Adapter ADR](../../GANTT_ADAPTER_ADR.md), [Sync Trace](../../GANTT_SYNC_TRACE.md), [Test Plan](../../TEST_PLAN.md), [Lifecycle](../../ISSUE_LIFECYCLE.md), [QA 정책](../../QA_REVIEW_POLICY.md).

## AC_TEST_COVERAGE

| AC | 산출물 / 확인 방법 | 이번 판정 범위 |
| --- | --- | --- |
| AC1 | GSC-01~12 및 candidate/승인/구현 상태를 표준에서 확인 | 문서 작성·원격 존재 확인, 규범 승인/제품 준수는 별도 |
| AC2 | same-revision Core drift, 412/422/500/네트워크, empty axis, Calendar/사용자 의도 경쟁을 SC-01~14에서 확인 | 요구·검증 설계만 확인; 제품 테스트 미실행 |
| AC3 | AGENTS의 필수 참조와 Work Packet 기록 의무, ADR/Trace의 규범 링크 | 필수 참조 등록 확인; main 전역 적용 전 |
| AC4 | #663~#667의 scope/non-scope·선행·파일 소유·독립 테스트·rollback 및 #573/#574 경계 | 계획 등록 확인; 구현·독립 QA·병합 미수행 |
| AC5 | 문서 내 상대 링크 대조, issue 번호 대조, 계획 의존성 순환·병렬 소유권 교집합 검사 | 아래 검증 범위/한계와 원본 결과 보존 |

이 표의 작성/존재 확인을 원격 Required CI PASS, 최종 QA_FINAL 또는 Owner ACCEPT로 사용하지 않는다.

## DOCUMENTATION_SYNC

| 문서 | 판정 | 이유 / 책임 |
| --- | --- | --- |
| AGENTS.md | UPDATED | Gantt 관련 변경 전 표준/검증표/ADR/Trace 필독 및 Work Packet 기록 의무; 상세 규칙 중복 없음 |
| GANTT_STATE_CONSISTENCY.md | ADDED | 지속 규범 GSC-01~12, 실제 Core 기반 no-op·recovery·axis·semantic receipt 및 예외 관리 |
| GANTT_STATE_CONFORMANCE.md | ADDED | 누적 SC-01~14와 원본 실패·source·테스트·증거 수준 연결 |
| GANTT_STATE_REMEDIATION.md | ADDED | U1~U5 의존성·파일 단독 소유·병렬 구간·#552 제품 연결·#573/#574 검증 |
| GANTT_ADAPTER_ADR.md | UPDATED | 후속 규칙 적용·전략 선택·버전/예외 기준; 기존 실험 DEFER/FAIL 보존 |
| GANTT_SYNC_TRACE.md | UPDATED | 표준 참조와 drift/semantic/axis 진단 증거 경계 |
| ISSUE_661.md | ADDED | 재개 기준·AC·문서 영향·실제 검증·미검증·인계 기록 |
| ARCHITECTURE.md / PROJECT_UX.md / MILESTONE_TIMELINE.md | N/A — 이번 단계 직접 수정 없음 | 기존 제품 구조/UX 계약을 바꾸는 구현이 아님. 새 장기 원본은 AGENTS/ADR/Trace에서 연결. 실제 연결 변경은 #667에서 해당 문서를 동기화 |
| TEST_PLAN.md | N/A — 기존 본문 유지 | 새 Conformance 문서가 기존 계획을 참조하며 누적 검증 설계만 추가. 실제 test manifest/runner/필수 실행 반영은 #663/#667/#574에서 증거와 함께 기록 |
| active PLAN.md | N/A — 별도 실행계획 사용 | GANTT_STATE_REMEDIATION과 본 Packet/#661을 계획 원본으로 사용; 광범위한 기존 계획/실패 원장 재작성 없음 |
| DESIGN.md / UI_UX_GUIDELINES.md | N/A | 새로운 시각 언어/화면 interaction 설계 변경 없음. architecture 규범을 시각 표준에 복제하지 않음 |
| API.md / DB_SCHEMA.md / SECURITY.md / SCHEDULING_ENGINE.md / IMPORT_SCHEMA.md / EXCEL_EXPORT.md | N/A | 제품·API·DB·권한·도메인·교환 형식 변경 없음 |
| CI_CD.md / REMOTE_VALIDATION.md / GITHUB_OPERATIONS.md / QA_REVIEW_POLICY.md / CHANGELOG.md | N/A | workflow·Required checks·QA/릴리스 정책 및 제품 동작 불변. 이번 계획/문서 변경 이력은 표준 변경 원장·본 Packet에 기록 |

## 구현 이슈와 인계

| 단위 | 이슈 | 선행 / 제품 활성화 |
| --- | --- | --- |
| U1 | [#663 공통 계약·하니스](https://github.com/planner77/masterGantt/issues/663) | #661 문서 승인·main 반영 후; 제품 연결 없음 |
| U2 | [#664 실제 Core 비교·복구](https://github.com/planner77/masterGantt/issues/664) | #663; U3/U4와 병렬, 호환/opt-in facade만 준비 |
| U3 | [#665 의미 기반 관측](https://github.com/planner77/masterGantt/issues/665) | #663; U2/U4 concrete 구현 직접 import 금지 |
| U4 | [#666 날짜축 transaction](https://github.com/planner77/masterGantt/issues/666) | #663; 설치 Core 실험 후 전략 결정, 미검증이면 DEFER |
| U5 | [#667 제품 통합](https://github.com/planner77/masterGantt/issues/667) | U2/U3/U4의 통합 source; 기존 #552/PR #561에서 단일 작성자 연결 |
| 기존 검증 | [#573](https://github.com/planner77/masterGantt/issues/573), [#574](https://github.com/planner77/masterGantt/issues/574) | #667 동결 candidate로 작은 화면 검증 후 최종 cross-feature gate; #553 교환 인수와 별도 |

U2/U3/U4 병렬 개발은 파일·인터페이스의 독립성을 뜻하며 무조건 동시 병합이 아니다. 권장 병합 순서는 U2→U3→U4이고 각 단계의 최신 main·CI/QA 및 승인 경로를 따른다. 제품 연결 전에 모듈이 통과해도 #552를 해결/종료하지 않는다. 실제 native GitHub blocked-by/sub-issue 설정을 수행한 것은 아니며 본문/표로 관계를 기록했다.

## 실제 검증과 한계

1. GitHub connector로 기준 main, PR #561, 문서 branch/immutable Head, 기존 산출물과 #661/#663~#667/#574를 재조회했다. 재개 전 compare는 문서만 6파일, behind=0이었다. 이 Packet 추가 후 변경 목록을 다시 확인한다.
2. AGENTS 필독 링크, GSC-01~12의 내용/상태, SC-01~14 및 U1~U5 본문을 대조했다. 존재하지 않던 `ISSUE_661.md` 상대 링크 대상을 이 파일로 보완한다.
3. 읽은 이슈/계획의 의존성과 모듈 소유권을 수동 전사한 모델로 Python 검사를 실행했다. 선행 누락/순환 없음, U2/U3/U4 계획 파일 영역 교집합 없음. 전사 모델 검증이지 저장소 Unit/E2E 실행이나 코드 import graph 검증이 아니다.
4. 공식 serialize/resize-chart/exec 및 Willow sample URL을 확인했다. 최신 웹 문서 조회는 설치2.7.3의 실제 동작/브라우저 조작 PASS가 아니다. 실제 전략 검증은 #666의 책임이다.
5. 이 세션의 컨테이너에서 github.com DNS 조회 실패로 git checkout 및 저장소 전체 Markdown validator/Unit/E2E를 실행하지 못했다. 도구로 확인한 원격 파일/링크 대조와 로컬 계획 모델 검사만 수행했다. 미실행 검증은 NOT TESTED로 유지한다.
6. 실제 별도 Reviewer를 실행하지 않았다. 문서 검토 상태 REVIEW_PENDING, Required CI/Trusted QA/Owner ACCEPT 및 main 반영은 별도다. 문서 PR 등록 후 자동 CI 결과를 기다리거나 제품 CI를 재실행하지 않는다.

## 최종 재개 지점

문서 PR을 main 대상으로 등록하고 #661 본문에 PR·문서·5개 구현 이슈 링크 및 실행 순서를 연결한다. 문서 PR의 검토/필수 검사와 별도 병합 승인 후 #663부터 구현을 시작한다. 표준의 ACCEPTED 승격은 검토/main 반영의 근거로 수행하며 문서만으로 제품 적합성을 승인하지 않는다. 실패 이력·#552 코드/기존 PR·CI/릴리스 권한을 변경하지 않는다.
