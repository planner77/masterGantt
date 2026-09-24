# UI/UX 이슈 순차 실행 계획

요청: 원격 UI/UX 이슈를 Issue Lifecycle에 따라 단계별 처리하고 변경본을 로컬 Docker로 제공한다. **Issue #30은 제외**한다.

## 기준과 범위

- 2026-09-24 확인: 원격 main `69fa36aac486bf81bd247595cc0ab2bfbbc8982a`, version `0.27.0`, 열린 PR 없음.
- 열린 대상: #115, #116, #117, #118, #119, #121, #122, #130.
- #120/PR #135 공통 semantic token은 기존 결과를 재사용한다.
- 독립 감사에서 #120이 `release_required=true / release_authorized=false`인 채 종료된 불일치를 확인했다. 구현/PR/main 임시 GHCR은 PASS이나 정식 릴리스가 미완료이므로 #120을 재개했다. 구현을 반복하지 않고 남은 릴리스 범위·승인·증거를 후속 정리한다.
- 기준: [Issue Lifecycle](../../ISSUE_LIFECYCLE.md), [디자인](../../../DESIGN.md), [UI 지침](../../UI_UX_GUIDELINES.md), [원격 검증](../../REMOTE_VALIDATION.md).
- 현재 승인 범위는 구현/PR/main 검증과 로컬 확인용 Docker다. 정식 릴리스는 `release_required=미확정`, `release_authorized=false`이며 tag/정식 GHCR 게시 전에 범위를 확정한다. 미확정을 N/A 또는 전체 완료로 표시하지 않는다.

## 순서

| 단계 | 목표 | 현재 상태 |
| --- | --- | --- |
| #115 | 캘린더 draft와 미리보기 대응, 실패·revision 변경 처리 | 구현·문서·PR #137·main CI·임시 GHCR 검증 완료; 정식 release 및 종료 정리 단계 |
| #116 | 작은 화면·높이의 계층 메뉴 경계 및 키보드 보존 | 구현·문서·PR #144 원격 CI PASS 후 Codex P2 보완 및 최신 main 재통합 진행 |
| #117 | 리소스 조회 실패 시 이전 결과·부분 실패·재시도 구분 | 대기 |
| #118 | 모바일/태블릿 도구 모음 밀도와 정보 버튼 개선 | 대기 |
| #119 | 반복 입력의 대상 구분·필드 오류 연결 | 대기 |
| #121 | App Shell 본문 바로가기 | 대기 |
| #122 | 상세 7건 인수 기준·증거 감사 및 tracker 정리 | 대기 |
| #130 Phase 1 | Project List 디자인 정합화 | 대기 |
| #130 Phase 2 | Project Workspace 디자인 정합화 | 대기 |
| #130 Phase 3 | Task Editor 디자인 정합화 | 대기 |
| #130 Phase 4 | Search / Filter 공통 시각·상태 정합화 | 대기 |

각 이슈/Phase는 앞 단계 완료 후 구현한다. 설계 → branch → 구현/관련 테스트 → DOCUMENTATION_SYNC → 독립 QA → PR quality/e2e/docker → Manager 병합 판단 → main CI/임시 GHCR exact digest smoke/SBOM/provenance/cleanup → 로컬 Docker 확인 → 인수 기준 감사 → 안전한 branch 정리/Issue 종료 순서를 따른다. 필요한 릴리스의 범위/승인은 종료 전 확정한다.

## 역할과 소유권

- Manager(`/root`): 계획/인수 기준/통합/판단, 이 실행 계획 문서.
- ui_ux(`/root/ux`): 읽기 전용 설계·구현 비교. 추가 재귀 위임 없음.
- frontend: 지정 컴포넌트·테스트 및 해당 UX 문서. 다른 이슈 구현은 시작하지 않는다.
- infra(`/root/infra`): Git/PR/CI/Docker와 package/lockfile/CHANGELOG 버전 동기화.
- qa_docs: 구현 담당과 분리된 읽기 전용 QA 및 원격 증거 확인.

동일 파일에 동시 쓰기하지 않는다. 기존 `next-env.d.ts` 개발 모드 변경은 보존하며 이 작업 커밋에 섞지 않는다.

## #116 진행 기록

