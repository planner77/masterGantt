# Issue #891 — 공통 Markdown 편집 도구와 편집창 크기

## 범위와 승인

- Issue: https://github.com/planner77/masterGantt/issues/891
- baseline/main: `9a98265ea7526feb2d589461146312e439206167`, application version `0.146.0`.
- 작업 branch/worktree: `feat/issue-891-mdx-editor`, `/home/planner/Dev/masterGantt-issue891`. 원래 작업공간의 변경은 보존한다.
- Owner는 분석·설계·구현·테스트·실패 원장·정식 GHCR 게시·Issue 종료를 요청했고, 충돌한 과거 지침 대신 최신 main의 로컬 검증·직접 Push·로컬 게시 정책을 명시 선택했다. Issue 본문의 등록 전용 상태는 이번 승인으로 구현 범위로 확장한다.
- publish_required=true, publish_authorized=true. 검증된 exact source의 `ghcr.io/planner77/mastergantt:sha-<full SHA>` 고유 태그와 digest smoke만 수행한다. SemVer/rolling alias·운영 배포는 변경하지 않는다. 최종 gate 완료 후 Manager의 수동 종료 위임이 있다.
- 신규 사용자 기능이므로 application version은 MINOR `0.147.0`으로 결정한다. package/lock의 version만 동기화하며 의존성 변경은 하지 않는다.
- qa_method=AGENT_LOCAL, qa_required=true. 제품 UI 위험은 MEDIUM이며 필요한 로컬 영향 매핑·게시 버전 경로를 포함한 최종 검증 범위는 HIGH로 관리한다. 권한·API·DB·일정 알고리즘 변경은 없다.
- PR/Actions/Trusted QA/Finalizer 신규 실행은 N/A(Owner 정책상 미사용). 사전 live 조회에서 Actions enabled=false, main ruleset24043042 deletion/non_fast_forward를 확인했다. Push 직전에 다시 조회한다.

## REUSE_REVIEW

REUSE_DECISION=EXTEND. Owner가 작성한 Issue #891의 구현 정책과 AC06은 기존 공통 `DescriptionField`, `@mdxeditor/editor@4.3.3`, 기존 Issue/Task 폼과 Playwright를 유지·확장하도록 명시한다. 별도 editor/새 저장 모델/중복 폼을 만들지 않는다. 기존 `verify-prepr`와 `publish-local-image`의 source admission·Build-once·exact digest smoke를 재사용한다.

기존 #885 원장의 원문 정규화·Tab/ShiftTab·toolbar locale·Source 및 실제 HTTP/SQLite 실패와 #869의 폼/keyboard geometry, #898의 산출물 sourceguard 경계를 검토했다. 과거 CI 정책 실패와 이번 제품 동작 검증은 구분한다. 기계 Regression Index는 전체 과거 이력 이관본이 아니므로 위 원장도 직접 검색했다. 이전 source PASS를 이번 source의 증거로 승계하지 않는다.

## 설계와 소유권

- Manager: Work Packet·버전·CHANGELOG·제품 문서·실패 원장/Regression Index·로컬 영향 매핑·통합 검사·Push/게시/종료. 공용 source와 최종 검증 시점을 조정한다.
- frontend891: `src/features/markdown/**`, Task/Issue host editor와 CSS, 기존 관련 unit/Playwright 및 고유 누락 케이스. 변경 전에 동일 fixture의 실제 Dialog 높이를 측정하고 합성 증거만 남긴다.
- ux891: read-only 설계와 구현 비교. native Task dialog top-layer와 tooltip portal, 본문 scroll owner·안전 상한을 확인한다.
- infra891: read-only 운영 준비·live 설정 조사. 이후 실제 운영 단계는 명시 위임 범위에서만 수행한다.
- 별도 qa_docs: 정확 source·AC·diff·문서·실제 결과의 독립 read-only 검토. 구현자 자체 검사를 독립 PASS로 기록하지 않는다.

툴팁은 공식 translation/tooltip API를 우선하고 설치 버전의 실제 keymap에 있는 키만 표시한다. 키가 없으면 현재 언어로 명시하며 native title 중복·overflow clipping을 피한다. locale 변경으로 editor/plugin을 remount하거나 source/selection/undo를 초기화하지 않는다.

