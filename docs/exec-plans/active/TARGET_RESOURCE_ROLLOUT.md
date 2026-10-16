# Target·Resource 단계별 실행 계획 (#613)

상위 [Epic #613](https://github.com/planner77/masterGantt/issues/613), 계약 기준 [LOGISTICS_TARGETS](../../LOGISTICS_TARGETS.md). F0 조사 기준은 main `cbc73740236f3b3e177e2ed3196a0d02a292c741` / app `0.104.4` / SVAR Core `2.7.3`, migration ledger 파일 `0024`까지다. 운영 DB 적용 여부를 조회한 증거는 아니다.

## 우선순위와 상태

기본 데이터·필수 구성/연결 → Resource 관련 계획 공수·동일 원본 편집·주/월 Plan·Excel → 확장 물류 보기 순서다. 이 계획은 후속 이슈를 자동 구현/병합/게시할 권한을 주지 않는다. 각 착수 시 최신 main·open PR·migration·version·선행 증거를 다시 확인한다.

| 단계 | Issue | 작성 책임 / 산출물 | 직접 선행 | 현재 상태 |
| --- | --- | --- | --- | --- |
| F0 | [#614](https://github.com/planner77/masterGantt/issues/614) | Manager 문서·backend fixture, read-only ui_ux/qa_docs: ER/연결/집계/이관/공통 검산 | 없음 | #614 CLOSED / PR #625 병합. 당시 계약·main/Finalizer 원장은 Q1 수용표 참조 |
| F1 | [#615](https://github.com/planner77/masterGantt/issues/615) | backend: 공정 master·제품 표준·사업장 occurrence·WorkArea DB/API | #614 | #615 CLOSED / PR #627·#628 및 승계 원장. 원본 main FAIL을 소급 PASS하지 않음 |
| F2 | [#616](https://github.com/planner77/masterGantt/issues/616) | backend: Target/member CRUD·재사용·copy/Template guard | #615 | #616 CLOSED / PR #631 및 0.108.0 후속 승계·#672 보완. 원본 push CI 부재와 구별 |
| F3 | [#617](https://github.com/planner77/masterGantt/issues/617) | backend: binding whole/subset·self/subtree·coverage·provenance | #616 | #617 CLOSED / PR #676 병합, main/Finalizer·Release 원장은 Q1 수용표 참조 |
| F4 | [#618](https://github.com/planner77/masterGantt/issues/618) | ui_ux 설계/frontend: composer·연결 editor·원본 편집 | #615/#616/#617 | #618 CLOSED / PR #678 병합. 원본 Main #2745.1 FAIL·Finalizer SKIPPED 유지 |
| R1 | [#619](https://github.com/planner77/masterGantt/issues/619) | scheduler/backend: 기존 Resource pure projection에 Target 축 | #617 | #619 CLOSED / PR #677 병합, main/Finalizer 성공 원장은 Q1 수용표 참조 |
| R2 | [#620](https://github.com/planner77/masterGantt/issues/620) | backend: report/plan/filter/snapshot/exact drill API | #617/#619 | #620 CLOSED / PR #682 병합, main/Release/Finalizer 원장은 Q1 수용표 참조 |
| R3 | [#621](https://github.com/planner77/masterGantt/issues/621) | ui_ux/frontend: Resource/Group/Target 동일 원본 편집 | #618/#620 | #621 CLOSED / PR #683 병합, main/Finalizer 성공 원장은 Q1 수용표 참조 |
| R4 | [#622](https://github.com/planner77/masterGantt/issues/622) | scheduler/backend/frontend: 주·월 Plan·전체 과투입·Excel | #619/#620, UI #621 | #622 OPEN / PR #684 병합, PR #2770.1 SUCCESS. 착수 조회 Main #2771.1 진행 중·artifact/Finalizer NOT TESTED |
| Q1 | [#623](https://github.com/planner77/masterGantt/issues/623) | qa_docs/Manager: Resource MVP 종단간·이관·운영 수용 | #614~#622 | #623 구현·로컬 통합 수용 후보, [Work Packet](ISSUE_623.md) / PR CI 시작까지. M2 최종 gate BLOCKED |
| V1 | [#624](https://github.com/planner77/masterGantt/issues/624) | ui_ux/frontend/backend: 공정/구역/인스턴스 확장·Milestone 교차 | #623 | #624 후순위 / NOT TESTED, Epic 전체 완료 아님 |

M1=#614~#618, M2=M1+#619~#623, M3=M2+#624. M2 수용이 Epic 전체 완료를 뜻하지 않는다. #617 계약과 실제 구현이 완료되면 #618 UI와 #619 Domain을 분리 파일 소유권으로 병행할 수 있다. #620은 API 독립 검증까지 가능하나 #621 사용자 수용은 #618 완료가 필요하다.

## 기존 기반과 중복 조정

| 기반 | 재사용·책임 |
| --- | --- |
| #183~#189·#280 물류·동적 유형 | 현재 DTO/Service/DB 재사용, 과거 고정 type 목록 복원 금지 |
| #538 사업부/제품/사업장 | stable ID/유효 triple 재사용; #537 별도 요청을 자동 종료하지 않음 |
| #523~#530 Resource | T0/A/R·Calendar·raw Assignment·exact drill·Excel 원장 유지, 새 엔진 중복 개발 금지 |
| #379 전체 참조 JSON | 신규 versioned 참조 데이터 계약 인계; WBS JSON과 full backup/restore 구분 |
| #497 WBS 다중 root | 기존 exact drill 공통 경로 사용, 별도 탭 엔진 중복 개발 금지 |
| #556 툴바 | 기존 workspace/compact controls 확장, 전체 toolbar 재설계 비범위 |
| #548/#550~#553 Milestone | full canonical Gate 유지, 후순위 화면을 Resource 기반의 일괄 선행으로 두지 않음 |
| #567/#570~#574 Gantt 안정화 | 최신 main canonical gateway/viewport 단일 writer 재사용; 미통합 경로는 별도 NOT TESTED |
| #479 읽기 권한 | 착수 시 실제 read/private 정책 재사용; Target/report 우회 인증 금지 |

착수 조회에서 #614 기존 PR은 없었고, #609는 Trusted QA T3 임시 Draft로 별개다. 기준 main에는 #572 PR #612가 통합돼 있다. 위의 과거 이슈 번호만으로 현재 OPEN/CLOSED/CI 성공을 단정하지 않는다.

## 단계별 Gate·문서 소유

각 PR은 관련 Local Fast Feedback, DOCUMENTATION_SYNC, exact-head required quality/e2e/docker, Trusted 검증, Owner의 명시 병합 허가를 분리한다. 기본 `qa_method=OWNER_MANAGED`; 자동 구조 PASS나 사전 독립 검토는 Owner 허가가 아니다. 위험도는 실제 변경 경로로 다시 평가하며 F1 이후 영속성/API 변경은 HIGH 트리거를 확인한다. `release_authorized=false`가 기본이며 version bump나 CI가 게시 승인 근거가 아니다.

| 구현 경계 | 같은 PR에서 갱신할 문서·검증 |
| --- | --- |
| F1/F2 DB·권한 | LOGISTICS_TARGETS, DB_SCHEMA/API/REQUIREMENTS/ARCHITECTURE/SECURITY/TEST_PLAN, migration/FK/atomic rollback/재시작 |
| F2/F3 copy·Template·JSON | 관련 copy/template/import/export 문서, versioned 참조·local ID remap·silent loss guard |
| F3 연결·상속 | LOGISTICS_TARGETS/TASK_EDITOR/LOGISTICS_DASHBOARD, golden ID+전체 provenance+subset 삭제·move/type 전환 |
| F4/R3 UI | PROJECT_UX/TASK_EDITOR/UI_UX_GUIDELINES/TEST_PLAN, Design Delta, 390/768/1024/1440/wide·keyboard/focus/draft/stale |
| R1/R2/R4 집계·API·Excel | RESOURCE_KPI_DASHBOARD/API/EXCEL_EXPORT/TEST_PLAN, 같은 scope의 raw ID·raw 수치·snapshot/detail/export 일치 |
| 모든 단계 | CHANGELOG/version 영향 검토, active PLAN/해당 Work Packet/이 계획의 실제 상태·Issue 기록 |

F0 공통 검산은 `tests/fixtures/logistics-targets.ts` / `tests/domain/logistics-targets-contract.test.ts`다. F0-L/P/Q/F/R case ID를 후속 API/SQLite/UI/Excel에서 재사용하며 기대값을 약화해 통과시키지 않는다. 종단간 실패는 Q1까지 미루지 않고 발생 PR에서 수정한다.

운영 DB·Windows Excel/VBA/DRM·실제 proxy/TLS·off-host backup-restore·실기기/screen reader/최종 수동 UX는 해당 환경별 증거를 별도로 기록한다. GitHub Actions나 F0 fixture 검산으로 대체하지 않는다.

## F2 implementation candidate status — #616 (2026-10-12)

F1 #615 PR #627/#628 integrated before branch creation. F2 branch `feat/issue-616-logistics-targets`: migration0026, typed existing Equipment/System member reuse, Target CRUD and atomic Project revision, bounded list and member usage, Project Copy member identity remap, Template/JSON lossy-path guard. Implementation and tests committed; CI and post-migration runtime validation NOT TESTED. AC6 versioned Template persistence is **not** implemented: present loss guard returns conflict until a versioned snapshot is designed. F3 WBS bindings and R* Resource are still NOT TESTED. Treat F2 row above as in progress, not completed; no downstream merge assumptions.

## #616 F2 Template v2 후속 구현 후보

기존 Template 409 미지원 정책을 versioned `logistics.schemaVersion=2`의 Process occurrence/WorkArea mapping 및 Target/member 전체 저장·복원으로 교체한다. 새 Project-local Process/Equipment/System/Target/Member UUID를 재발급하며 공통 MCS는 단일 System 인스턴스를 공유한다. Legacy Template은 기존 복원을 보존하고 잘못된 triple/멤버/WorkArea는 전체 transaction을 409로 거부한다. JSON full graph는 #379에 남는다. PR #631 최종 CI/AC6 확정 이전 완료 판정은 금지한다.

## Issue #617 — F3 현재 구현 후보 (2026-10-14)

기준 main `e1957802`의 F2/Template v2를 재사용하여 migration0027, typed binding·subset/coverage·합집합 provenance, legacy 직접 연결 호환, whole/이동 영향 확인, Copy/Template v3·unsupported-format guard 및 usage nullable/실제 일반 Task·Summary 분리를 구현한다. 상단 F1/F2 candidate 문단은 착수 당시 이력이며 현재 F3 완료 근거로 사용하지 않는다. 후속 F4/R1을 이번 요청에 포함하지 않는다.

실제 Agent 분리 구현 및 독립 read-only qa_docs 검토를 사용한다. `qa_method=AGENT`, `risk_level=HIGH`, `qa_required=true`, `release_required=true`, `release_authorized=false`. 실행/AC/문서 원장은 [ISSUE_617](ISSUE_617.md)이며 이번 마지막 단계는 미해결 리뷰 처리 및 PR CI 시작이다. CI 모니터링·병합·Main artifact·정식 릴리스·Issue 종료는 별도다.

## Issue #619 — R1 pure Domain 착수 (2026-10-14)

F3 #617 PR #676이 main `96c6c74b304f1ccd09f7340f37ebf0b0c393ae3b`에 병합되어 단일 Target resolver를 재사용한다. #617 Issue OPEN은 Main/Release/Finalizer 후속 상태와 구별하며 이를 본 R1에서 완료 처리하지 않는다. #618 기초 UI와 병행 가능한 pure KPI 분석만 확장한다. 기존 report/plan/detail·Excel 공개를 자동 확장하지 않는다.

관련 계획 공수의 overlapping Target 소계와 raw Assignment union 전체, same-binding/member 조건, T0/A/R·전체 Milestone 및 전체 Project 부하를 보존한다. 후보 minor `0.110.0`, HIGH/OWNER_MANAGED, release_required=true/release_authorized=false. 실제 역할·AC·문서·로컬/원격 검증 상태는 [ISSUE_619](ISSUE_619.md)에 기록한다. 요청은 리뷰·충돌 해결 후 PR Full CI 시작까지이며 원격 완료 모니터링·병합·게시·Epic 수용은 별도다.

## Issue #618 — F4 현재 구현 (2026-10-14)

#615/#616 완료 및 #617 PR #676이 main `96c6c74b`에 반영된 현재 기반에서 F4 composer·Task binding UI·양방향 같은 원본 편집을 구현한다. 이전 candidate 상태표는 착수 이력이며 현재 완료 증거는 각 Issue/PR·Work Packet으로 확인한다. F4는 [ISSUE_618](ISSUE_618.md)을 따르며 minor0.111.0/HIGH/OWNER_MANAGED, release_required=true/release_authorized=false다. 실제 역할 분리 설계/구현과 별도 Agent 사전 검토를 사용하고 요청 종료점은 PR CI 시작이다. R1~V1을 자동 구현/완료하지 않는다.

## Issue #621 — R3 착수·범위 (2026-10-14)

착수 기준 main `78691a97bb8c0ba74a560965ca39479d7c80b72c`에는 #618 composer와 #620 보고 API가 포함된다. 위 candidate 표기는 과거 단계의 원장으로 보존하고 각 Issue의 main/Finalizer 완료를 이번 작업에서 추정하지 않는다. R3은 기존 Resource 탭의 Target 계층·역방향·비교/필터·같은 Task/정확 Assignment 편집과 상태/복귀를 연결한다. app0.113.0 MINOR, HIGH/OWNER_MANAGED, release_required=true/release_authorized=false. 실행·문서·GSC/AC·실제 검증은 [ISSUE_621](ISSUE_621.md)이 현재 기준이다. 요청 종료점은 PR Full CI 시작이며 #622/#623/#624·병합·릴리스·Epic 완료는 별도다.

## Issue #622 — R4 착수·현재 범위 (2026-10-14)

최신 main `53c57743`에 #621 PR #683이 반영되어 있다. 기존 Plan/Calendar·same-R 전체 부하·raw Assignment와 Excel bundle/writer를 재사용하여 Target 조건 분석·선택 밖 과투입 근거 편집/복귀·동일 snapshot current/project Excel을 확장한다. MINOR0.114.0, HIGH/OWNER_MANAGED, qa_required=true, release_required=true/release_authorized=false. 현재 실행·AC·문서·검증은 [ISSUE_622](ISSUE_622.md)을 따른다. 구현·문서·사전 검토·스레드/충돌 처리 후 Full PR CI 시작까지만 수행하고 원격 완료 모니터링/병합/게시/Issue 종료·Q1/#623 종단 수용은 별도다.

## Issue #623 — Q1 Resource MVP 통합 수용 후보 (2026-10-15)

기준 main `bd54205741da65a0211cf77f9cb086d3cdb1ab2a`에 R4 #622 및 경량 Plan Target catalog 수정이 포함된다. 위 상태표는 이 착수 시점의 단일 조회이며 아래 과거 candidate 문단은 당시 이력이다. Issue CLOSED를 원본 모든 Run PASS로 읽지 않는다. 자세한 선행 SHA·Run/attempt·실패/승계·진행 중 상태는 [수용표](../../TARGET_RESOURCE_ACCEPTANCE.md)에 보존한다.

Q1은 같은 F0 golden의 Domain/API/UI/OOXML, 다관점 개별 편집·복귀, actual legacy migration·Copy/Template·합성 backup/restore·5폭/한도 관측과 사용자/운영 가이드를 통합한다. 테스트/문서 전용이면 app0.114.0 유지, HIGH/OWNER_MANAGED/qa_required=true, release_required=false/release_authorized=false다. 실제 수행과 최초 실패·보완은 [ISSUE_623](ISSUE_623.md)을 따른다.

요청은 사전 검토·리뷰/충돌 처리 후 exact-head Full PR CI 시작까지다. Q1 로컬 후보·PR 생성은 M2 최종 수용/Owner ACCEPT/main artifact·운영 환경 수용이 아니다. #624/V1은 NOT TESTED이며 Epic #613 전체 완료로 확대하지 않는다.
