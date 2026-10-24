# Issue #798 — 동적 대시보드 제어 영역 밀도

## Issue Work Packet

- repository: `planner77/masterGantt`
- issue: [#798](https://github.com/planner77/masterGantt/issues/798)
- lifecycle_phase: PR_READY (동결 tree의 독립 PRE_QA 후 PR_CI_STARTED 인계)
- 승인 범위: 분석·계획·구현·관련 문서 갱신·Ready PR Full CI 시작까지. 완료 모니터링·병합·Main/GHCR·정식 릴리스·브랜치 정리·Issue 종료는 제외한다.
- baseline/main: `8d9dd93a9305ebc66ef1fb3784c9788c3e2ece24`
- branch/worktree: `feat/issue-798-dashboard-density`, `/home/planner/Dev/masterGantt-798`
- existing_pr: 착수 시 없음. 게시 이후 정확 Head와 CI 등록은 Issue STATUS에 기록한다.
- current_version/version_decision: `0.132.0` / keep. 기존 제어의 배치를 개선하며 버전·의존성은 변경하지 않는다.
- release_required: false (이번 승인 범위는 PR CI 시작까지)
- release_authorized: false (정식 게시 승인 없음)
- risk_level: HIGH
- risk_reason: 다섯 관점이 공유하는 disclosure와 필터·초안·focus·탭 복귀의 교차 회귀 위험. 조회/편집 비동기·snapshot 잠금은 기존 계약을 유지한다.
- qa_required: true
- qa_method: AGENT
- qa_review_mode/reviewer: 독립 `qa_docs /root/density_qa`의 코드·테스트·문서·최종 관측·브라우저 경계 사전 검토. 최종 tree와 대조하며 공식 원격 QA_FINAL은 NOT TESTED.
- manager_decision: NOT TESTED; MERGE_READY=BLOCKED
- issue_comment_writer: manager; issue_comment_allowed_types: PLAN,STATUS,EXCEPTION

## 목표와 경계

`DESIGN.md`의 Workspace-first·Compact controls·Progressive disclosure와 KPI 내부 참조를 다섯 동적 관점의 제어 영역에 구체화한다. KPI의 기존 UI와 관점별 구성 참고/필터된 실제 작업/전체 Milestone Gate·개인 Plan/Excel의 의미는 보존한다. #799의 지표·요약 재설계, #800의 상시 전체 화면 기준선 확대, API/DB/계산 엔진·권한·Gantt Core 변경은 제외한다.

선행 #797의 [PR #801](https://github.com/planner77/masterGantt/pull/801) 감사 문서·관측 방법을 참조한다. 해당 감사는 아직 main 미병합이며 27/30 dashboard 관측의 PARTIAL 상태를 새 PASS로 재사용하지 않는다. 이번 baseline은 동일 main source에서 같은 fixture로 KPI+5관점×5폭을 새로 측정한다.

## 담당·파일 소유권

| 담당 | 소유권 |
| --- | --- |
| Manager | 계획·버전/범위·Issue 기록, 본 Work Packet·PROJECT_UX·UI_UX_GUIDELINES·TEST_PLAN·PLAN·CHANGELOG와 증거 설명 |
| ui_ux `/root/density_design` | read-only 설계·기존 감사 비교; 코드/문서/GitHub 쓰기 없음 |
| frontend `/root/density_frontend` | `src/features/resources/wbs-view*`, 필요한 consumer 제어, 기존 E2E 확장, `tests/manual/issue-798-dashboard-density.mjs`, `output/playwright/issue-798/**` 단일 writer |
| qa_docs | 구현자와 분리된 read-only 사전 AC/code/test/docs/브라우저 증거 검토 |
| infra `/root/density_publish` | 최종 gate 이후 동일 tree 게시·canonical Ready PR·정확 Head Full CI 등록 확인; 모니터링 없음 |

동일 파일 동시 작성·재귀 위임·Sub-Agent 직접 Issue 댓글은 허용하지 않는다. 기존 작업 트리의 사용자 미추적 자료는 별도 worktree로 격리했다.

## 구현 전 설계

```text
[관점명] [현재 적용 경로]                         [도움말]
[작업 검색] [상태] [시작일/종료일] [필터·조회 구성] [새로고침]
[적용 조건 수·실제 값·정렬·System 범위/선택·초기화]
(펼친 경우) 표 이름 찾기 / 정렬 / 관점 조건 / 기존 조회 구성
[오류·pending·이전 결과 / 조회 기간·기준일]
[기존 구성/작업 요약·계층 표·상세]
```

- 작업 검색(서버 모집단)과 표 이름 찾기(표시만)는 합치지 않는다. 이름 찾기가 활성화되면 접힌 상태에서도 검색값과 서버 고유 총계 유지 의미를 표시한다.
- disclosure 자체를 열고 닫는 행위는 적용 조건·조회 spec·selection·scroll·원본 데이터를 바꾸지 않는다. 기존 composer와 System 속성 초안은 mounted 상태를 유지한다.
- 접힌 고급 조건은 활성 수·적용값·명시 초기화/재진입을 제공한다. 고급 조건 초기화는 빠른 조건·하위 축·접힘/scroll을 보존하고 고급 필터·표 이름 찾기·역순·System 선택/조율 및 상세 선택을 해제한다. 구성기의 조회 초기화는 기존 전체 설정 초기화다. System 직접/조율·전체/선택0식과 기본/역순 정렬을 식별한다. IDs-only 저장 설정과 선택0식은 direct로, System mode/IDs가 모두 없는 경우만 legacy로 표시한다. 새 고급 초기화는 선택/조율 해제 시 기본 direct를 명시하며, 진짜 legacy의 검색/정렬 초기화에서는 legacy를 유지한다. 기존 System 전용 초기화는 변경하지 않는다.
- native button/label/select/date와 44px 의미상 hit target을 유지한다. Escape는 열린 최내측 disclosure부터 닫고 연결된 가시 trigger로 focus를 복원한다. 숨은 제어로 focus하지 않는다.
- 390px에서는 의미별 wrap/기간 묶음의 폭을 조정한다. 긴 이름·오류·focus를 고정 높이로 자르지 않고 표가 내부 scroll을 소유한다.

| 상태 | 유지할 동작 |
| --- | --- |
| default / readonly | 핵심 조회는 접근 가능, 원본 변경은 기존 권한 적용 |
| advanced open/closed | 적용 조건·초안 보존, 열기/닫기만으로 mutation/조회 변경 없음 |
| invalid period / error | 인접 오류와 복구 경로 상시 표시 |
| pending / stale / 이전 응답 | 기존 generation/AbortSignal·snapshot 잠금·이전 결과 표시 보존 |
| dirty / 401 / 412 | 기존 host/editor의 잠금·초안·명시 복구 계약 보존 |
| view/root 전환·일정 복귀 | 관점별 spec/filter/선택/확장/scroll/focus와 같은 원본 유지 |

## AC_TEST_COVERAGE

- AC1: 동일 fixture의 KPI+5관점×5폭 before/after 수집기로 첫 데이터·표·wrap·가시 행·상태를 측정하고 source hash와 연결한다. 실제 관측·실행과 미검증은 아래 최종 로컬 증거를 따른다.
- AC2: 공통 header/빠른 toolbar/고급 disclosure 및 활성 적용값·초기화 표시를 기존 composer 회귀에 확장한다. 실제 관측·실행과 미검증은 아래 최종 로컬 증거를 따른다.
- AC3: 기존 #730/consumer E2E의 실제 Chromium keyboard·focus·5폭 geometry와 긴 이름·내부 scroll을 검증한다. 실제 관측·실행과 미검증은 아래 최종 로컬 증거를 따른다.
- AC4: 수집기의 같은 spec/filter report snapshot/totals·canonical fingerprint·mutation0 및 기존 정확 원본/Plan/Gate 회귀를 대조한다. 실제 관측·실행과 미검증은 아래 최종 로컬 증거를 따른다.
- AC5: 아래 TEST_LIFECYCLE_REVIEW의 기존 테스트 검색과 EXTEND/KEEP_UNIQUE 및 중복 spec 추가 없음으로 연결한다.
- AC6: 아래 DOCUMENTATION_SYNC·source-anchored PNG/JSON·Ready PR Full CI 등록과 별도 최종 QA 미실행 상태를 기록한다.

| AC | 구현·검증 연결 | 현재 상태 |
| --- | --- | --- |
| AC1 | 동일 fixture KPI+5관점 before 390/768/1024/1440/1920 geometry·screenshot, header/toolbar/구성/첫 지표·표Y·행/지표·wrap 측정 | 아래 실제 로컬 증거 참조; 원격 NOT TESTED |
| AC2 | shared header/toolbar/disclosure, 접힌 활성 조건·범위·초기화·원본 의미; 기존 composer 재사용 | 아래 실제 로컬 증거 참조; 원격 NOT TESTED |
| AC3 | 실제 Chromium 5폭, label·Tab/Enter/Space/Escape·focus 복귀·긴 이름/날짜·내부 scroll/document overflow | 아래 실제 로컬 증거 참조; 원격 NOT TESTED |
| AC4 | 동일 spec/filter의 report snapshot·raw Task/Assignment·구성/공수/Gate·root/축/정렬/복귀·조회 mutation0 비교; 기존 consumer 회귀 | 아래 실제 로컬 증거 참조; 원격 NOT TESTED |
| AC5 | 기존 `issue-730-view-composer.spec.ts`, #732~#736 및 `cross-screen-regression.spec.ts` 검색·EXTEND/KEEP_UNIQUE, 중복/폐기 없음 | EXTEND/KEEP_UNIQUE; 삭제/폐기 없음 |
| AC6 | source-anchored before/after evidence·관련 문서·Design Delta B 및 별도 PR CI/QA gate | 아래 실제 로컬 증거 참조; 원격 NOT TESTED |

## TEST_LIFECYCLE_REVIEW

- EXTEND: `issue-730-view-composer.spec.ts`의 공통 조회 구성·keyboard/focus·상태 보존에 disclosure 재진입/초기화·적용값 의미를 추가한다.
- EXTEND: #732~#736 소비자 테스트와 사용하는 공유 helper의 진입 순서를 새 배치에 맞춘다. 고유 원본/Gate/공수/Plan/Excel·보안·stale/dirty 단언을 축소하지 않는다.
- KEEP_UNIQUE: `cross-screen-regression.spec.ts`의 기존 화면 geometry/focus·내부 scroll 계약, 그 외 consumer의 고유 업무·서버 보안·SQLite/경합 회귀를 보존한다.
- ADD(수동 관측 도구): #797 관측 방법을 이슈 범위에 한정 재사용한다. 자동 E2E 중복 spec을 만들지 않는다.
- 테스트 삭제/skip/retry/timeout·현재 8-shard/Required3/Trusted QA·Ruleset 변경 없음. 전체 로컬 suite는 공식 회귀의 대체가 아니다.

## DOCUMENTATION_SYNC

- `docs/exec-plans/active/ISSUE_798.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/UI_UX_GUIDELINES.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `docs/ISSUE_798_FAILURE_ANALYSIS.md`: UPDATED
- `DESIGN.md`: N/A(Delta B로 기존 밀도·점진적 노출 원칙을 구체화하며 새 전역 설계 원칙을 채택하지 않음)
- `docs/SCHEDULING_ENGINE.md`: N/A(Milestone 증거·기존 소비자 테스트 경로 포함이나 일정 알고리즘과 전체 Gate 계산은 변경하지 않음)
- `docs/API.md`: N/A(공개 요청과 응답 스키마 및 서버 권한·조회 계약을 변경하지 않음)
- `docs/DB_SCHEMA.md`: N/A(DB 저장·migration·원본 Task 및 Assignment 생성 수정 계약을 변경하지 않음)
- `docs/IMPORT_EXPORT.md`: N/A(기존 교환 테스트의 조회 구성 진입만 조정하며 파일 형식과 원장 교환 계약은 변경하지 않음)
- `docs/IMPORT_SCHEMA.md`: N/A(가져오기 schema와 원자 저장 계약을 변경하지 않음)
- `docs/EXCEL_EXPORT.md`: N/A(리소스 개인 Plan과 Excel 출력 산식·원본 범위 및 권한을 변경하지 않음)

| 문서 | 판정·근거 |
| --- | --- |
| `docs/exec-plans/active/ISSUE_798.md` | UPDATED — 범위·설계·AC/테스트·실측·handoff |
| `docs/PROJECT_UX.md` | UPDATED — 다섯 관점의 빠른/고급 조건·초안/복귀 계약 |
| `docs/UI_UX_GUIDELINES.md` | UPDATED — disclosure 접근성·반응형·활성값 표시 |
| `docs/TEST_PLAN.md` | UPDATED — EXTEND/KEEP_UNIQUE와 실제/미실행 검증 분리 |
| `docs/exec-plans/active/PLAN.md` | UPDATED — #797→#798→#799/#800 순서·현재 종료점 |
| `docs/TARGET_RESOURCE_USER_GUIDE.md` | UPDATED — 사용자의 필터/조회 설정·초안·초기화 안내 |
| `CHANGELOG.md` | UPDATED — unreleased UI 변경 |
| `docs/ISSUE_798_FAILURE_ANALYSIS.md` | UPDATED — 최초 로컬 선택7의4 PASS/3 FAIL 및 테스트 보완·중간 관측 원장 |
| `DESIGN.md` | N/A — Delta B, 기존 Workspace-first·Compact controls·Progressive disclosure·내부 KPI 참조의 구체화. 새 전역 원칙 채택 없음 |
| `docs/REQUIREMENTS.md` / `docs/ARCHITECTURE.md` | N/A — 기존 5관점/공통 renderer·원본·계산·저장 경계 불변. UX 세부는 PROJECT_UX에 기록 |
| `docs/API.md` / `docs/DB_SCHEMA.md` / `docs/SECURITY.md` | N/A — 공개 wire·schema/migration·서버 권한·Origin/session/revision 변경 없음 |
| `docs/SCHEDULING_ENGINE.md` / Import/Excel 계약 | N/A — 계산 알고리즘/교환·개인 Plan/Excel 산식·권한 변경 없음 |
| CI/CD·REMOTE_VALIDATION·GITHUB_OPERATIONS·QA 정책·AGENTS·배포 문서 | N/A — 기존 required gate·8-shard·신뢰 출처·권한·릴리스/배포 정책을 적용하며 변경 없음 |

## 검증·인계

- Local Fast Feedback: `npm ci` PASS; `npm audit --omit=dev --json` production 취약점 0. 전체 install 안내의 dev 포함 2 moderate/2 high는 별도이며 의존성 변경 범위가 아니다.
- Chromium before/after: 최종 source의30쌍 관측·동등성 PASS(아래 증거 범위). 최종 TypeScript·선택 ESLint·모델/전송 Unit16·선택 Chromium4 PASS. 정확한 명령·source 지문과 결과는 아래 실행 영수증을 따른다.
- 원격 quality/e2e/docker·Trusted QA·독립 QA_FINAL·Manager ACCEPT: NOT TESTED. 사전 검토는 원격 최종 QA가 아니다.
- 실제 터치 기기·screen reader·native browser zoom·Windows Excel/DRM·production TLS/운영 DB·배포: NOT TESTED, 이번 로컬 Chromium 증거로 대체하지 않는다.
- 다음 담당: frontend 구현/실측 → Manager DOC_SYNC → qa_docs 독립 PRE_QA → infra Ready PR Full CI 시작 확인 → Manager STATUS 인계.

## 최종 로컬 증거 — 기본 조회의 전후 비교

[비교 JSON](../../../output/playwright/issue-798/comparison.json), [before manifest](../../../output/playwright/issue-798/before/dashboards-manifest.json), [after manifest](../../../output/playwright/issue-798/after/dashboards-manifest.json)을 연결한다. 각 manifest의 JSON과 full/viewport PNG는 같은 source·fixture·실제 viewport와 연결된다. 수집기는 두 번 모두 SHA256 `99d4fde139d38648078b90baea1a061275697bc2148b13cf2b76d6b22888e626`이며 각 실행 시작/끝 지문 불변을 검사했다.

실제 환경은 Node22·Next16.4.2·Playwright1.63.0·Chromium, `ko-KR` / `Asia/Seoul`·DPR1·높이900px의 격리 loopback HTTP/SQLite dev webpack이다. `after` 캡처 당시 checkout HEAD는 baseline과 같지만 제품 변경은 미커밋 working tree였다. 따라서 baseline SHA를 after 제품 source라고 표시하지 않고 비교 JSON의 세 `afterSourceHashes`로 실제 캡처 source를 고정한다. 게시 commit/tree는 이 지문과 별도로 확인한다.

- before30/30·after30/30, faults0; 25개 동적 관점 조합의 첫 요약/표 위치 개선, KPI5개 조합 geometry KEEP.
- 60개 관측 모두 document overflow0. 정상 데이터와 기존 전체 지표/행 개수는 유지한다. 기본 조회에서 고급 조건이 없는 상태의 비교이며 필터가 적용된 모든 조합의 pixel 동등성을 주장하지 않는다.
- 같은 25개 동적 조회의 snapshot/spec/filters/totals 일치. 원본 canonical revision17·Task4·Assignment1, fingerprint `d1d06a5717d536e1353954660d2758be859f01e2250a8a64845b0ba97fa04779`와 mutation0 유지.
- [보조 before 영수증](../../../output/playwright/issue-798/before-supplemental-reports.json)과 [보조 after 영수증](../../../output/playwright/issue-798/after-supplemental-reports.json)은 다섯 기본 spec의 raw Task/Assignment ID·전체 Milestone Gate·구성·totals·metadata 일치를 보완한다. before 보조 영수증은 표시 코드 변경 이후 **변경되지 않은 backend**에서 원래 before snapshot을 재조회한 자료이며 원래 브라우저 payload 캡처와 구별한다. 변경되지 않은 backend 파일 지문 및 원래 snapshot 일치를 함께 확인한다.

아래는 첫 계층 표의 Y(before→after), 단위 CSS px이다. 행이 900px viewport 안에 반드시 들어온다는 목표나 전체 화면 개선 PASS로 확대하지 않는다.

| 관점 | 390 | 768 | 1024 | 1440 | 1920 |
| --- | --- | --- | --- | --- | --- |
| KPI (KEEP) | 1793.39→1793.39 | 1720.39→1720.39 | 1089.39→1089.39 | 834.39→834.39 | 834.39→834.39 |
| Milestone | 1283→1177 | 954→847 | 906→799 | 762→655 | 762→655 |
| 공정&WorkArea | 1676.39→1570.39 | 1283.39→1176.39 | 1150.39→1043.39 | 1006.39→899.39 | 1006.39→899.39 |
| 설비 | 1616.39→1363.39 | 1181.39→948.39 | 1112.39→900.39 | 947.39→735.39 | 947.39→735.39 |
| 물류 시스템 | 1697.39→1404.39 | 1337.39→1095.39 | 1225.39→983.39 | 1145.39→903.39 | 1145.39→903.39 |
| 리소스 | 1943→1673 | 1376→1185 | 1307→1116 | 1142→951 | 1142→951 |

1440×900에서 완전히 보이는 지표와 표 데이터 행은 다음과 같다. `valueCount`는 해당 동적 조회의 기본 노출 `dl dd`에서 수집한 기존 수치 항목이며 업무 KPI 수를 새로 정의한 값이 아니다. rowCount는 캡처 당시 펼침 상태의 데이터 행이다.

| 관점 | 완전히 보이는 지표 / 전체 (before→after) | 완전히 보이는 행 / 전체 (before→after) |
| --- | --- | --- |
| KPI (KEEP) | 4/4→4/4 | 0/1→0/1 |
| Milestone | 9/9→9/9 | 1/2→2/2 |
| 공정&WorkArea | 14/14→14/14 | 0/3→0/3 |
| 설비 | 4/12→12/12 | 0/3→1/3 |
| 물류 시스템 | 4/11→11/11 | 0/1→0/1 |
| 리소스 | 14/14→14/14 | 0/2→0/2 |

25조합의 첫 요약/표 이동은 106~293px다. 390px의 visible filter label 행은 기존4→3이며 각 필드의44px control 높이는 유지한다. 이 값은 action-only 행을 제외한 label 행 수이며 전체 toolbar 행 수와 다르다. 작은 화면의 첫 표·일부 요약은 여전히 fold 아래에 있고 #799의 요약 영역 개선 범위와 분리한다.

대표 화면: [설비1440 before](../../../output/playwright/issue-798/before/equipment-1440-viewport.png) / [after](../../../output/playwright/issue-798/after/equipment-1440-viewport.png), [Milestone390 before](../../../output/playwright/issue-798/before/milestone-390-viewport.png) / [after](../../../output/playwright/issue-798/after/milestone-390-viewport.png).

### 중간 후보·수집 오류 보존

- [after intermediate1](../../../output/playwright/issue-798/after-intermediate-1/SUPERSEDED.json)은 모바일 도움말의 단독 행을 발견하기 전 완결 JSON15개 관측이다. 마지막 미완결 캡처는 최종 표본에 포함하지 않는다. 안전하게 수집을 중단하고 해당 후보를 SUPERSEDED로 보존한 뒤 CSS를 보완해 최종30개를 새로 수집했다. 최종 Milestone390 첫 요약875→769px(106px 개선), 중간801px 대비32px 개선이다. 중간 후보와 최종 관측을 합산하지 않는다.
- before 보조 report 수집의 첫 시도 오류는 [원문](../../../output/playwright/issue-798/before-supplemental-attempt1-error.txt)에 보존한다. 원인은 브라우저 run-code sandbox에서 파일을 읽으려던 `ReferenceError: require is not defined`다. 이후 호스트에서 읽은 합성 query 입력을 literal로 전달해 같은 읽기 영수증을 수집했으며 원래 브라우저 before30/30은 별도 성공한 관측이다. 실패를 소급 PASS로 변경하지 않는다.
- 실제 터치 기기·screen reader·native browser zoom·운영 TLS/production build·Windows Excel/DRM 검증은 NOT TESTED다. 이후 Chromium hasTouch 에뮬레이션과 물리 기기 PASS는 구별한다.

## 독립 공통 제어 검토와 최종 source

실제 분리된 `qa_docs /root/density_qa`의 [read-only Chromium 영수증](../../../output/playwright/issue-798/independent-common-edges.json)은 최초 고급 초기화 focus FAIL과 보완한 최종 source의6경계 PASS를 구별한다. 열린/접힌 설정의 mounted 상태·이름 찾기/정렬·조회0, 초기화 Enter 후 지속 trigger focus, invalid 기간 오류·빠른 조건 보존, IDs-only1식/0식 복원과 새 기본 direct 초기화, 진짜 legacy의 검색/정렬 초기화 후 범위 보존, 잘못된 저장 설정 경고·기본 복구를 확인했다. canonical revision17·전후 data 동등·Project mutation0이며 read-only POST11건을 업무 mutation과 구별한다.

최종 제품 source는 다음 SHA256으로 고정하며 마지막 after30·영향 선택 회귀·게시 tree의 bytes와 대조한다.

- `src/features/resources/wbs-view-dashboard.tsx`: `6b4e974f952375349cd0056bda1706d4eda53b25a153fb2a9c6f4345a98bf158`
- `src/features/resources/wbs-view-composer.tsx`: `9486fa288829255cb95337838831b07b13d83b1c7dbad410bac69d7b0a39035b`
- `src/features/resources/wbs-view.module.css`: `83749e2a01011e7caabf789164317eab91d8fb84fd6c9daacbd1b477fab14d05`

[source1 after30](../../../output/playwright/issue-798/after-source1/SUPERSEDED.json)와 [source2 after30](../../../output/playwright/issue-798/after-source2/SUPERSEDED.json)은 독립 검토의 범위 문구·초기화 focus 보완 이전 후보다. source1의 선택7/7 PASS는 그 후보의 역사적 증거이며 최종 source의 PASS로 전용하지 않는다. [누적 실패·관측 원장](../../ISSUE_798_FAILURE_ANALYSIS.md)에 실제 오류와 범위·재검증을 기록한다. 마지막 source의 검증과 DOC_SYNC/독립 PRE_QA를 완료한 뒤 infra가 동일 tree를 게시한다.

## 최종 Local Fast Feedback와 게시 인계

[로컬 실행 영수증](../../../output/playwright/issue-798/local-validation.json), [최종 Chromium4](../../../output/playwright/issue-798/local-chromium-source3.json), [선택 시작 source 지문](../../../output/playwright/issue-798/source3-validation-start.json)을 연결한다. 최종 제품/관련 테스트 지문은 선택4 실행 시작부터 끝까지 같고 앞의 after30·독립6경계의 제품 지문과 일치한다.

- `npx tsc --noEmit`: PASS.
- 제품/변경 테스트/helper/manual collector의 선택 ESLint: PASS, errors0.
- 기존 model/transport/resource consumer model의3파일16개 Unit: PASS.
- 실제 HTTP/SQLite Chromium 선택4개: PASS4/4, retry0·skip0·flaky0,2.8분. 신규 #798의5관점×5폭·keyboard/44px/초안/초기화/터치 에뮬레이션·조회 불변42.6초, #735 직접/조율·초안21.6초, #735 legacy/IDs-only0/1·새 기본 direct 초기화24.4초, #736 개인 Plan/Excel/정확 Assignment21.1초다.
- source1의 이전 선택7/7 PASS(5.0분)와 최초4 PASS/3 FAIL은 각자의 source/원장에 보존한다. source2/3의 변경은 System 범위·새 초기화 focus에 한정됐고 영향을 받는 #798/#735/#736을 최종 source에서 다시 실행했다. #732/#733/#734 기존 업무 회귀의 source1 결과를 최종 PR Full CI 결과로 전용하지 않는다.
- `python3 tests/manual/issue-798-compare.py`: PASS,30쌍 snapshot·수치·KPI KEEP·문서 overflow0·지표/행 수 동등 및 첫 요약/표 위치 개선을 실제 assertion으로 확인한다.
- `npm run version:check`, Markdown 링크·`git diff --check`·DOC_SYNC 구조는 Manager가 최종 동결 전 확인한다. 버전/lock과 생성 AGENTS/next-env/tsconfig 변경은 게시하지 않는다.
- Pre-PR targeted `--dry-run`의 계획·UNKNOWN/NOT TESTED·sourceStable 판정은 별도 정제 영수증과 실행 결과를 따른다. dry-run은 테스트 실행이나 공식 CI PASS가 아니다. CLI 매핑을 임의 수정하거나 더 큰 로컬 전체 suite로 gate를 대체하지 않는다.

제품 source와 관련 테스트의 실제 실행을 완료했고 문서·증거를 동기화했다. 독립 PRE_QA는 동일 최종 tree/source의 사전 검토로만 기록한다. 게시 후 exact PR Head/base/test merge·CI run/attempt 및 실제 등록 상태는 Issue STATUS에 남긴다. 원격 Quality/E2E8/Docker·Trusted QA·QA_FINAL·Manager ACCEPT는 NOT TESTED이며 본 PR을 병합 준비 완료로 표시하지 않는다. 사용자가 요청한 경계 이후 모니터링·병합·Main/GHCR·Release·브랜치 정리·Issue 종료는 수행하지 않는다.

### Pre-PR 계획 검증의 실제 결과

[정제 영수증](../../../output/playwright/issue-798/prepr-targeted-dry-run.json): `npm run verify:prepr -- --mode=targeted --base=origin/main --issue=798 --risk=HIGH --dry-run`, exit0·overall NOT TESTED·selection BLOCKED·selected16·UNKNOWN3·missing0·steps0·sourceStable=true다. UNKNOWN은 새 공통 E2E helper·수동 collector·수동 compare의 자동 producer→consumer 매핑 미등록3건이며 매핑/정책을 임의 수정하지 않았다. 이들의 수동 검증은 위 최종 Unit16/Chromium4·30쌍 비교·명시적인 테스트 매핑으로 별도 기록했다.

원본 `report.json`과 `SUMMARY.md`는 Git에서 제외된 `.prepr-reports/2026-10-24T23-05-16.554Z-1419127-aefcfdd7/`에 있다. 계획 checkpoint의 working fingerprint는 `294c2e57f21d23b530e16421407315adb601c95c35bbbc76c57b1c2f98fa8aff`로 시작/끝이 같다. 이 결과 문단과 정제 영수증은 계획 실행 뒤 문서/증거로 추가했고 검증한 제품·테스트 bytes는 변경하지 않았다. fingerprint를 최종 게시 tree SHA와 혼동하거나 dry-run을 로컬/원격 테스트 PASS로 사용하지 않는다.