전용 editor wrapper만 `resize: vertical; overflow: auto`를 갖고 폭은100%다. Rich/Source가 변경 높이를 사용하며 본문 최소11.5rem과 host의 안전 가용 높이를 지킨다. legacy plain/readonly는 명시 전환·원문 보존 정책을 유지한다. Dialog 전체 기본 높이는 동일 fixture의 기존 높이×1.5를 목표로 하되 기존 viewport 상한을 우선하며 실제 수치·제한 이유를 기록한다. 제목/닫기·Issue명·footer는 본문 스크롤과 분리한다.

## TEST_LIFECYCLE_REVIEW / AC_TEST_COVERAGE

기존 `project-issues.spec.ts`, `project-task-editor.spec.ts`, `project-task-editor-persistence.spec.ts`, `i18n.spec.ts` 및 Markdown 서버 안전성/형식 projection을 EXTEND/KEEP_UNIQUE한다. 관련 Task 삭제·관계·handoff·권한·If-Match·원문 length/AST·Gantt instance는 인접/음성 소비자로 유지한다. 고유 missing boundary에만 ADD하며 기존 assertions·timeout·retry·skip은 완화하지 않는다.

| AC | 실제 검증 계획 |
| --- | --- |
| AC01 | 설치4.3.3 toolbar 전수 hover/focus·현재 기능명/단축키·disabled/활성 trigger·native/fixed dialog clipping·실제 key 동작 |
| AC02 | KO→VI→EN→KO tooltip/aria 갱신, editor identity·selection/undo/source draft/mode와 저장 전 network write0 |
| AC03 | Rich/Source 실제 우하단 drag 증가/감소·min/max·폭 불변·scroll/toolbar/footer/focus 접근; plain 원문 보존 |
| AC04 | 신규/기존 Issue·Task/Summary/Milestone 단/장문 동일 fixture before/after px·ratio·cap 이유,5폭/낮은 화면/125%와 header/body/footer·문서 overflow |
| AC05 | 기존 HTTP/SQLite 저장·revision/권한·412·길이/AST/Source 오류·Tab/ShiftTab/Escape·Task→Issue→Task·dirty/stale/복구 및 Gantt instance 회귀 |
| AC06 | 기존 테스트 우선 확장, 공통 전체 Unit/Integration/build·관련 Chromium·Docker/runtime/SQLite·같은 clean source admission. 과거8shard/Required3는 신규 원격 실행 N/A |

로컬 영향 규칙에 공통 Markdown/Issue producer의 실제 소비자를 추가하되 UNKNOWN/missing/필수 gate 차단은 유지한다. full Unit/Integration은 `fast`, 영향 Chromium/unit은 `targeted`, 단일 OCI/runtime/API/SQLite는 `docker`, 같은 source 준비 판정은 `admit`로 분리한다. publisher까지 동일 직접 Node launcher/환경을 사용한다. 최종 실행 전 source/base·fixture/lock·환경을 고정하고 실행 중 소스를 변경하지 않는다.

공개 증거는 합성 fixture만 사용하며 screenshot/geometry는 `testInfo.outputPath`에 생성한다. #896 manifest와 #897 Owner 수동 UAT·실제 browser-chrome125%/AT/운영 장치는 실행한 범위와 미실행을 구분한다. 운영 배포·실운영 DB/backup/restore는 제품 표시 전용 변경이며 이번 요청 밖이다.

## DOCUMENTATION_SYNC

- UPDATED: CHANGELOG, DESIGN, TASK_EDITOR, PROJECT_ISSUES_USER_GUIDE, UI_UX_GUIDELINES, TEST_PLAN, 이 Work Packet, 단일 실패 원장/Regression Index, 현재 PLAN.
- LOCAL_PREPR: 기존 실행기 영향 매핑의 직접 소비자 확장만 기록한다. source/환경/admission 정책은 유지한다.
- AGENTS: N/A(기존 공통 역할·재사용·검증/게시 계약으로 구현하며 실행 지침 자체를 바꾸지 않는다).
- API/DB_SCHEMA/SECURITY/ARCHITECTURE/SCHEDULING_ENGINE/IMPORT_SCHEMA/VBA_EXPORT/DEPLOYMENT: N/A(표시·상호작용 변경이며 저장/서버/원문/안전성·배포 계약 변경 없음).
- CI_CD/GITHUB_OPERATIONS/REMOTE_VALIDATION: N/A(기존 Owner 로컬 게시 계약을 적용하고 workflow/권한/Ruleset/원격 실행을 변경하지 않는다).