- branch `fix/issue-116-context-menu-viewport`, PR #144, version `0.27.2`.
- 390/768/1024/1440px 네 모서리에서 child menu viewport 경계, 390px drilldown, 390×160 내부 스크롤, keyboard/Escape/focus 복원 및 #77/#104 회귀를 전용 E2E로 검증한다.
- 원격 PR head `30fe979465325b74a6ff2fad0709d11550bbc807`의 CI run 35964067138은 quality/e2e/docker PASS였다. 이전 실패는 Playwright generic Event의 contextmenu 좌표 누락과 viewport 준비/hover 잔류 원인을 보존해 기록했다.
- Codex P2에서 child가 열린 뒤 일반 root 항목으로 focus/pointer 이동 시 child가 남는 접근성 불일치를 확인했다. 일반 root 명령 진입 시 child를 닫고 `aria-expanded=false`를 유지하도록 코드·E2E·PROJECT_UX·TEST_PLAN을 보완한다.
- 최신 main `f7f18ee589812e0357a023887202979c83b245ba`를 작업 브랜치에 merge commit으로 통합했다. 보완 head의 원격 quality/e2e/docker와 review thread resolve 후 병합한다.
- API/DB/Scheduling 계약 변경은 N/A이며 실제 모바일 기기·스크린리더 수동 검증은 별도 NOT TESTED다.

## #115 작업 계약

- 기준 main: 위 SHA. branch `fix/issue-115-calendar-preview`, PATCH `0.27.1`.
- implementation_owner/documentation_owner: frontend. 파일: `src/features/projects/project-work-calendar-editor.tsx`, 관련 E2E, `docs/PROJECT_UX.md`, `docs/TEST_PLAN.md`.
- 모든 의미 있는 국가/기간/휴무/대상/추가/삭제 변경에서 이전 미리보기가 현재 결과처럼 남지 않도록 한다. 계산 중·실패·완료·재계산 필요 상태와 다음 행동을 표시한다.
- revision/publicId 변경이나 늦은 응답이 결과를 되살리지 않도록 방어한다. 초안 및 요청 중 입력 잠금, 401/412 처리는 유지한다.
- 저장 전 미리보기 강제 절차를 추가하지 않는다. API/DB/계산 알고리즘 변경은 범위 밖이므로 관련 계약 문서 수정은 N/A.
- 검증: KR→US→재계산, 각 draft 변경, 실패/재시도, revision 변경/늦은 응답, 390/768/1024/1440 상태 안내와 버튼 접근, 기존 캘린더 저장 회귀.
- 로컬 빠른 검증과 원격 quality/e2e/docker/main GHCR 결과를 구분한다. 실제 기기·스크린리더는 별도 미검증이다.

### 승인된 UI 상태 설계

ui_ux 읽기 전용 검토를 바탕으로 결과가 사라지는 이유와 다음 행동을 같은 영역에서 알린다. 버튼은 `미리보기 계산`, 결과는 `미리보기 결과 — 현재 입력 기준`으로 표시한다.

| 상태 | 표시와 동작 |
| --- | --- |
| 최초 | 현재 입력의 미리보기를 계산할 수 있다는 안내 |
| 계산 중 | 이전 결과 숨김, 진행 안내, 기존 fieldset/버튼 잠금 유지 |
| 완료 | 요청 입력 fingerprint 및 revision이 현재와 일치할 때만 결과 표시 |
| 입력 변경/기준 revision 변경 | 이전 결과 숨김, 재계산 필요 안내, draft 보존 |
| 계산 실패 | 이전 결과 숨김, 실패와 재시도 안내, 기존 알림 보존 |
| 401/412 | 기존 재인증/충돌 및 canonical 재조회 처리 유지 |
| 저장 성공 | 미리보기 clear, canonical 재조회 및 저장 알림 유지 |

하나의 polite atomic 상태 영역으로 요약을 알리고 긴 결과 목록 전체를 live region으로 만들지 않는다. 완료/실패로 focus를 강제로 이동하지 않는다. request identity와 현재 입력/revision/unmount를 비교하여 늦은 성공·실패·finally가 더 최신 상태를 덮어쓰지 못하게 한다. SVAR API/PRO 기능은 추가하지 않는다. 공식 문서와 demo URL 확인은 실제 demo 조작 PASS와 구분한다.

## 로컬 확인 환경

기존 `mastergantt-app-1`은 `http://127.0.0.1:8299`에서 실행 중이다. infra가 Compose/volume을 확인하고 기존 데이터를 보존한 채 로컬 변경 이미지로 갱신한다. readiness와 실제 화면을 확인하며 로컬 실행을 정식 GHCR 게시 또는 운영 배포 완료로 보고하지 않는다.

## 완료 증거

