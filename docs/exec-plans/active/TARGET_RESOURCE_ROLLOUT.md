# Target·Resource 단계별 실행 계획 (#613)

상위 [Epic #613](https://github.com/planner77/masterGantt/issues/613), 계약 기준 [LOGISTICS_TARGETS](../../LOGISTICS_TARGETS.md). F0 조사 기준은 main `cbc73740236f3b3e177e2ed3196a0d02a292c741` / app `0.104.4` / SVAR Core `2.7.3`, migration ledger 파일 `0024`까지다. 운영 DB 적용 여부를 조회한 증거는 아니다.

## 우선순위와 상태

기본 데이터·필수 구성/연결 → Resource 관련 계획 공수·동일 원본 편집·주/월 Plan·Excel → 확장 물류 보기 순서다. 이 계획은 후속 이슈를 자동 구현/병합/게시할 권한을 주지 않는다. 각 착수 시 최신 main·open PR·migration·version·선행 증거를 다시 확인한다.

| 단계 | Issue | 작성 책임 / 산출물 | 직접 선행 | 현재 상태 |
| --- | --- | --- | --- | --- |
| F0 | [#614](https://github.com/planner77/masterGantt/issues/614) | Manager 문서·backend fixture, read-only ui_ux/qa_docs: ER/연결/집계/이관/공통 검산 | 없음 | 계약 main 병합 PR #625 / 9f17dbb2; Issue 전체·main artifact 완료 별도 |
| F1 | [#615](https://github.com/planner77/masterGantt/issues/615) | backend: 공정 master·제품 표준·사업장 occurrence·WorkArea DB/API | #614 | 구현 중, migration0025·API/호환 보호·문서; #615 Work Packet, PR CI 시작까지 |
| F2 | [#616](https://github.com/planner77/masterGantt/issues/616) | backend: Target/member CRUD·재사용·copy/Template guard | #615 | NOT TESTED |
| F3 | [#617](https://github.com/planner77/masterGantt/issues/617) | backend: binding whole/subset·self/subtree·coverage·provenance | #616 | NOT TESTED |
| F4 | [#618](https://github.com/planner77/masterGantt/issues/618) | ui_ux 설계/frontend: composer·연결 editor·원본 편집 | #615/#616/#617 | NOT TESTED |
| R1 | [#619](https://github.com/planner77/masterGantt/issues/619) | scheduler/backend: 기존 Resource pure projection에 Target 축 | #617 | NOT TESTED |
| R2 | [#620](https://github.com/planner77/masterGantt/issues/620) | backend: report/plan/filter/snapshot/exact drill API | #617/#619 | NOT TESTED |
| R3 | [#621](https://github.com/planner77/masterGantt/issues/621) | ui_ux/frontend: Resource/Group/Target 동일 원본 편집 | #618/#620 | NOT TESTED |
| R4 | [#622](https://github.com/planner77/masterGantt/issues/622) | scheduler/backend/frontend: 주·월 Plan·전체 과투입·Excel | #619/#620, UI #621 | NOT TESTED |
| Q1 | [#623](https://github.com/planner77/masterGantt/issues/623) | qa_docs/Manager: Resource MVP 종단간·이관·운영 수용 | #614~#622 | NOT TESTED |
| V1 | [#624](https://github.com/planner77/masterGantt/issues/624) | ui_ux/frontend/backend: 공정/구역/인스턴스 확장·Milestone 교차 | #623 | 후순위 / NOT TESTED |

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
