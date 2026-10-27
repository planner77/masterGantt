# 대시보드·Global Resource·물류·기준정보 재점검 — 2026-10-27

## 최초 점검 범위와 결론

[Epic #824](https://github.com/planner77/masterGantt/issues/824)의 점검·이슈 등록·[DESIGN.md](../DESIGN.md) 구체화 기록이다. 대시보드의 폭 제한·반복 헤더와 동적 조회의 검색·제어 밀도 차이를 확인했다. Global Resource와 전역 관리의 인증 후 목록은 소스 기반 개선 후보이며 실제 결함으로 확정하지 않았다. 제품 코드 수정·PR·CI·병합·배포·이슈 종료는 이번 요청 범위 밖이다.

사용자의 `63km 대응 물류자동화 구축 프로젝트` 사례는 요구사항으로 보존한다. 현재 접근 가능한 공개 목록에는 해당 프로젝트가 없어 직접 재현은 **NOT TESTED**다. 비밀번호·관리자 세션 없이 비공개 화면을 우회하지 않았다.

후속 구현은 [통합 Work Packet](exec-plans/active/ISSUE_824.md)에 별도 기록한다. 아래의 제품·PR·배포 비범위 및 NOT TESTED는 최초 감사 실행의 경계이며 후속 결과를 소급하지 않는다.

## 출처와 실행 경계

| 구분 | 실제 근거 |
| --- | --- |
| 최신 main 소스 | `dc8543f390616c0d5aca90a4f91899f3cf7ac5da`, application `0.135.4` |
| 문서 작업 공간 | `docs/ui-ux-dashboard-reaudit`, 별도 worktree. 기존 #593 checkout과 미추적 산출물 보존 |
| 실제 브라우저 대상 | 기존 로컬 Docker `127.0.0.1:8299`, 화면 `v0.135.2`, OCI revision `596dd70db8b242f450ab555ed2bcf049a0c14564` |
| 프로젝트/권한 | 접근 가능한 공개 `Test`, 읽기 전용. 실제 63km 데이터·전체 운영 데이터 대표성이 없음 |
| 관측 환경 | Playwright CLI, cached Chromium153, headless, `ko-KR`/`Asia/Seoul`, 높이900px, 설정한 viewport 폭390/1440/1920px. coarse/touch 미실행 |
| 관측 방식 | GET 화면 이동·읽기 전용 조회, DOM bounds/getComputedStyle·캡처. 업무 저장·인증 시도 없음. 화면 조회가 읽기 전용 query POST를 호출할 수 있음 |
| 출처 대조 | 문제 관련 management TSX/CSS·KPI CSS·WBS CSS·Milestone CSS·전역 관리자 CSS 3개, 총8파일의 deployed/main Git blob이 동일함. 전체 앱의 동일성이나 최신 main 런타임 PASS는 아님 |
| 정제 수치 | [26개 화면·폭 관측 및8개 blob 대조](evidence/ui-ux-2026-10-27/observations.json). DB 파일·원본 API 응답·쿠키·세션은 저장하지 않음. JSON에서 `input.value` 필드는 수집하지 않았으며 표시명·집계·선택지 라벨은 포함함. PNG에는 날짜 입력을 포함한 공개 Test의 실제 화면 표시 내용이 포함됨 |

실행한26조합의 `document.scrollWidth-clientWidth=0`이다. 이는 문서 가로 overflow의 제한된 관측 결과이며, 모든 행·오류·keyboard/focus·업무 의미의 PASS가 아니다. 입력 높이·heading·surface 좌표는 DOM 측정이고 시각 평가는 아래 원본 캡처를 함께 사용했다. 전후 개선 비교는 아직 없다.

## 화면별 점검과 이슈

| 화면 | 현재 관측·소스 근거 | 판정 / 이슈 |
| --- | --- | --- |
| KPI | 1920px에서 상위 가용1872px/물류 내용1440px:432px 미사용. 중복 `물류 구성 / Gantt WBS와 독립` 헤더45px. 기준일/기간 필터 배경65px, 실제 input35px·select32px.390px에서는 헤더113px·필터290px로 적층 | 개선 #825. 숫자·단위·집계 기준·진단·정확 drill은 KEEP |
| Milestone | 가용1872px를 이미 사용. 상위 탭14px·계층제목16px·하단 대시보드18px. 상단 검색/상태/기간 input16px·44px 높이, 하단 검색36px·13px. toolbar1920px/1440px에서72px,390px에서284px | 밀도 #826, 구획 #827. 모든 제목을 탭과 같은 크기로 강제하지 않고 역할별 크기 통일 |
| 공정&WorkArea | 1440px cap·반복 헤더, 검색44px/font16px·위 label. 구성 참고와 필터된 작업이 같은 시각 흐름에 적층 | 폭/헤더 #825, 공통 density #826. 구성 원본수와 Task/Assignment·공수 모집단은 KEEP |
| 설비 | 같은1440px cap·헤더·WBS 검색/제어16px/44px | #825/#826. 설비 관리단위·원본 수량·여러 WorkArea의 의미와 중복 방지 KEEP |
| 물류 시스템 | 같은1440px cap·헤더·WBS 검색/제어16px/44px | #825/#826. 직접/조율·1식·공통 집계·Task/설비 수량 차이는 KEEP |
| 프로젝트 리소스 대시보드 | 배포v0.135.2에서는 일부44px 제어. main은 #819에서6peer에 fine36px/13px·coarse44px를 적용한 별도 소스 | main #819를 내부 참고. 배포 전후 source가 다른 값을 개선 비교로 섞거나 동일 문제를 재등록하지 않음 |
| 프로젝트 기준정보 — 공정&WorkArea | 같은1440px cap/반복 헤더. 공정 관리제목18px·행/본문16px, 검색36px/14px·새로고침40px | 공용 shell은 #825, 관리 local 밀도·편집 동선은 #829 |
| 프로젝트 기준정보 — 설비/시스템 | 같은1440px cap/헤더, 검색36px/14px. readonly 상태 안내가 실제 상단 `편집 잠금 해제`와 다른 `편집 활성화`를 지칭 | #825/#829. 검색36px 자체를 대시보드44px 결함과 혼동하지 않음 |
| 프로젝트 기준정보 — 리소스 | 별도 full-width 계열. 제목18px·검색/조건36px/14px·등록/새로고침40px | #829 비교/회귀 대상. 참여등록과 Task 개인 배정은 별개이며 현재 readonly 확인을 CRUD PASS로 확대하지 않음 |
| Global Resource `/resources` | 인증 전 heading24px·인증 input/button40px,1920/390px 문서overflow0. 인증 후 소스는 검색/탭 상속 글꼴·표14px, nested panel16px·38/40px 제어 편차 후보 | #828. 인증 폼 KEEP; 현재 인증 후 실제 목록·그룹·편집은 세션 부재로 BLOCKED/NOT TESTED |
| 전역 물류 `/logistics-admin` | 인증 전은 같은 shell/40px/overflow0. 목록 CSS는 body 글꼴 미지정, header12.8px·field14.4px/38px·행 action40px | #830. 실제 populated 목록에서 편차를 재현한 뒤 변경; 소스 후보만으로 실패 확정 금지 |
| 전역 기준정보 `/project-master-admin` | 인증 전 같은 shell/40px/overflow0. 관리 소스에14px/40px 및 명시 column budget이 있어 비교 기준 후보 | #830. 기존 규칙이 양호한 구역은 KEEP하고 전역 물류와 실제 정합성 확인 |

### 원본 화면 증거

모두 배포v0.135.2·공개 Test·1920×900의 viewport 캡처다. 전체 페이지나 최신 main 제품 수용을 뜻하지 않는다.

- [KPI 폭·헤더·기간 필터](evidence/ui-ux-2026-10-27/dashboard.kpi-1920.png)
- [공정&WorkArea 폭·검색·요약](evidence/ui-ux-2026-10-27/dashboard.process-1920.png)
- [Milestone 상단 조회·범위·계층 표](evidence/ui-ux-2026-10-27/dashboard.milestones-1920.png)
- [프로젝트 기준정보 공정·작업 구역](evidence/ui-ux-2026-10-27/master.processes-1920.png)

## 개선 이슈와 파일 소유권

| 순서 | 이슈 / 우선순위 | frontend 구현 시 소유권·경계 |
| --- | --- | --- |
| 1 | [#825 공용 폭·헤더·KPI 필터](https://github.com/planner77/masterGantt/issues/825), P1 | `project-logistics-management.tsx/.module.css`, KPI filter framing. 기준정보 공용 shell도 여기서 수정 |
| 2 | [#826 동적 조회 검색·폰트·제어](https://github.com/planner77/masterGantt/issues/826), P1 | `wbs-view-dashboard.tsx`, composer 및 `wbs-view.module.css`. Milestone/process/equipment/system과 리소스 기존 소비자 회귀 |
| 3 | [#827 Milestone 구획](https://github.com/planner77/masterGantt/issues/827), P2 | Milestone consumer-local TSX/CSS. 공통 WBS CSS는 #826에 맡김 |
| 4 | [#829 프로젝트 기준정보4관점](https://github.com/planner77/masterGantt/issues/829), P2 | #825 공용 shell 교정 후 관리 local 목록/row·검색/정확 원본 편집 동선 |
| 별도 | [#828 Global Resource](https://github.com/planner77/masterGantt/issues/828), P2 | 전역 resource-catalog-admin. 프로젝트 리소스 #819와 별도 |
| 별도 | [#830 전역 물류·기준정보 관리자](https://github.com/planner77/masterGantt/issues/830), P2 | logistics-type-catalog-admin·project-master-admin·relations-editor의 재현된 local 결함만 |

공용 파일은 직렬 통합한다. 모든 이슈는 OPEN / PLANNED이며 AC checkbox를 제품 완료로 처리하지 않는다. 각 이슈에 재현·목표·AC·기존 테스트 확장·문서 영향·위험 및 QA·원격 gate 경계를 기록했다.

2026-10-27 GitHub open issue 조회에서 #797/#798/#799/#800/#819는 열린 항목에 없었다. 해당 과거 완료 범위를 재개하거나 당시 PASS를 현재 잔여 문제의 해결로 전용하지 않는다. #822 일정 Ctrl+휠, #517 실환경, #720 웹 매뉴얼은 기존 별도 업무를 유지한다.

## DESIGN 반영과 목표 배치

기존 workspace-first/data-dense/flat/compact 원칙을 사용자 명시 요청에 따라 기존 절에서 구체화했다. 새 테마·폰트·컴포넌트 프레임워크는 도입하지 않는다. Skill 검색의 visible/associated label 권고는 수평 label+input에도 그대로 적용하고 placeholder-only를 채택하지 않았다.

```text
프로젝트명·편집 상태
일정 / 대시보드 / 기준정보
선택한 하위 관점
현재 조건·검색·기간·명령                [필터/조회 구성]
범위·단위·필수 상태
요약 / 주요 표·계층 / 정확 원본·보조 진단
```

- 폭: 상위 workspace가 gutter/가용 폭을 소유, 삽입 컴포넌트의1440px cap·중복 gutter 제거.
- context: 중복 화면명·도메인 관계 헤더는 상시 적층하지 않고 기존 도움말로 제공. 권한/오류/stale·현재 범위는 인접 표시.
- typography: 반복 조회 도구13px·본문/표14px 전후·section16px. 동일 역할의 상·하단 구획은 같은 규칙을 소유하고 KPI 값 강조는 분리.
- 검색/제어: 충분한 폭에서는 보이는 label+input 한 행, 좁은 폭은 의미 단위 wrap. 대시보드 fine36px/coarse44px 목표, 관리자40px/Editor44px 및 native choice 예외 보존.
- framing: KPI 기간 필터는 content+6–8px 전후 vertical padding과 실제 wrap으로 높이를 결정. 빈 높이/stretch·중첩 padding 금지.
- 별도 예외: 전역 관리자100rem·24/16px gutter, 인증32.5rem/40px는 KEEP. 이를 프로젝트 물류1440px 제한과 같은 결함으로 제거하지 않음.

## 검증 상태와 후속

| 항목 | 상태 / 한계 |
| --- | --- |
| 소스 감사·범위 대조 | 수행. 별도 `audit_design` ui_ux read-only 검토와 Manager 브라우저 관측 |
| 문서·증거 사전검토 | 별도 `audit_qa` qa_docs read-only PASS.26개/폭 분포·8blob·4PNG hash/크기·이슈OPEN·예외 보존을 검산. 공개 화면 데이터 표현과 실제 테스트명 P2 두 건 반영. 제품 QA_FINAL·Manager ACCEPT는 아님 |
| 브라우저 실측 | 26조합 수집 완료:1920px 대시보드6+프로젝트 기준정보4+전역 인증3=13,1440px 사용자 예시5,390px 사용자 예시5+전역 인증3=8. 총26. 전체 UX PASS 아님 |
| 768/1024px·프로젝트 기준정보390px·리소스1440/390px | NOT TESTED. 구현 수용 시5폭 모두 확장 |
| 인증 후 전역 관리자 현행 실목록 | 관리자 세션 미제공으로 BLOCKED, 실제 실행은 NOT TESTED. 정적 후보로 추적 |
| 63km 프로젝트 직접 재현 | NOT TESTED. 현재 접근 가능한 공개 목록에 없음 |
| keyboard/focus/Escape·coarse/touch·편집/오류/stale/긴 문자열 | 이번 실행 NOT TESTED. 캡처/DOM을 접근성·상태 회귀 PASS로 쓰지 않음 |
| 제품 구현·정확 Head quality/e2e/docker·QA_FINAL·Manager ACCEPT | NOT TESTED. 문서/이슈 등록만 수행하며 병합 승인 없음 |
| main/GHCR/정식 release·정리/Issue 종료 | 이번 범위 N/A. `release_required=false`, `release_authorized=false`, version 유지 |

구현 테스트는 기존 `tests/e2e/issue-730-view-composer.spec.ts`, `issue-732~736` 관점별 spec, `admin-auth-layout.spec.ts`, `resource-admin-layout.spec.ts`, `logistics-table-density.spec.ts`, `project-master-admin.spec.ts`, `cross-screen-regression.spec.ts`와 `helpers/dashboard-metrics.ts`·공통 geometry observer를 먼저 찾아 EXTEND/KEEP_UNIQUE를 판정한다. #819의6peer geometry/coarse 회귀는 별도 `issue-819*` 파일이 아니라 `issue-736-resource-dashboard.spec.ts`에 확장되어 있다. #798/#799/#800은 과거 이슈 참조이며 같은 번호의 spec이 존재한다는 뜻이 아니다. 이번 문서 작업은 새 상시 테스트·skip·timeout·Required gate 변경이 없다.

문서 영향: DESIGN·본 점검 기록·관측 증거·활성 PLAN/UI_UX_ROLLOUT 갱신. UI_UX_GUIDELINES/PROJECT_UX/사용자 매뉴얼/TEST_PLAN은 실행 동작 변경이 없어 이번 N/A이며 소비자 구현 이슈에서 실제 계약과 테스트를 동기화한다. API/DB/일정·보안·CI/CD/배포·QA 정책은 변경하지 않는다. 원격 문서 반영·PR/CI는 이번 범위 밖이다.
