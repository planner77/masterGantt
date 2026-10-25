# Milestone Timeline #553 교환·출력 수용 추적표

기준: 2026-10-25 / 운영 **marker OFF** / Issue [#553](https://github.com/planner77/masterGantt/issues/553), PR [#562](https://github.com/planner77/masterGantt/pull/562). #548의 역사적 ON 계획과 #551의 개발용 lane은 현재 운영 수용 조건이 아니다. Main 기준 #552 native 행 제거를 유지한다.

| #553 AC / #548 MP | 근거 테스트·경로 | 문서 | 이번 latest-head 증거 |
| --- | --- | --- | --- |
| AC1 full canonical·Summary·전체 Ready/Complete·revision 조회 불변 (MP-01/03) | `tests/fixtures/issue-553/canonical-interchange.ts`, `tests/integration/milestone-timeline-interchange.test.ts`; #552 `milestone-visibility.spec.ts` | MILESTONE_STAGE_GATES / MILESTONE_PRESENTATION_POLICY | 새 Head 원격 NOT TESTED |
| AC2 JSON1.1 UUID/FK·명시 소속·mixed Link 원자 거부 (MP-05/06) | 위 integration 13개 중 JSON/mixed/rollback 및 `milestone-timeline-interchange-http.spec.ts` | IMPORT_EXPORT | 새 Head 원격 NOT TESTED |
| AC3 Project Copy/Template·multi-root Copy/Cut·complete lock | integration 및 HTTP Copy/Template spec; 기존 #464 교환 guard | IMPORT_EXPORT / TASK_RELATIONS | 새 Head 원격 NOT TESTED |
| AC4 Excel hidden Milestone/Source revision/Resource opt-in (MP-06) | integration OOXML·HTTP 실제 Workbook; 기존 `resource-excel-export-ui.spec.ts` | EXCEL_EXPORT | 새 Head 원격 NOT TESTED |
| AC5 SVG/PNG canonical WBS/범위·fail-closed·escaping (MP-06) | integration SVG·HTTP SVG / 기존 `project-gantt-image-export.spec.ts`의 실제 PNG·SVG E2E | IMAGE_EXPORT | 새 Head 원격 NOT TESTED |
| AC6 OFF UI 390/768/1024/1440/1920·Day/Week·소속/날짜/복귀 (MP-02/04/07/08) | #552 `milestone-visibility.spec.ts`의 운영 OFF 5폭; #574 별도 종단 QA. 과거 #553 UI ON 10건 이식 금지 | MILESTONE_TIMELINE / PROJECT_UX / 본 가이드 | 동일 새 Head 전체 원격 NOT TESTED |
| AC7 사용 가이드/환경·불변식·테스트 이력 | `docs/MILESTONE_USER_GUIDE.md`, 본 표, `docs/ISSUE_553_FAILURE_ANALYSIS.md` | TEST_PLAN / ISSUE_LIFECYCLE | 작성, 실제 QA_FINAL/Owner ACCEPT NOT TESTED |

## 선행·후속 및 출처 관리

- #549~#551: 모델·Dashboard·선택적 표시 기술 이력; 과거 source PASS는 최신 main의 PASS가 아니다.
- #552/PR #561: marker-OFF WBS 분리 완료, native M row/bar 0; main에 병합된 baseline을 이 PR에서 재구현하지 않는다.
- #553/PR #562: 기존 0.106.1 stacked source `afd5ec2899183a2464b64f91d34e9de5d8a8319c`는 archive와 merge first-parent로 보존. 최신 main 동기화 후 **선별 이관**이며 과거 6-shard 증거는 현행 8-shard CI의 PASS가 아니다.
- #574: 실제 5폭·HTTP/SQLite·SC-01~14 및 독립 통합 수용의 책임. #573/#693: 사용자 opt-in marker ON용 **선택** 후속이며 #553/574 OFF 수용을 막지 않는다.

TEST_LIFECYCLE_REVIEW: 기존 `milestone-visibility.spec.ts`, `project-gantt-image-export.spec.ts`, `milestone-exchange-state.spec.ts`, `resource-excel-export-ui.spec.ts`, `milestone-stage-exchange.spec.ts`를 검색해 상호 비교했다. canonical fixture/integration 및 실제 HTTP 교환은 **KEEP_UNIQUE** (실제 DB/새 UUID·process restart와 기존 synthetic UI가 다른 위험), 이미지 E2E에 안내 문구 assertion은 **EXTEND**, old marker-ON UI 파일은 **RETIRE_CANDIDATE 아님**—archive에서 역사 보호, 최신 운영에 무단 실행/복원하지 않는다. 기존 테스트 삭제·skip·assertion 완화 없음. 신규/변경 테스트 Local NOT TESTED(실행 환경 미제공), Full8/Trusted/Manager NOT TESTED; 병합/Release 미승인.