## 실행 결과와 남은 gate

초기 의존성 준비 `npm ci` exit0,711packages 설치. 설치가 보고한11vulnerabilities(9moderate/2high)는 기존 lock의 현황이며 의존성 자동수정은 하지 않았다. 공식 로컬 gate·독립 QA·Push·게시·FINAL은 아직 NOT TESTED다. 실제 실패와 후속 재시험은 [단일 원장](../../ISSUE_891_FAILURE_ANALYSIS.md)에 append하고 정확 source·report·시각·exit/count에 연결한다.

## 변경 전 실제 높이 기준

동일 합성10종×1440폭/900·1200·1600높이30측정(run6 exit0)의 Task높이는810/896/896px·폭1120px, Issue높이는792/864/864px·폭736px다. Editor/host/CSS는9a98265e bytes이며 version/docs는0.147.0 WIP로 clean전체source가 아닌 SCOPED baseline이다. baseline JSON SHA256 `f6902c0b60dafdbd8177d0e8458c9217d8212d66495102e876b536991d872ec7`. 최초6준비실패와교정은원장에보존했다.

기존88~90viewport안전상한을유지하면서rem상한54/56을81/84로조정하고실제height를설정한다.1600높이에서는Issue864→1296·Task896→1344px의1.5×를목표로하며900높이에서는기존viewportcap때문에792/810px를유지한다. after실제측정과최종gate는아직NOT TESTED다.

## 1차 구현 후 geometry 빠른 검증(SCOPED)

동일합성fixture30측정의실제after exit0에서폭1120/736px는불변이었다. 높이900에서는Task810→810/Issue792→792(기존90/88dvh상한),1200에서는Task896→1080(1.205357×)/Issue864→1056(1.222222×,각viewport상한),1600에서는전10종Task896→1344/Issue864→1296으로정확1.5×다. 실제height와max-height를함께설정했으며상한만높인변경이아니다. 이WIP결과는최종clean source의전체gate/QA/GHCR을대체하지않는다.

30건의 실측은[합성 geometry 기록](../../evidence/issue-891/dialog-height-observations.json)에 source 경계·원본JSON hash·before/after/비율·상한 이유와 함께 보존한다.

## 공개 toolbar adapter의 범위

native disabled 도구의 keyboard 설명을 제공하기 위해 기존 공통 MDXEditor와 plugin/state/translation은 유지하고 공개 ButtonWithTooltip·Gurx/Lexical command/state로 필요한 action만 감싼다. readOnly/canUndo/canRedo/table/list 조건에서 명령을 차단하고 새로운 hotkey는 등록하지 않는다. 직접사용하는 설치/lock 버전은 Gurx1.2.4·Lexical/history/extension0.48.0이며 dependency 변경/deep import는 없다. 비활성 click/Enter/Space의 원문/명령/쓰기0와 활성전환·history를 실제검증한다.

## 위험도 확정

`risk_level: HIGH`, `qa_method: AGENT_LOCAL`, `qa_required: true`. 공통 editor의 tooltip/focus·Rich/Source height·history/list/table command adapter와 로컬 영향 선정 도구·버전 경로가 최종범위에 포함된다. API/DB/auth 계약은 불변이지만 초기 MEDIUM 제품UI 분류보다 검토범위가 넓어 HIGH로 관리한다. 새 source의 공통/영향/컨테이너 gate와 실제 독립 Reviewer를 모두 확인한 뒤 게시 범위 Manager 판정을 기록한다.

## resizer의 본문 가용 높이

Task/Issue의 기존 스크롤 본문에 marker를 두고 ResizeObserver로 현재 clientHeight를 관측한다. 최대 높이는 host본문 clientHeight-12px·60dvh·40rem 중 작은 값으로 제한하되 최소15rem을 우선해 기존 본문11.5rem 이상을 보존한다. 극히 낮은 화면에서 최소편집영역이 host본문보다 크면 기존 외부 본문 스크롤로 편집기/다른 필드에 도달하며 제목·footer는 고정한다. 크기조절은 원문/DB/API 상태를 저장하지 않는다.
