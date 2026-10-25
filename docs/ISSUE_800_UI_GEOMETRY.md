# Issue #800 — KPI 기준 전 화면 Geometry 회귀·증거

## Source of truth / 경계

- [#797 전 화면 감사](UI_AUDIT_2026_10_24.md), [#457 역사 coverage](ISSUE_457_UI_UX_COVERAGE.md), [#798 Work Packet](exec-plans/active/ISSUE_798.md), [#799 30쌍 실측](ISSUE_799_DASHBOARD_METRICS.md) 참조. #457의 원본 11범위/과거 실패·환경 기록은 **변경하지 않는다**.
- 착수 당시 main `f431806329dd3af492e1eb6ce67bb73c1262d61e` / app `0.133.2`. #797의 `8d9dd93a...` / 0.132.0 원본과 #799의 before main `fcd1ae59d268efa1913f4de625a9013cabd1de4a` / 실제 로컬 양쪽 runtime 0.133.1 결과는 **서로 직접 비교하지 않는다**. 0.133.2 Head의 실제 run은 별도 검증한다.
- #799 당시의 30쌍: KPI 첫 표 Y(390/768/1024/1440/1920) 1793.39/1720.39/1089.39/834.39/834.39 CSS px로 KEEP, 동적 25쌍은 첫 요약 Y 불변·표 Y 1.5~89px 개선·후퇴0(자세한 원본/manifest/부분 누락은 #799 문서). **현재 source의 새 개선 수치로 승격하지 않는다**.
- #797 수집 미완료(process390, Milestone1024, System1024), 별도 sidecar·calendar1440 HTTP500 등 원본 실패·별도 재확인 기록을 보존한다. 실제 서버·빌드 원인을 이 이슈에서 추측 수정하지 않는다.

## AC1 — #797 화면 인벤토리와 원본 spec/assertion 추적

`existing`은 커버리지 존재(해당 Head에서 PASS 의미 아님), `extend`는 이번 PR 추가, `gap`은 실행/상태 보완 필요, `N/A`는 기존 owner의 다른 환경 검증임.

| #797 화면군 | 기존 spec·assertion / 과거 Issue | 현황 |
| --- | --- | --- |
| 전역 shell·프로젝트 목록·검색/상태/빈 결과 | `cross-screen-regression.spec.ts`의 shell·auth/column/404, `project-workspace-ux.spec.ts`, #449/#452/#457 | existing; 모든 상태×폭 gap |
| 프로젝트 생성·복사·템플릿 | `project-workspace-ux.spec.ts`, `project-workspace-tabs-518.spec.ts`, #457/#797 | existing; 실제 저장/검증 상태×폭 gap |
| 일정/Gantt/Grid/Context/Fullscreen | `project-workspace-layout.spec.ts`, `project-workspace-ux.spec.ts`, #506/#457 | existing; 장기 성능 #507 N/A |
| KPI 대시보드 | `logistics-dashboard-request-state.spec.ts`, #449/#797/#799; #800 동일 fixture geometry | **extend/KEEP** |
| Milestone 대시보드 | `issue-732-milestone-dashboard.spec.ts`, `milestone-dashboard-state.spec.ts`, #731/#732 | **extend** + Gate 고유 테스트 유지 |
| 공정&WorkArea | `issue-733-process-workarea-dashboard.spec.ts`, #733 | **extend** + 구성/선택 모집단 유지 |
| 설비 | `issue-734-equipment-dashboard.spec.ts`, #734 | **extend** + 원본/진단 유지 |
| 물류 시스템 | `issue-735-system-dashboard.spec.ts`, #735 | **extend** + direct/coordination 유지 |
| 리소스 | `issue-736-resource-dashboard.spec.ts`, `resource-plan-dashboard.spec.ts`, #736 | **extend** + Assignment/Plan 유지 |
| 기준정보 4탭 + 관리자 3경로 | `project-resource-memberships-ui.spec.ts`, `cross-screen-regression.spec.ts`, #452~#455/#457 | existing; 실기기 #517 N/A |
| Task Editor/Relation/Resource/물류 연결, 설정/캘린더/Import/Export/Copy | `project-workspace-ux.spec.ts`, `issue-717-name-first.spec.ts`, `issue-719-contextual-help.spec.ts`, #457/#717/#719/#797 | existing + 영향 없는 세부 상태 gap |
| loading/error/not-found/notification/demo | `cross-screen-regression.spec.ts`, `logistics-dashboard-request-state.spec.ts`, `issue-730-view-composer.spec.ts`, #457/#730/#797 | existing + 상태×5폭 gap |

## AC2 — 같은 fixture의 측정, 출처, 비교

`tests/e2e/helpers/ui-geometry.ts`의 `observeDashboardSurface`는 6관점의 header/빠른 toolbar/최초 summary·table Y/높이, visible metric·row count, control wrap, sibling overlap, document horizontal overflow, table-owned scroll, error/status 수, viewport/locale/timezone/DPR/rootFont/visual viewport scale을 기록한다. `assertDashboardSurface`는 실측 viewport390/768/1024/1440/1920 × height900, populated summary/table, 문서 overflow≤1px, 툴바 형제 무겹침·표 scroll owner와 요약→표 순서를 검사한다. 도메인마다 서로 다른 첫 데이터 절대 px를 억지로 동일화하지 않는다.

**중복 새 E2E spec 없음**: `tests/e2e/issue-730-view-composer.spec.ts`의 기존 #798 test(5관점×5폭, real isolated SQLite/HTTP `seedWbsViewComposer`, keyboard/Space/Enter/Escape/focus·filter/scroll/원본 snapshot·mutation0)를 EXTEND해 25관측하고 **동일 fixture의 KPI 5폭**을 추가한다. 총 **30관측 / 기존 한 test**; 390/1440 각 관점 viewport PNG 12개와 단일 JSON attachment. `dashboardSurfaceReceipt`는 git Head/dirty 여부, manifest·DOM app version, test/helper/fixture/lockfile SHA256, browser/환경/명령(환경변수 누락 시 NOT RECORDED)을 연결한다.

이 **한 source의 30관측은 before/after가 아니다**. 과거 #798/#799 실측 원본을 비교하려면 명시적 도구 `tests/manual/issue-800-compare-geometry.mjs`를 사용한다. 이는 동일 fixture fingerprint/revision, version/Next/Playwright, source/collector/fixture hashes, 실제 viewport/PNG 크기, locale/timezone/DPR/font/zoom, 브라우저 버전, snapshot/spec/filter/totals, KPI KEEP와 first-data/visible counts·overflow를 대조한다. 실패·불일치·부분캡처는 정상 개선으로 판정하지 않으며 checkout SHA와 working-tree 실제 제품 hash는 구분한다.

```bash
node tests/manual/issue-800-compare-geometry.mjs \
  output/playwright/issue-799/before output/playwright/issue-799/after \
  output/playwright/issue-800/comparison.json
ISSUE_800_RUN_COMMAND='npm run test:e2e -- --grep "#798 다섯 관점"' \
  npm run test:e2e -- --grep '#798 다섯 관점'
```

수동 비교 입력 원본은 ignored `output/playwright/issue-799/{before,after}`와 보존된 artifact이며 이 PR에서 다시 실행한 것처럼 표기하지 않는다. 실제 동일 environment/source 캡처가 없으면 해당 개선 수치·QA=**NOT TESTED**.

## AC3–4 — 위험 기반 검증 (기존 고유 사례 보존)

| 위험/기능 | 변경영향의 원본 검증 | 이번 Head |
| --- | --- | --- |
| normal/5폭/기본 KO | #730 기존 #798 test + 신규 6관점 측정/12PNG | 실행 전 N/T |
| 긴 KO/EN·동일 이름/ID·숫자·단위·null/0/부분합 | #717/#799 `dashboard-metrics` / #732~736 / #730 long-name | 기존 고유 경계 유지, N/T |
| empty/loading/error/pending/stale/readonly/disabled | #730 stale/error + #732~736/797 상태·권한 | 영향별 선택, 모든 상태×폭 N/T |
| Tab/Enter/Space/Escape, tooltip/help·focus 복귀 | #798 native keyboard/focus + #719/#457 | 기존 고유 경계 유지, N/T |
| Gantt/Core layout, Task Editor, 프로젝트 필터·선택/scroll | #506/#717/#719/#730 + `project-workspace-*` | 원본 기능·권한·API/DB는 사진만으로 PASS 불가 |
| native125%, screen reader, 실기기·운영 source | #517 | N/A; 대신 수용 금지 |

## AC5–6 — Test Lifecycle/비용/문서·Gate

`TEST_LIFECYCLE_REVIEW`: `EXTEND` #730 기존 #798 하나 + 공통 observer; `KEEP_UNIQUE` #457 shell, #717/#719, #731~737, 관리자·Gantt/원본·권한·상태; `PARTIAL_OVERLAP` #457/#797 역사 수집기; `ADD` opt-in *비-E2E* 비교 도구; `CONSOLIDATE_CANDIDATE/RETIRE_CANDIDATE` 없음(대체 PASS·Owner 증거 부재). 자동 삭제, flaky skip, Assertion/Required 완화 없음. 예상 추가비용: 기존 테스트 안 DOM 측정 30회, PNG12, KPI 탭 진입1, 새 E2E test/서버/fixture 0. Runner-minutes 절감/증가 실제 값은 CI timing 전에 **N/T**. 기존 Chromium8-shard·Required3·Trusted/Owner 유지.

`DESIGN.md`: Delta B, 원칙 추가·UI CSS 수정 없음 → 변경 N/A. `PROJECT_UX.md`와 `UI_UX_GUIDELINES.md`의 새 증거 안내, `TEST_PLAN.md`의 #711 정책 준수(이 문서와 Work Packet을 이번 coverage 상세 원장으로 사용), `API.md/DB_SCHEMA.md` N/A. 테스트 결과나 비교 기록은 실제 실행 이전 PASS 금지. `risk_level=HIGH`, `qa_method=OWNER_MANAGED`, `qa_required=true`, `manager_decision=NOT TESTED`, `MERGE_READY=BLOCKED`, `release_required=false`, `release_authorized=false`. PR CI 시작만 승인; 모니터링/병합/Main/GHCR/Finalizer/이슈 종료 없음.


## 2026-10-25 REWORK — 첫 PR CI 실패와 source 보완 경계

- [원본 Full #3281.1](https://github.com/planner77/masterGantt/actions/runs/40168112076)은 PR body 단일 행 `risk_level`/`qa_method`/`qa_required` 누락 및 Work Packet `DOCUMENTATION_SYNC` heading 부재로 QA Preflight FAIL. 구현 E2E/Quality/Docker 실행은 **NOT RUN**, Required3 FAILURE는 정책 차단의 파생이며 제품 FAIL 증거 아님. metadata-only #3283, 중간 synchronize 취소 #3284~3286의 개별 출처/Job 직접 실패는 [누적 실패 원장](ISSUE_800_FAILURE_ANALYSIS.md)에 기록한다.
- Codex [P1 KPI 제목 선택](https://github.com/planner77/masterGantt/pull/805#discussion_r4369868207)은 KPI `h4` 카드보다 아래의 관련 Milestone `h3`을 잘못 앵커로 선정하던 문제로, KPI viewport root를 context 기준으로 잡고 다섯 동적 관점은 원래 heading을 유지하도록 교정. 뷰 디자인/원본 CSS 수정 아님.
- Codex [P2 빈 조회 영수증 비교](https://github.com/planner77/masterGantt/pull/805#discussion_r4369868209)은 양쪽 `reports: []`가 같아도 PASS 가능한 검증 공백을 지적. 비KPI 각 sample의 두 capture에 실제 populated `snapshotId/spec.root/filters/totals/range/asOfDate` receipt가 있는 경우에만 비교하며 누락은 FAIL/NOT_COMPARABLE, KPI는 원래 WBS report N/A이다.
- 구조 확인은 base validator regex와 현재 source 비교 수준. 변경 HEAD의 실제 Chromium/negative comparator 실행, CI/Trusted/Owner는 별도 확인 전 **NOT TESTED**. #457/#797/#798/#799의 역사 값과 실패를 변경하지 않는다.
