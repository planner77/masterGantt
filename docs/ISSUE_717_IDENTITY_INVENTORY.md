# Issue #717 — 이름 우선 표시 인벤토리

기준 main `d2768676aa7a0edff67df9bdeb3e1b49979fd577`, 후보 `0.116.1`. 소스 조사와 실제 브라우저 증거를 구별한다. 새 일반 표시 경로는 이름을 먼저 읽고, 필요할 때 native `식별 정보`를 펼쳐 원문 전체를 확인·복사한다. 동일 이름은 상위 경로·날짜·상태·정렬 순서로 구분하고 그래도 같은 후보에만 코드를 보조 표시한다. 이름 누락은 읽을 수 있는 확인 필요 상태로 표시한다. 원본을 짧게 잘라 선택값으로 사용하지 않는다.

| 경로 / 화면 | 이전 표시 | 반영 / 필요성 | 원문 접근 / 예외 |
| --- | --- | --- | --- |
| `milestones/project-milestone-stage-table.tsx` 일반 표 | 이름 아래 외부 ID 반복 | 이름·날짜·상태 우선 | 행의 접힌 식별 정보, 상세 Editor, 관리의 Copy ID |
| 같은 파일 원인 목록·관리 | 이름 뒤 외부 ID·작업 UUID 상시 | 이름·상태·일정 문맥, ID 접힘 | 원인·관리 식별 정보, 기존 정확 Task 명령 유지 |
| `milestones/project-milestone-dashboard.tsx` 조건·공수 bucket | 코드 병기 / 누락 이름 UUID 대체 | 이름·상태·날짜, 읽을 수 있는 누락 상태 | 선택 정보 disclosure; 검색에는 원본 이름·ID 유지 |
| `logistics/project-logistics-management.tsx` 공정·설비·시스템 | 고정 코드 선행 열 | 코드 열 제거, 이름 첫 식별 열 / 공정 이름 최소220px | 행 식별 정보; 공정 수정 원본 코드 필드 유지, 추가는 서버 자동 생성 |
| `logistics/project-logistics-dashboard.tsx` KPI 표 | 공정·설비·시스템 코드 선행 | 이름 우선 / 코드 on-demand | 행 식별 정보, 기존 canonical drill |
| `logistics/project-logistics-targets.tsx`, `target-master-registration.tsx` | 선택 후보 코드·UUID 반복 | 이름 우선, 동명만 코드, 인스턴스 이름·코드·ID 검색 | Target 상세·편집·구성원 식별 정보; 값은 canonical ID |
| `logistics/target-detail.tsx` | 구성원·작업 UUID 반복 | 이름·작업 경로 | 식별 정보에서 Target/entity/task ID 전체(구성원은 원본 entity ID로 확인) |
| `logistics/task-context-label.ts` | 외부 ID ancestry | 이름 경로, 동일 경로만 외부 ID | 원문은 대상 상세; 누락 부모 명시, canonical 참조 불변 |
| `gantt/project-task-editor.tsx`, `milestone-membership-panel.tsx` | 헤더/소속 ID 상시 | 이름·일정·상태 / ID 접힘 | Editor·소속 식별 정보, 기존 Copy ID 명령 |
| `gantt/relation-editor-dialog.tsx` | 모든 후보 externalId·UUID | 부모 이름·날짜, 실제 표시가 같을 때만 외부 ID | 선택된 Task 식별 정보; 검색·연결 body canonical 불변 |
| `gantt/task-target-binding-editor.tsx` | 출처·상속 Task UUID 반복 | 이름·경로 / 출처 ID 접힘 | binding 식별 정보에서 source/target IDs |
| `gantt/task-assignment-editor.tsx` | 모든 resource 코드 | 이름 우선·동명만 코드 | 리소스 식별 정보·기존 배정 원문 확인; ID 검색 |
| `projects/stage-filter-picker.tsx` | 모든 후보에 외부/작업 ID | 이름·부모/일정/상태, 같은 표시만 외부 ID | 선택 후 popup 밖 식별 정보; option에 중첩 명령 없음 |
| `projects/project-readonly-view.tsx` 고급 필터 | Target/공정/설비/System 코드 반복 | 이름 우선, 동명은 의미 문맥/필요 코드 | 각 도메인 관리/상세 / 기존 고급 externalId 필터 유지 |
| `resources/resource-target-views.tsx` | 이름 뒤 코드 / 이름 없는 node UUID | 이름·구성 문맥, 읽을 수 있는 누락 상태 | 선택·행의 식별 정보 / canonical selector 불변 |
| `resources/resource-dashboard-details.tsx`, `resource-plan-details.tsx` | Task/Assignment/Resource/Target UUID 상시 | 이름·공수·역할·상태 / ID 접힘 | 선택 Target은 Plan 상세 최초 단계(일별·개인·배정)에서도 `출발 선택 Target 식별 정보`로 원본 ID 조회·복사. Task/Assignment 원본은 배정 상세에 별도 표시. Project 전체 참고와 선택 기여 구분 유지 |
| `resources/resource-plan-view.tsx`, `resource-plan-model.ts` | Resource/Group 이름 뒤 코드 | 이름·직무·등급 | 행 disclosure에 원본 코드·ID; catalog 원본 불변 |
| `resources/resource-milestone-views.tsx`, `project-resource-dashboard.tsx`, `legacy-project-resource-workload.tsx` | 반복 코드/UUID | 이름 우선·동명 보조 | 선택 상세 식별 정보, 정밀 원본 배정 확인 예외 |
| `resources/resource-catalog-admin.tsx` | 관리 목록 코드 상시 | 이름 우선, ID·코드 접힘 | 코드 편집 input은 연동 업무상 보존, 목록 ID 검색 |
| `project-master/project-master-relations-editor.tsx`, `projects/project-master-select-fields.tsx` | 모든 선택지 코드 괄호 | 이름 우선, 동명만 코드 | 기준정보 관리자 편집/매핑에서 코드 원문 |
| `projects/project-work-calendar-editor.tsx` 대상 선택 | 모든 코드 괄호 | 이름 우선, 동명만 코드 | 리소스/그룹 관리자·정확 날짜 예외 편집; 날짜/서버 계약 불변 |
| `projects/project-import-preview.tsx`, `project-import-button.tsx` | Project/Task/참고 원본 ID 상시 | 이름·파일·revision 우선, 원문 접힘 | preview 행·참조·대상 식별 정보; digest/오류 path·code는 검증 근거 예외 |
| 프로젝트 목록·설정·생성·template | 주 제목은 이미 이름 | 기존 이름 우선 유지 | URL/JSON·명시 복사·연동 편집 필드 유지 |
| `gantt/milestone-membership-picker.tsx` #519 | 기존 이름 중심 후보 | 재구현 없음 | 기존 ID 검색·정확 선택 계약 보존 |
| Gantt Grid / tooltip / optional timeline marker | 외부 ID 열은 기본 숨김, 설명 tooltip | Core 변경 없음 | 사용자가 켠 식별자 열·Copy ID·부가 tooltip은 명시 요청 예외, marker OFF 유지 |
| 공유 인스턴스 원본 변경·삭제/복사 영향 확인 | 이름 뒤 정확 원본 ID | 파괴적/공유 변경의 정확 대상 확인 예외 | 전체 원본 ID를 그대로 확인. 일반 탐색과 구분 |
| JSON/Excel/Export/Import schema, 로그 오류 key | 호환 고정 식별자 | 표시 정책으로 변경하지 않음 | 외부 매핑·검증 규격 예외. 서버/DB/보안/revision 불변 |