원격 검증 결과는 각 Issue/PR에 실제 SHA/run/digest 근거로 기록한다. 아래 로컬 결과로 PR/main CI·GHCR PASS를 주장하지 않는다.

### #115 구현과 로컬 빠른 검증

- frontend 구현 및 DOCUMENTATION_SYNC 완료. `PROJECT_UX.md`, `TEST_PLAN.md` 갱신, API/DB/계산 계약은 변경 없음.
- `npm run typecheck`, 변경 component/spec 대상 ESLint, `git diff --check` PASS.
- 설치 Chromium 1208을 지정한 전용 `project-work-calendar-preview.spec.ts` 2/2 PASS(33.2초). KR→US 미리보기/저장, 미리보기 없이 저장, 모든 draft 입력, 실패/잘못된 응답/재시도, metadata 저장 후 unmount와 늦은 응답, 401/412, 키보드 포커스, 390/768/1024/1440 버튼 접근을 검사했다. 응답의 중첩 calendar revision 일치 및 If-Match 헤더 보존은 코드 검토와 구분한다.
- 최초 키보드 검사에서 비활성 버튼의 focus 손실을 발견해 현재 요청 종료 시에만 안전하게 복원하도록 수정했다. 독립 QA에서 지적한 늦은 저장 알림 및 테스트 KR/US 입력 흐름 불일치도 수정했다. 최종 독립 QA와 원격 CI는 별도 gate다.
- [변경 전](../../images/issue-115-before.png)은 KR 초기 설정(계산 전), [변경 후](../../images/issue-115-after.png)는 US 미리보기 완료 상태다. 같은 결함 순간의 쌍으로 오해하지 않도록 구분한다. 원래 결함 흐름은 Issue 재현 기록과 E2E로 검증한다.
- 같은 editor mount에서 revision prop만 변경하는 브라우저 경로는 없어 실제 E2E는 metadata 저장→revision 변경→설정 창 unmount를 검증했다. 순수 prop 변경 경계는 코드 검토와 구분하며 실제 모바일/스크린리더는 NOT TESTED다.
- PR #137 첫 head `76f7f415f7efe2ed178eddd79458cda983bee1b9`의 [run 35950170417](https://github.com/planner77/masterGantt/actions/runs/35950170417) attempt 1: quality/docker PASS, e2e FAIL(77 passed / 1 failed). 새 캘린더 live status와 기존 오류 toast를 `project-modal-feedback.spec.ts`의 광범위한 status locator가 동시에 선택했다. 기존 오류 알림 검증을 정확히 지정하도록 REWORK하며 접근성 status나 테스트를 제거하지 않는다. 후속 head에서 required gate 전체와 독립 QA를 다시 수행한다.
- REWORK의 첫 로컬 시도에서 전역 toast의 test id가 모달 안에는 없음을 확인해 FAIL했다. 실제 모달 내부 `div[role="status"][aria-atomic="true"]`를 지정하고 role·문구·가시성·알림함 회귀를 유지한 최종 대상 테스트는 1/1 PASS(4.2초), 해당 spec ESLint/diff 검사도 PASS다. 제품 코드와 기존 UX/테스트 계약은 바뀌지 않았다.
- 후속 head `f040519808840eba14cbddf02d7907a0289c6f9d`의 [run 35951130019](https://github.com/planner77/masterGantt/actions/runs/35951130019) attempt 1: quality/docker PASS, e2e FAIL(77 passed / 1 failed). 모달 알림 및 #115 신규 테스트는 PASS했지만 `project-notifications.spec.ts:39`에서 페이지 스크롤 0→1px와 전체 영역 y 좌표 -1px가 확인됐다. timeout은 아니며 원격 trace를 확보해 클릭 준비/스크롤과 알림 동작을 구분하는 원인 분석을 진행한다. 근거 없이 허용 오차를 늘리거나 실패를 retry로 숨기지 않는다.
- 원격 trace의 `call@2491`에서 milestone Add 클릭 직전 Playwright `scrolling into view if needed`가 실행됐고, action/after snapshot에 처음 document scroll top 1이 기록됐다. frontend와 Manager가 독립 확인했다. 알림 동작 전에 발생하는 클릭 준비 스크롤이 baseline에 섞인 것이므로 해당 대상에 명시적 scroll 준비를 마친 뒤 baseline을 잡는 최소 테스트 수정을 승인했다. 제품 CSS/코드를 바꾸거나 geometry 허용 오차를 추가하지 않고 실제 클릭과 이후 모든 strict geometry/인스턴스 검증을 유지한다.
- 해당 원격 trace를 qa_docs도 독립 확인했다. `project-notifications.spec.ts`에서 버튼 scroll 준비 → chart 내부 scroll 설정 → baseline → 실제 클릭 순서로 정리한 뒤, 대상 Chromium 테스트를 3회 반복해 3/3 PASS(14.5초)했다. 해당 spec ESLint와 diff 검사 PASS이며 제품/UX 계약 문서 수정은 N/A다. 후속 head의 required 원격 gate는 모두 새로 판정한다.
- 로컬 Docker는 `0.27.1`로 교체했고 기존 volume·8299 포트를 보존했다. SQLite integrity `ok`, 외래키 오류 0, 프로젝트 1개/작업 24개, migration 1~7을 확인했다. Manager 브라우저 확인에서도 읽기 전용 Gantt/24개 작업/문서 가로 overflow 없음/readiness 정상이다. 이미지 source tree `7ed0f9f22336f6b39121dbca22136fef367887c4`와 게시 tree는 문서 변경만 차이가 나며 runtime/package는 동일하다. 원격 E2E locator 수정은 runtime 변경이 아니다.
- 최종 PR head `5339d82ad569e36c42d0592df1d07fcaa21dd873`의 PR CI `35952444601`은 quality 615건/62파일, Chromium E2E 78/78, Docker HTTP·HTTPS/Compose/SQLite 영속성까지 PASS했다.
- PR #137은 merge commit 방식으로 병합되었고 실제 main merge SHA는 `692ed6dc51674e00eabb096a9ae46696b6b82cfd`다.
- main CI `35953411571`은 quality/e2e/docker/publish-commit-image 모두 PASS했으며 Chromium E2E 78/78을 재확인했다. 임시 GHCR `ci-692ed6dc51674e00eabb096a9ae46696b6b82cfd`의 exact digest `sha256:05989b6fa41d4c41d712c48b4f141dd2ac0c2c73067ae0f17151f47f467ef9ff`를 재다운로드하여 image policy/readiness/native SQLite/API 인증/restart persistence/HTTP·HTTPS smoke를 PASS했고 BuildKit SBOM/provenance 생성 및 임시 package version cleanup까지 확인했다.
- `PROJECT_UX.md`, `TEST_PLAN.md`, CHANGELOG/package version 및 이 실행계획 문서가 구현 결과와 동기화되어 DOCUMENTATION_SYNC를 완료한다. API/DB/스케줄링 계약은 변경하지 않아 별도 계약 문서 변경은 N/A다.
- 사용자 요청으로 Issue #115의 정식 GHCR 게시까지 승인되었으므로 `release_required=true`, `release_authorized=true`로 전환한다. 정식 SemVer tag/release image 검증과 안전한 branch cleanup, Issue 종료를 남은 단계로 수행한다.

### 선행 #120 및 로컬 데이터 보존 확인

- infra와 qa_docs가 별도로 확인한 #120 PR #135 head: `973ccab6d833b8035e5fcb138f5eeba507398474`. [PR run](https://github.com/planner77/masterGantt/actions/runs/35943339330) attempt 1의 quality/e2e/docker PASS.
- main `69fa36aac486bf81bd247595cc0ab2bfbbc8982a`의 [main run](https://github.com/planner77/masterGantt/actions/runs/35945670408) attempt 1에서 quality/e2e/docker와 publish job PASS.
- 임시 이미지 digest `sha256:add282cba2d3a3c5d20534408a0334fbeec71a241a33af7482f7557cf5bda3e4`의 exact pull/runtime/API/HTTP·HTTPS smoke, SBOM/provenance 생성과 임시 package version 삭제를 로그로 확인했다. GitHub 별도 Artifact Attestation은 이 증거와 구분한다.
- 정식 `v0.27.0` tag는 조회 시 없었다. #120의 기존 상태별 before/after 자료 및 병합 전 독립 QA 증거는 이번 감사에서 확인하지 못했다. 구현 dependency 재사용 PASS와 전체 Lifecycle 미완료를 구분한다.
- 로컬 Docker 교체 전 SQLite 일관 백업을 Git 밖 `/tmp`의 제한된 권한으로 보관했다. 별도 읽기 전용 검사에서 integrity `ok`, 외래키 오류 0, 프로젝트 1개/작업 24개, migration 1~6을 확인했다. 컨테이너 교체 후 같은 데이터 보존을 다시 확인한다.
