# Issue #491 프로젝트 생성·복사·템플릿·입출력 폼 배치

## 현재 후보: 최신 main 정렬 / 독립 검토 준비

현재 main은 외부 PR #498 / Issue #492 Hover Tooltip이 반영된 `61a5f511d79e1f9429635bb0da35c0c02ee2163c`(tree `ff49917c4326aa6ff6b1d9f9ef33666148a4f11e`), application `0.95.0`이다. 현재 후보는 같은 branch의 `/home/planner/Dev/masterGantt-worktrees/issue-491-latest`에 정렬한 PATCH `0.95.1`이다. 원래 baseline의 0.94.3 after8 PASS와 첫 정렬 0.94.4 after8 PASS(각2.5분), 독립 PRE_QA/UIX 및 모든 원본 자료/index는 과거 증거로 보존한다. 제품4/spec/helper와 C소비자 before는 변하지 않았으나 Gantt Tooltip의 mousemove/focusin/scroll 영향이 있어 최신0.95.1 후보의 after-latest8개 모두 PASS(2.5분)다. 문서 gate와 독립 delta 검토를 연결하여 원격 게시한다. 공식 quality/e2e/docker 및 최종 QA/Manager ACCEPT는 NOT TESTED다.

## 요청 범위와 현재 기준

[Issue #491](https://github.com/planner77/masterGantt/issues/491)은 #456의 C 후속이며 Epic #449에 속한다. 사용자 요청은 구현, 관련 문서 갱신, 독립 사전 검토, 원격 branch/PR 게시와 exact-head PR CI 등록까지다. CI 결과 모니터링, 병합, main CI/GHCR, tag/release, branch 정리, Issue/Epic 종료는 포함하지 않는다. 공식 quality/e2e/docker와 최종 QA/Manager ACCEPT는 NOT TESTED로 유지한다.

착수 baseline은 main `44b2ee3562cf76a73368a49fa17933ed341ab424`, tree `ed88528bdd834442764f50edd687dd43c206d3d0`, application `0.94.2`다. 전용 worktree는 `/home/planner/Dev/masterGantt-worktrees/issue-491`, branch는 `fix/issue-491-project-transfer-layout`이다. 기존 #491 branch/PR은 없었다. 기존 10개 worktree, 12,625개 파일, index 및 원래 checkout의 raw26을 보존한다. frozen npm ci와 native SQLite smoke는 PASS이며 제품·문서·버전 구현은 실제 before 뒤 결정한다.

## Source of Truth와 지원 경로

DESIGN.md의 blue Light UI, system font, semantic token, content-aware control 폭과 parent-owned spacing을 유지한다. interaction·접근성은 UI_UX_GUIDELINES, 기존 초안·401/412·native dialog 수명은 PROJECT_UX, 실행 단계는 ISSUE_LIFECYCLE/AGENT_PROMPTS를 따른다. REQUIREMENTS/ARCHITECTURE/API/DB_SCHEMA/SCHEDULING_ENGINE/SECURITY/TEST_PLAN/REMOTE_VALIDATION/CI_CD/GITHUB_OPERATIONS와 활성 UI_UX_ROLLOUT도 해당 영향을 확인한다.

| 표면 | 실제 진입 및 지원 범위 |
| --- | --- |
| 빈 프로젝트 생성 | `/projects/new`, 기존 semantic field group 및 생성 방식 탭 |
| 프로젝트 복사 | Project 더보기 및 기존 목록 복사 진입 |
| 템플릿 저장 | Project 더보기 → 템플릿으로 저장 |
| 템플릿 선택·생성 | `/projects/new?mode=template`, native radio 선택 및 새 Project 생성 |
| Import | 편집 가능한 Project의 JSON 파일 선택 → preview → create-only commit |
| Export | 공통 내보내기의 Excel/JSON/SVG/PNG 및 image 범위 옵션 |
| 견적 옵션 | Excel includeResourceEffort 체크박스 및 Resource 탭 inline 개발 견적·M-D/M-M·필터 |

현재 웹 CSV parser와 사용자 mapping 화면은 없고 CSV HTTP 요청은 415 계약이다. 실제 미지원 경계를 FOLLOW-UP/N/A로 기록하며 신규 구현하지 않는다. 역할·공수 표 전체 재설계와 계산 변경은 제외한다. fullscreen의 C header 진입은 실제 가시성을 확인한 뒤 지원 여부를 판정한다. 정적 source만으로 화면 PASS 또는 FIX/KEEP를 확정하지 않는다.

## 인수 기준과 검증

1. 표면별 actual before의 진입·파일·상태·PNG/geometry·Issue/PR 연결을 남기고 FIX/KEEP/FOLLOW-UP을 결정한다.
2. 390/768/1024/1440/1920px에서 긴 입력·큰 수와 표면에 해당하는 validation/readonly/loading/pending/error/401/412를 관측한다. label/error 연결, intrinsic 폭, 같은 행 동급 action top/height 차이 1 CSS px 이하, 실제 글자·focus containment와 scroll owner를 비교한다.
3. native Tab/Arrow/Home/End/Escape, focus 복원, 초안과 source password clearing, read pending 취소와 mutation pending 차단을 기존 소비자 정책대로 검증한다. #490의 shared busy Escape guard를 복제하지 않는다.
4. JSON 1.0/1.1 preview/commit/digest/If-Match, CSV 미지원, Excel formula/secret 안전성, image download 및 서버 공수 authority/M-D/M-M 계약을 유지한다. actual SQLite/API 성공과 bounded mock 지연·오류·큰 수 관측은 분리한다. 템플릿 instantiate는 실제 navigation·edit·원본 불변을 검증했으며 201은 직접 response status 측정이 아닌 서버 계약값이다.
5. 취소·오류·조회·template save·readonly export에서 Gantt instance/scroll/tree/columns/scale/selection/scope를 보존한다. 생성·복사·template instantiate 성공은 새 Project navigation이므로 동일 instance 조건과 분리한다. Import 성공의 의도된 canonical 변화는 제외하고 기존 mount·사용자 화면 상태를 확인한다.
6. 관련 최소 LFF, DOCUMENTATION_SYNC, 독립 ui_ux/PRE_QA, 게시본 동등성, exact-head PR CI 등록을 각각 실제 증거로 남긴다. 실제 125% 확대·실기기·screenreader·Windows Excel/VBA/DRM·운영·최종 수동 UX는 별도 NOT TESTED다.

같은 before/after spec/helper와 fixture를 재사용하고 source/spec/helper hash, 실제 viewport/locale/timezone/DPR/browser/version 및 정확한 명령을 기록한다. 최초 FAIL과 각 raw report/trace/stdout은 고유 위치에 보존한다. 비밀값·session/Cookie/token·실제 DB/runtime log는 게시하지 않는다. source/test 편집 전 own Next를 정지하고 generated next-env/tsconfig는 정확히 복원한다.

## Work Packet과 파일 소유권

| 담당 | phase 및 쓰기 소유권 |
| --- | --- |
| Manager | scope/AC/version/phase, Issue PLAN/STATUS/EXCEPTION, 이 실행 계획과 active PLAN, 게시·PR 승인 |
| ui_ux | read-only 설계 및 actual before/구현 비교, `/tmp` 보고서만 작성 |
| frontend | 초기에는 `tests/e2e/project-transfer-layout-491.spec.ts`, `tests/e2e/helpers/issue491-transfer-fixture.ts`, 선택 `output/playwright/issue-491`만 작성; actual before 후 승인된 소비자 파일과 아래 문서 |
| infra | 전용 branch/worktree/설치, 버전 승인 후 package.json/package-lock.json/CHANGELOG, 승인 allowlist 게시·PR·CI 등록 |
| qa_docs | read-only intake, DOCUMENTATION_SYNC 후 독립 code/test/docs/증거 검토 및 게시본 동등성 |

모든 전문 Agent의 `issue_comment_writer=manager`, `issue_comment_allowed_types=NONE`이다. 재귀 위임은 금지하고 Manager 포함 동시 최대 6을 유지한다. 전역 restyle, shared primitive 복제, 새 domain/API/DB/auth/scheduling/import-export schema/견적 알고리즘은 비범위다. 제품 파일 쓰기와 PATCH 여부는 실제 before 및 독립 비교 후 Manager가 확정한다. 승인 전 broad stage/reset/clean/commit/ref/PR 변경을 하지 않는다. 인증 401의 git/gh 재시도나 credential 변경 없이 connector/public exact-SHA fetch를 사용한다.

## DOCUMENTATION_SYNC와 다음 handoff

frontend는 PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN 및 신규 ISSUE_491_UI_UX_REVIEW에 실제 진입·지원 경계·분류·상태·geometry·환경·한계를 동기화한다. JSON_IMPORT/IMPORT_EXPORT/EXCEL_EXPORT/IMAGE_EXPORT/ISSUE_27_PROJECT_COPY/ISSUE_56_RESOURCE_WORKLOAD/ISSUE_414_ROLE_WORKLOAD_DASHBOARD는 실제 변경과 안내 영향에 따라 갱신하거나 항목별 N/A 근거를 남긴다. DESIGN/API/DB/SECURITY/SCHEDULING_ENGINE/IMPORT_SCHEMA/VBA/DEPLOYMENT/CI_CD/REMOTE_VALIDATION/GITHUB_OPERATIONS/ARCHITECTURE/REQUIREMENTS의 계약 변경이 없으면 구체적 N/A 근거를 기록한다. Manager는 packet/active PLAN, infra는 승인된 버전/CHANGELOG를 담당한다.

착수 version은 0.94.2다. 실제 5폭의 간격·초점 결함을 확인하여 하위 호환 presentation PATCH `0.94.3`을 확정한다. `release_required=true`, `release_authorized=false`이며 사용자 요청은 정식 릴리스 승인이 아니다. 버전 쓰기는 마지막 baseline before와 own Next 정지 후 infra가 수행한다.

진행: BRANCH_READY → actual before/독립 설계 비교 → Manager FIX 범위·버전 확정 → IMPLEMENTING → LOCAL_VALIDATED → DOCUMENTATION_SYNC → 독립 사전 검토 → PR_READY → 명시 allowlist 게시 → 독립 게시본 동등성 → PR 및 CI 등록 → 요청 범위 STATUS. CI run의 등록 metadata만 확인하며 status/conclusion/jobs/logs/check 결과를 조회하지 않는다.

## 첫 actual before와 독립 비교

before-run1의 생성·템플릿 2개 case는 PASS, 복사 1개 case는 401 기대 전에 새 비밀번호 validation 상태로 FAIL했다(52.0초). 원본 조회 초기화가 끝나기 전에 민감 입력을 채운 조건을 확인하여 실제 제출 준비 상태로 oracle을 정정한다. 원래 FAIL·부분 캡처·private report/trace는 보존하고 제품 결함으로 아직 단정하지 않는다. 제품 코드는 baseline 0.94.2 그대로다.

독립 ui_ux가 완료한 생성·템플릿의 geometry 50개와 선택 PNG를 대조하여 문서 overflow 0, 같은 행 action top/height 차이 0px을 확인했고 해당 배치의 KEEP을 제안했다. viewport 밖 focused capture 5개는 native keyboard PASS로 인정하지 않는다. 실제 Tab/ShiftTab의 visible focus·clipping owner를 추가 관측하고, 미완료 복사와 나머지 표면은 FIX/KEEP 미정으로 유지한다. 제품 파일·버전 결정은 전체 actual before의 명확한 범위가 확보된 뒤 수행한다.

## 실제 FIX와 제품 소유권 확정

before-run2의 실제 5폭에서 template save textarea border bottom과 footer button top이 같다(390px: 605px, 나머지: 593px). outline 3px + offset 3px의 바깥 6px이 action 영역과 겹친다. footer 내부 취소/저장도 gap 0px이다. Export footer는 desktop 가로 버튼과 390px image range의 세로 버튼 모두 gap 0px이다. Manager가 실제 PNG를 확인했고 독립 ui_ux의 `/tmp/issue491-template-field-footer-review.json`(SHA256 `6a4a04d4807753fb4a771b6bcf340a164a709b8c5320825692da9966b9270b3b`)과 bbox를 대조했다.

frontend의 초기 제품 쓰기 소유권은 다음 3파일이며 아래 Import 실제 관측으로 1파일을 추가한다. 모든 baseline before가 끝나고 own Next 정지 후 별도 IMPLEMENTING handoff로 실행한다.

- `src/features/projects/project-export.module.css`: 해당 form-actions에 flex/wrap/align 및 gap 12px. 기존 좁은 화면의 1열 grid 전환을 유지한다.
- `src/features/templates/project-save-as-template-button.tsx`: 전용 module import와 form/footer class만 연결한다.
- 신규 `src/features/templates/project-save-as-template.module.css`: form parent에 grid/gap 12px/min-width 0, footer에 flex/wrap/gap 12px을 적용한다.

Export의 border/padding/focus가 있는 36px compact 입력은 KEEP이다. 전역 40px 강제, DOM 순서·controller·공유 dialog·Gantt·API/DB/domain 변경은 승인하지 않는다. 전체 8개 baseline before 뒤 실제 footer peer/마지막 visible field bbox 및 focusable region clipping을 측정하는 회귀 helper를 보완하고, 영향받는 template save/Export/Import 3개 before를 재관측한다. 그 최종 helper로 PATCH after 8개를 실행하며 다른 5개 before의 helper hash 차이는 명시한다. 템플릿 필드/footer 및 Export의 normal/pending 양쪽 간격·native focus를 확인한다. source inventory는 신규 untracked module도 포함하는 실제 파일 목록을 사용한다. 최초 oracle/fixture FAIL은 실행별로 보존한다.

## Import region focus와 최종 4파일 범위

baseline 0.94.2의 before-final 8개 case는 모두 PASS했다(2.4분). 당시 geometry helper의 일반 control 목록에는 focusable `role=region`이 없어 표 스크롤 영역의 outline clipping을 기본 assertion이 검출하지 못했다. 별도 실제 region bbox로 390px의 외곽 x38–352/y451.5–669.5와 body clip x40–350/y93–663을 대조하여 좌우 2px, 아래 6.5px 잘림을 확인했고 ui_ux가 PNG/JSON을 독립 대조했다. 1440px region native-focus는 당시 미관측으로 NOT TESTED이며 새 before에 추가한다.

Manager는 네 번째 제품 경로 `src/features/projects/project-import-preview.module.css`만 추가 승인 범위로 지정한다. body padding 4→8px과 scroll-padding-block 8px, tableOwner scroll-margin-block 8px 및 필요한 끝단 공간을 최소 적용하고 실제 native Tab의 outline 6px이 body/viewport 안에 남는지 재측정한다. table min-width 960px 및 table-owned 가로·세로/body 세로/footer의 기존 scroll 역할을 유지한다. 초점을 안쪽으로 강제하거나 clip 검증을 완화하지 않는다. controller/TSX/shared primitive는 변경하지 않는다.

## IMPLEMENTING handoff

추가 before-targeted는 의도한 template save/Export/Import 3개와 제목 정규식에 함께 포함된 Gantt 1개, 실제 4개 모두 PASS했다(1.3분). Import의 1440px 실제 native focus도 좌우 2px clipping을 확인했다. 6회 before는 총 29case/21 PASS/원래 8 FAIL이며, 최종 전체 8 PASS와 강화 helper의 4 PASS를 분리한다. 첫 실패 원인은 source 준비·download close·동적 locator·Task 필수 progress·실제 Import 진입·열린 메뉴 toggle·headless fullscreen Escape 조건이며 원래 stdout/report/trace 및 hash를 보존한다.

최종 baseline spec SHA256은 `1fb2342eff3fcec3f8b23878d492f6e546c4209f58157905f452537ee42c73f9`, helper는 `d89a89406aa74486bd0eca1d928ccab4ce18eab82f8188a899854ed39f2253e8`다. footer 실제 peer gap 11px 이상/같은 행 top·height 차이 1px 이하, template 마지막 visible field→footer 11px 이상, Import region의 viewport 및 실제 clipping owner를 after assertion에 포함한다. baseline은 실제 결함 수치를 보존한다.

own Next 정지·generated2 복원·source323/docs199(Manager2 제외)/기존 output1063/version3 drift0 확인 후 Manager가 제품 4파일과 infra 버전 3파일 쓰기를 승인했다. frontend는 새 module을 source inventory에 포함하며 최종 324파일을 기록하고, infra 버전 완료 신호 후 after 서버를 시작한다. 관련 CSS·class만 수정하므로 새 계산 Unit/전체 로컬 build/Docker는 필요하지 않으며 전체 회귀는 PR CI로 넘긴다. DOCUMENTATION_SYNC 작성 소유권은 frontend의 PROJECT_UX/UI_UX_GUIDELINES/TEST_PLAN/ISSUE_491_UI_UX_REVIEW 및 변경 표면의 JSON_IMPORT/EXCEL_EXPORT/IMAGE_EXPORT, Manager의 packet/PLAN, infra의 CHANGELOG다.

## LOCAL_VALIDATED와 비교 범위

infra가 package/lock canonical 3개 값을 0.94.3으로 반영하고 CHANGELOG를 갱신했다. dependency diff는 0이고 version check와 scoped whitespace는 PASS다. 기존 10개 worktree/12,625개 파일/root26 및 current 보호3443의 drift0를 확인했다. 버전 proof는 `/tmp/issue491-version-result.json`, SHA256 `e16402263d170710a93a4bb347b795c0e63389f5ea31a58910814e527aee9d79`다.

첫 after-run1은 8case/5 PASS/3 FAIL(2.0분)이다. 기존 native radio/checkbox의 border0/padding0에 text-input 식별 경계 assertion을 적용한 helper 분류 오류이며 실제 제품 FIX는 통과했다. before facts에 이미 기록한 `c.type`으로 native choice는 label/visible size/native appearance를 검증하고 text/date/select/textarea 경계 검사는 유지한다. 이 after-only 정정은 관측 함수를 바꾸지 않으며 이전 before geometry를 소급 수정하지 않는다. 원래 FAIL과 helper hash 차이를 보존한다.

최종 after spec은 기존 `1fb2342eff3fcec3f8b23878d492f6e546c4209f58157905f452537ee42c73f9`, helper는 `8d7a5f18dc16b2b210b7d075dcc7349060dd7f9f2363280c9b91cf5e4f0f8e29`다. 같은 최종 helper의 8개 after가 모두 PASS했다(2.5분). 제품 4파일은 첫 수정 이후 그대로이며 source inventory는 실제 324개다. before-targeted의 강화 helper와는 after-only native choice 검사 차이가 있고, 나머지 before-final 4개는 이전 helper로 실행된 사실을 명시한다. 전체 before 6회/29case/21 PASS/원래8 FAIL과 after 2회/16case/13 PASS/원래3 FAIL은 최종 8 PASS와 분리한다.

typecheck 및 범위 ESLint는 PASS(오류0/경고0), own Next 정지와 generated2 복원은 확인했다. 문서 동기화 뒤 Markdown/whitespace를 확인하고 독립 ui_ux/PRE_QA에 넘긴다. 재실행 필요가 없는 전체 로컬 Unit/build/Docker 및 원격 CI 결과는 실행하지 않는다. 실제 native 125%·실기기·screenreader·Windows Excel/VBA/DRM·운영·최종 수동 UX와 headless browser fullscreen Escape는 별도 NOT TESTED다.

독립 ui_ux는 최종 geometry 242개와 계약 JSON 10개, PNG 242개의 파일/hash 및 대표 PNG 6개를 시각 확인했다. 실제 before 짝은 before-targeted 126개 + before-final 116개이며 제품 4파일의 현재 SHA와 모든 after provenance가 일치한다. 수정 3표면의 실제 간격·초점과 관측한 KEEP 상태 비교는 PASS다. selector-owner overflow 0과 Import tableOwner의 의도된 clientWidth 292/scrollWidth 960은 구분한다. `/tmp/issue491-uiux-review.json`의 SHA256은 `bb019460cd1d6bc8028b449926fa69c59d1e0045bbf9099a9a8d45afcc0df544`이며 문서 gate·최종 게시 후보 연결과 독립 PRE_QA는 별도 확인한다.


## RESUME: 게시 전 main 이동

외부 main 변경 9개 중 원래 후보와 겹치는 6개는 CHANGELOG, PROJECT_UX, TEST_PLAN, active PLAN, package와 lock이다. Resource Catalog 제품·테스트와 Issue #486 실행 계획은 최신 main bytes를 유지한다. infra가 원본 worktree를 같은 HEAD에 detach하고 로컬 branch를 old44b에서 newD8로 CAS 이동하여 새 worktree를 준비한다. 기존 원본 파일·index·raw와 다른 10개 worktree를 보존한다. 제품 4개·spec/helper가 동일한지 검증하여 이전 before의 재사용 범위를 명시하고, 최신 0.94.4에서 관련 8개 after를 고유 실행으로 남긴다. 이전 8회/45case/34 PASS/원래11 FAIL은 소급 수정하지 않는다.

frontend는 PROJECT_UX/TEST_PLAN의 최신 #486 내용을 유지하면서 #491 자체 섹션만 통합한다. Manager는 이 실행 계획과 active PLAN, infra는 0.94.4 package/lock 및 CHANGELOG를 담당한다. 독립 ui_ux와 qa_docs는 새 후보의 실제 파일·문서·증거를 read-only로 검토한다. 원래 DOCUMENTATION_SYNC와 버전 증거는 과거 baseline 범위이며 최신 후보의 gate를 대체하지 않는다. remote stage/commit/blob/ref/PR은 새로운 후보 승인 전 수행하지 않는다. `release_required=true`, `release_authorized=false`와 요청 종료점 PR CI 등록을 유지한다.

main 이동 근거 SHA256은 `e03600cdfef23dcf2e4d92e14db8544f063a51f0df09e29a4c0e1c70f42c5d1a`, 원래 후보 SHA256은 `1dd5152b93d004680ea968584eb0f5efd58eac7d1d2182a0a99f4209db7d274c`다. Manager의 RESUME 기록은 Issue comment `6034646145`다.

새 worktree 준비와 PATCH 0.94.4의 canonical version·dependency 불변·frozen npm ci·native SQLite·version/whitespace 검사는 PASS다. 보호 대상은 기존 10개와 원래491의 총 11개 worktree/16,904파일이며 승인된 원래491 branch detach 이외의 HEAD/index/status와 파일 bytes drift는 0이다. 근거 SHA256은 `db643ea5267acf836646f680aeab1ded0b2195e0afea484b54cba2be5ed48697`이다. 새 후보는 아직 staging하지 않았으며 원격 변경과 CI 결과 조회는 0이다.

독립 QA 준비 검토에서 템플릿 instantiate의 safe JSON `actualInstantiationStatus:201`이 literal인 점을 확인했다. 실제 navigation·edit·원본 불변의 성공 assertion은 유효하나 이 literal을 HTTP status 직접 측정 PASS로 사용하지 않는다. 원본 spec/helper/JSON을 유지하고 최신 문서에서 이 한계를 명시한다. 다른 직접 response status assertion의 범위와 구분한다.

## 최신 0.94.4 로컬 실행

after-current-0944는 관련 8개 모두 PASS(2.5분)다. 제품 4파일·spec/helper bytes는 원래 최종본과 같으며 새 main의 Resource Catalog source만 별도 변화로 유지했다. 새 실제 geometry242/계약10과 대표 PNG10+JSON5를 `output/playwright/issue-491/review-current-0944`에 동결하고 원래63개 선택 증거와 구분한다. 원래8회45case34PASS11FAIL에 새8PASS를 더하면 실행 이력은 9회53case42PASS11FAIL이며 최초 실패를 지우거나 소급 PASS로 변경하지 않는다. 실제 템플릿 instantiate navigation/edit/source 보존과 서버201 계약값의 구분도 유지한다. 최신 후보의 DOCUMENTATION_SYNC·독립 검토·게시 동등성은 각각 증거를 확인한 뒤 승인한다.


## 두 번째 RESUME: Hover Tooltip main 통합

게시 직전 원격 쓰기0에서 외부 PR #498의 main 이동을 확인했다. 변경14개 중 후보와 겹치는7개는 CHANGELOG/PROJECT_UX/TEST_PLAN/UI_UX_GUIDELINES/active PLAN/package/lock이다. #491 제품4/tests2는 직접 겹치지 않는다. 최신 Gantt TSX/CSS/신규 tooltip helper 및 전용 테스트2/REQUIREMENTS/Issue492 실행 계획은 그대로 보존한다. 의존성 변화0이며 후보 PATCH는0.95.1이다. 원래491 및 current0944의 원본·index·raw·96파일 후보는 유지하고 current0944를 같은 HEAD에 detach하여 새 latest worktree의 같은 branch를 parent61에 CAS 정렬한다.

frontend는 최신main의 #492 섹션을 유지하면서 #491 자체 문서3개를 통합하고, 기존4개 계약 안내문서·새 관측증거·최신after8 및 실제수치에 맞춘 LFF를 동기화한다. Manager는 active PLAN/이 계획, infra는 package/lock/CHANGELOG를 담당한다. 제품4/spec/helper 동일성에 따른 이전 before 재사용은 C소비자 관측에 한정하며 source325 전체가 동일하다고 주장하지 않는다. 새 Tooltip과 Gantt 기능은 최신after에서 확인한다. 이전53case/42PASS/원래11FAIL과 새실행을 분리하며 최초 실패·환경 한계를 유지한다.

main 이동 근거 SHA256은 `a8441d37652fcb635a70006421b1bca0da43020d60b086b85121bd064fb1301b`, 영향분석은 `9660727b748b10b374af1199d064eb1de0a4b0629711bfd6681584130c708f9a`다. 정식 release 미승인과 요청 종료점 PR CI 등록은 유지한다.

두 번째 정렬 준비는 PASS다. 최신 #492 Tooltip 소스3·테스트2·REQUIREMENTS/실행계획을 그대로 보존했고 제품4/spec/helper는 원본 bytes와 같다. npm ci·native SQLite·version·scoped whitespace PASS이며 승인된0.95.1 canonical version 이외 dependency 변화0이다. 기존12개 worktree의19,400파일/index/status는 승인된detach 이외 drift0이다. 준비 증거 SHA256은 `bf5587f5cf3233c274d8432237933a26678f9818d37a60e2ddd02d01e9b3bdf0`이다.

## 최신0.95.1 실행 결과

after-latest-0951은 관련8개 모두 PASS(2.5분)이며 own Next0·generated2복원을 확인했다. 실제source325 중 최신 Tooltip 변경3파일은 유지하며 C제품4/spec/helper는 원래동결본과 같다. 새선택15개(PNG10/JSON5)7,815,099bytes의 geometry242/계약10을 `output/playwright/issue-491/review-latest-0951`에 남기고 기존78개 선택 자료는 불변 보존한다. 전체실행은10회61case50PASS/원래11FAIL이며 최신8PASS를 이전8회45case나0.94.4 after8과 분리한다. 최신 문서 링크 검사 수치는 실제 새stdout으로 기록하며 이전136/137 로그를 바꾸지 않는다. 기존ui_ux/PRE_QA의 검토범위를 재사용하되 최신Gantt상태·문서·snapshot/hash는 독립delta 검토에서 확인한다. 공식CI/QA_FINAL/ManagerACCEPT는 NOT TESTED다.