## 실제 증거와 한계

- `output/playwright/issue-717/before/`: baseline main 실제 Chromium/mock HTTP, 390/768/1024/1440/1920px의 Milestone/공정 화면·geometry.
- `output/playwright/issue-717/after/`: 후보 실제 Chromium/mock HTTP, 같은 5폭, ID 원문 복사/검색·Enter/Space·관리창 Escape/focus·동일 Gantt/조회 mutation0. 공정 identity cell 최소220px, 표 내부 scroll, document 폭 및 dialog bounds 단언.
- `tests/e2e/issue-717-name-first.spec.ts` 1440px는 Clipboard 거부와 전체 원문 선택을 통한 수동 복사 대체 경로도 확인한다. OS Clipboard/실기기/screen reader 자체 실행 증거는 아니다.
- 실제 HTTP/SQLite의 동명 정확 수정·삭제·readonly 검증은 `tests/e2e/issue-717-identity-persistence.spec.ts`로 분리한다. 최종 실행 결과는 Work Packet을 따른다.
- Resource catalog의 기존 Resource/Group 5폭 screenshot/geometry는 `after/resource-catalog`에 보존한다. 관계 Dialog의 readonly·편집390/768/1024/1440px 기존 회귀도 실행했다. 나머지 변경 화면은 소스 인벤토리와 기존 타깃 회귀를 사용한다. 모든 화면의 모든 viewport·실기기·screen reader 검증을 완료했다고 주장하지 않는다. 원격 Required CI·Trusted QA·Owner ACCEPT는 별도 게이트다.

## Local Pre-PR의 미등록 경로와 수동 영향 매핑

`verify:prepr --mode=fast --base=origin/main --risk=MEDIUM --issue=717`의 2026-10-18 실행은 공유 경로의 HIGH 최소 위험도 미충족으로 **BLOCKED**였다. 분류를 HIGH로 승격하고 다시 조회한다. 앞선 dry-run은 아래 미등록 경로를 보고했다. CLI 자체 PASS로 바꾸지 않으며, 원격 CI/로컬 테스트를 생략하는 근거로 사용하지 않는다. 정책·선택기 source는 이번 제품 PR에서 변경하지 않았다. Manager는 아래 실제 소비자 매핑으로 별도 검증을 수행한다.

| 미등록 생산 경로 | 실제 소비자·검증 |
| --- | --- |
| `src/components/identifier-details.tsx`, `.module.css` | 새 #717 5폭+touch/Clipboard 실패·원문/실제 HTTP, Milestone/Resource 기존 geometry |
| `src/features/gantt/relation-editor-dialog.tsx`, `projects/stage-filter-picker.tsx` | relation candidate context 단위, relation-dialog-ux·Milestone relation·정확 연결 payload E2E |
| `src/features/gantt/task-target-binding-editor.tsx`, `task-assignment-editor.tsx` | logistics-target-authoring·issue-623-resource-mvp 기존 canonical binding E2E 및 Task context labels 단위 |
| `src/features/logistics/logistics-identity.ts` | logistics-identity 단위, 공정/설비/시스템 native 선택·#717 동명 실제 HTTP |
| `src/features/logistics/project-logistics-dashboard.tsx`, `project-logistics-management.tsx`, `project-logistics-management.module.css` | 기존 project-logistics-management E2E와 #717 5폭/원문 code/자동 생성·실제 HTTP |
| `src/features/logistics/project-logistics-targets.tsx`, `target-detail.tsx`, `target-master-registration.tsx` | logistics-target-authoring·issue-623-resource-mvp 대상 구성/연결·ID 회귀; 해당 전체 실행 여부는 Work Packet을 따른다 |
| `src/features/project-master/project-master-relations-editor.tsx`, `projects/project-master-select-fields.tsx` | 기존 기준정보 선택/매핑 구조·TypeScript·Lint·관련 단위. 새 browser 모든 조합은 NOT TESTED |
| `src/features/projects/project-import-button.tsx`, `project-import-preview.tsx` | 기존 Import 모델 단위·TypeScript·Lint·Production build, raw identity 표시 정적 검토. 실제 Import roundtrip 변경 없음; 새 모든 화면 geometry는 NOT TESTED |

`tests/e2e/helpers/identifier-details.ts`는 위 기존 Milestone/물류/Task/Resource E2E에서 정확 원문 textarea를 펼쳐 검증하는 소비 helper다. HIGH 재시도에서도 UNKNOWN 18로 BLOCKED이며, 동시에 진행되던 생성 파일 때문에 sourceStable=false였다. 이는 로컬 자동 선택기 전체 PASS 증거가 아니다.

미등록 매핑을 자동 선택기에 영속 반영하는 작업은 별도 정책 변경 검토 대상이다. 위 표는 CLI의 BLOCKED 결과를 소급 PASS로 바꾸는 것이 아니다.
## 2026-10-18 — F-009 Milestone matrix/Resource Plan 화면 밀도·식별 정보 정합성

- `src/features/resources/resource-milestone-views.tsx`의 Group/개인 Milestone 비교표 첫 열은 이름이 주 표시(최대2줄 clamp/원문 title)이고, 동일한 셀의 인접 `식별 정보` native disclosure에서 원본 Group/Resource ID·코드와 전체 복사 경로를 제공한다. 전체 긴 이름을 default summary에 다시 표시하지 않는다. 이름과 summary를 첫 열에서 **가로 compact flex**로 배치하고 summary는 키보드/터치 44px 진입 대상이며 펼친 뒤 전체 원본을 보존한다. `resource-dashboard.module.css`의 영향은 Milestone matrix first-column으로 제한된다.
- **원본 #2954.1:** 390px group matrix에서 최대 행201.5px/가시2행이었으며 기존 UI 계약은 `maxRowHeight<=104px`, `usableRows>=3`, 첫 열264/다음144, header<=88, documentWidth390/내부 horizontal scroll, 참조 KPI와 Gantt Core 불변이다. [Playwright raw measurement](https://github.com/planner77/masterGantt/actions/runs/39105484225/artifacts/12128891318)과 [Issue별 누적 원장 F-009](ISSUE_717_FAILURE_ANALYSIS.md) 참조. 수정은 테스트 기준 완화가 아니라 기본 화면의 실제 높이 조정이며 새 Head 통과는 원격 CI 완료 전 `NOT TESTED`.
- `src/features/resources/resource-plan-view.tsx`는 기존 Group/개인 row `IdentifierDetails`를 유지한다. `tests/e2e/resource-plan-dashboard.spec.ts`의 펼침 동작은 direct `th > button[aria-expanded]`만 사용, 같은 `th` 내부 닫힌 ID/코드 복사 버튼을 조작/레이아웃 버튼으로 오인하지 않는다. 주/월·Group/개인·5폭·sticky/scroll/조회 원장과 리소스 계획/Capacity는 영향 불변.

## F-015 담당자 오류 복구와 식별 정보 (2026-10-19)

`project-logistics-management.tsx`의 설비 담당자·시스템 PI 편집은 단일 이름을 기본으로 표시하고 동명은 원본 코드/ID로 구분한다. 유효 catalog 조회 시 현재 catalog를, 조회 실패·malformed 시 canonical resourceRoles를 사용해 이전 cache의 이름/코드를 섞지 않는다. 비활성 fieldset 밖의 읽기 전용 식별 정보에서 선택된 역할별 resourceId와 code 전체를 확인·복사할 수 있다. 저장/추가/삭제/주 담당 mutation은 기존 catalogReady·busy guard와 If-Match를 유지한다. `task-link-load-safety.spec.ts`는 4폭 오류·재시도·stale cache 배제와 동명 대상의 정확 Primary/삭제 payload를 검증한다.
