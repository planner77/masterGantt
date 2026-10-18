# Issue #727 — 프로젝트 리소스 등록과 Task 배정 분리

## Work Packet

- Issue: [#727](https://github.com/planner77/masterGantt/issues/727), 상위 #723. 직접 선행 #724/PR #738.
- baseline: main `7393483c4a15007868fceeaee70fb9e13c8b119a`; 선행 공개 host `23857b6f3b3481a8402c6c421de2f7ff82304fe2`.
- publication_base: main `ea4194763568432ef98e823bb796b59a5beb317c` (#724/PR #738 병합 후).
- main_alignment: `4ce564a8d9ec646ba584a585a610537f14698476` (#725 포함, source merge 부모); #727 migration은 적용된 0028_process_context 다음 0029로 신규 추가.
- working_branch: `feat/issue-727-project-resource-membership`.
- lifecycle_phase: PR_READY. 구현·문서·선정 Local Fast Feedback·별도 사전 검토 후 PR Full CI 시작까지 진행한다.
- version_decision: main 0.118.0(#725)에 이어 MINOR0.119.0. 새 프로젝트 참여 원장/API/등록 UI를 제공한다.
- risk_level: HIGH. 새 관계·권한/동시성·사용중 보호 및 Copy/Template·교환 보존에 교차 영향.
- qa_required: true.
- qa_method: OWNER_MANAGED. 분리된 Agent 사전 검토는 Owner 병합 승인·원격 Trusted QA·독립 인간 승인과 다르다.
- release_required: true.
- release_authorized: false.
- manager_decision: NOT TESTED. 원격 quality/e2e/docker 및 Trusted QA는 새 정확 Head의 실제 증거 전 NOT TESTED다.

사용자는 구현·문서 반영 후 PR CI 시작까지만 요청했다. CI 결과 모니터링·병합·main/GHCR·tag·Release·cleanup·Issue 종료는 수행하지 않는다. 현재 정책은 PR base=main을 요구한다. 착수 시 미병합이었던 선행 #724/PR #738은 게시 직전 main `ea4194763568432ef98e823bb796b59a5beb317c`에 병합된 것을 인증 API와 git fetch로 확인했다. 이전 선행 Head23857b6f와 새 main의 전체 tree가 같아 코드 bytes 변경 없이 fast-forward했고 PR diff는 #727에 한정한다. 별도 stacked base로 Preflight를 우회하지 않는다. 이 조회는 #724/main CI 결과 모니터링이 아니다.

## 범위와 역할

기존 global Resource ID를 선택해 Project에 명시 등록한다. 명시 참여와 일반 Task 개인 배정, Summary/Milestone 개인 책임 참조, 설비 Owner·시스템 PI/개발 역할을 분리한다. 미배정 등록자도 저장·재시작에서 유지하고 기존 사용자는 출처/등록 필요 상태로 표시한다. 등록은 ACL·실제 수행/근무 실적이 아니다. 등록·해제만으로 Task/Assignment·투입률/공수/기존 Capacity R를 생성하지 않는다. 후속 #728/#729/#736의 공통 분석/동적 Resource 대시보드는 별도다.

| 담당 | 소유권 |
| --- | --- |
| Main/Manager | 범위·통합·version/package/lock·관련 문서·Issue 기록 |
| membership_backend (backend) | DB migration/contract/repository/service/route/security inventory·사용중 보호·Copy/Template·교환 guard·실제 SQLite/HTTP 테스트 |
| membership_frontend (frontend) | master.resources 통합·목록/등록/해제·정확 기존 Assignment 편집·관련 unit/Chromium |
| membership_design (ui_ux) | 읽기 전용 상태·접근성·5폭 설계 및 Design Delta B |
| membership_qa (qa_docs) | 구현자와 분리된 읽기 전용 요구사항/보안/테스트/문서 사전 검토 |
| membership_infra (infra) | 최종 묶음 게시·main 대상 PR 생성·Full CI 시작 snapshot 확인; 결과 모니터링 없음 |

## Gantt 상태 정합성 적용

- gantt_standard_version: `GSC 1.0.0-candidate`.
- 읽은 문서 commit: `23857b6f3b3481a8402c6c421de2f7ff82304fe2`의 GANTT_STATE_CONSISTENCY/CONFORMANCE, GANTT_ADAPTER_ADR, GANTT_SYNC_TRACE 및 GANTT_STATE_REMEDIATION. 기존 표준의 REVIEW_PENDING과 제품 준수 증거는 별개다.
- 적용 GSC: 01 저장/표시 분리, 02 실제 Core 정합 확인 기존 gateway 재사용, 03 결과불명·거부 후 명시 복구, 04 단일 writer, 06/07 이전 응답/사용자 의도 취소, 08 관측 기반 완료, 09 동일 instance와 focus, 10 설치2.7.3·공개 API, 11 누적 회귀/증거 구분, 12 본 원장. GSC-05 날짜축 transaction은 기존 구현을 유지하며 새로운 축 writer가 없다.
- 쓰기 소유권: membership service만 참여 관계와 Project revision을 원자 변경한다. frontend는 서버 성공 뒤 host의 기존 canonical refresh/reconcile gateway를 사용한다. 기존 Task/Assignment Editor가 해당 원본 쓰기를, 기존 Coordinator가 viewport를 소유한다. membership 목록/검색/탭은 서버·Core·viewport 쓰기를 생성하지 않는다. 응답유실/5xx·canonical 실패 때 쓰기를 잠그고 명시 최신 조회로 복구한다.
- 누적 SC 적용은 부분 범위다: SC-05의 membership 저장 응답유실/후속 canonical GET 실패·명시 재조회 전 쓰기 잠금, SC-11의 Resource 기준정보 왕복·정확 Assignment Editor·단일 instance/기존 scroll을 신규 UI/native 테스트에서 검증한다. SC-05 전체의 Native Core commit 성공/실패 조합을 모두 새로 검증했다는 뜻은 아니다.
- SC-01 동일 snapshot 배열 재조회와 SC-07 actual Core drift/API·revision/query/axis 변경은 기존 canonical gateway를 재사용하며 해당 공통 구현을 수정하지 않는다. 신규 membership 응답 세대/취소 검증을 SC-07 전체 준수 증거로 확대하지 않는다.
- 제외/유지: SC-02 DnD412/500·SC-03 날짜422·SC-04 Native add/link/delete/type 거부·SC-06 Calendar-only는 해당 producer 변경이 없어 기존 원격 회귀 유지. SC-08 empty/M-only/WBS0 축·SC-09 RANGE_EXTENSION/wheel·SC-10 검색/이름 수정 결과0과 bookmark·SC-12 Day/Week/열/resize/split/fullscreen geometry·SC-13 Milestone 표시/OFF날짜/Copy/관계·SC-14 대량/반복 mount는 이번 등록 UI 구현에서 새로 전수 검증하지 않는다. Marker OFF와 기존 기준은 유지하며 로컬 미실행은 NOT TESTED다. 등록 목록의 empty/5폭/keyboard 검증을 이 SC 전체 PASS로 치환하지 않는다.
- exception ADR: N/A. private Core/새 writer/강제 remount/표준 예외를 도입하지 않는다.

## DOCUMENTATION_SYNC

- `docs/DB_SCHEMA.md`: UPDATED
- `docs/API.md`: UPDATED
- `docs/ARCHITECTURE.md`: UPDATED
- `docs/REQUIREMENTS.md`: UPDATED
- `docs/PROJECT_UX.md`: UPDATED
- `docs/RESOURCE_KPI_DASHBOARD.md`: UPDATED
- `docs/ISSUE_27_PROJECT_COPY.md`: UPDATED
- `docs/IMPORT_EXPORT.md`: UPDATED
- `docs/IMPORT_SCHEMA.md`: UPDATED
- `docs/EXCEL_EXPORT.md`: UPDATED
- `docs/TARGET_RESOURCE_USER_GUIDE.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `CHANGELOG.md`: UPDATED
- `DESIGN.md`: N/A(기존 이름 우선·semantic token·관리와 분석 분리·표 내부 scroll 원칙을 구체화한 Design Delta B이며 신규 공통 시각 원칙 없음)
- `docs/UI_UX_GUIDELINES.md`: N/A(기존 keyboard·focus·dirty·stale·권한·5폭 계약을 기존 화면과 사용자 가이드에 구체화하며 공통 interaction 정책 변경 없음)
- `docs/TASK_EDITOR.md`: N/A(동일 Task와 Assignment ID의 기존 리소스 Editor 호출을 재사용하며 편집기 자체 계약 변경 없음)
- `docs/SCHEDULING_ENGINE.md`: N/A(등록 원장은 일정·Calendar·Summary·Milestone·공수·Capacity 알고리즘의 입력에 추가하지 않으며 관련 기존 테스트는 보존 검증만 수행)
- `docs/SECURITY.md`: N/A(기존 Project 편집 세션·exact Origin·strong If-Match·원자 revision과 전역 관리자 분리를 재사용하며 새 경로의 구체 계약은 API와 route inventory에 기록)
- `AGENTS.md`: N/A(기존 역할·검증·문서 및 매뉴얼 영향 지침을 적용하며 실행 지침 자체 변경 없음)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 승인 경계·PR CI 시작 종료점을 적용하며 Lifecycle 정책 변경 없음)
- `docs/QA_REVIEW_POLICY.md`: N/A(기존 HIGH·OWNER_MANAGED·Owner 승인 및 독립 사전 검토의 구분을 적용하며 QA 정책 변경 없음)
- `docs/CI_CD.md`: N/A(후보 버전만 동기화하며 Workflow·Required aggregate·main/GHCR/Release 정책 변경 없음)
- `docs/REMOTE_VALIDATION.md`: N/A(원격 3개 Required와 Trusted QA·환경별 검증을 유지하며 원격 검증 정책 변경 없음)
- `docs/GITHUB_OPERATIONS.md`: N/A(기존 단일 canonical Refs와 묶음 게시/증거 정책을 재사용하며 원격 운영 계약 변경 없음)

required_docs와 실제 업데이트/N/A 근거는 위 표다. #720 제품 매뉴얼 경로/버튼은 아직 별도 미구현이며 이번에는 `master.resources` → `TARGET_RESOURCE_USER_GUIDE.md#프로젝트-리소스-등록과-해제`의 실제 사용자 절차를 같은 PR에 반영한다. 후속 매뉴얼 registry에 연결할 screenKey/anchor를 PROJECT_UX에 인계한다. 디자인·검증·원격 승인 기준을 새 기능을 위해 약화하지 않는다.

## AC_TEST_COVERAGE

- AC1: `tests/server/resources/project-resource-memberships.test.ts` — 동일 global ID의 두 Project 독립 등록·미배정 영속·전역 사람 수 불변; Chromium 등록·reload 경로.
- AC2: 같은 SQLite 테스트의 기존 개인 Task 배정·설비/시스템 역할·Summary/Milestone 책임 참조 출처와 개인 배정 없는 역할-only; UI의 등록/배정/책임/비활성 표시·ACL 분리.
- AC3: 같은 SQLite 테스트의 등록·해제 전후 Assignment/공수 불변·사용중409·global 삭제 차단; 기존 Resource domain Plan 회귀로 Capacity R 산식 유지.
- AC4: 같은 테스트의 실제 DB+HTTP401/403/409/412·Project 격리·동시 같은 revision1승/1거부·실패 rollback·비활성/역할/등급/Group 필터.
- AC5: 같은 테스트의 migration0028→0029·재시작·Copy/지원 Template 기존 배정/global ID 보존·unknown 참조 rollback·구 snapshot omission 및 JSON/Excel/Import 미지원 손실 방지.
- AC6: `tests/e2e/project-resource-memberships-ui.spec.ts`, `tests/domain/project-resource-memberships-model.test.ts` — 390/768/1024/1440/1920px·keyboard/focus·readonly/dirty/loading/empty/error/stale 및 기존 배정 편집/Resource 회귀. 실행 증거와 미실행 범위는 아래 검증 원장에 구분한다.

## 검증 선정과 실행 원장

신규 membership producer는 SQLite/HTTP/서비스 직접 테스트, 인접 소비자는 Resource Catalog 삭제·Project Copy/Template·JSON/Excel Export·기존 Resource 계산/Plan, 음성은 권한·stale·동시 변경·사용중·미지원 형식·잘못된 Template와 atomic rollback이다. frontend는 모델 unit와 실제 Chromium5폭 및 상태/정확 편집을 선택한다. 전체 Vitest/Playwright/Docker 회귀는 원격 PR Required gate에 맡긴다.

검증 환경: Node22.14.0, Next16.3.8, React19.3.0, better-sqlite3 13.0.3, Playwright1.63.0(설치된 관리 Chromium). 기존 작업 공간과 격리한 합성 DB/loopback HTTP·개발 서버에서 실행했다. 최초 Next16.3.4 준비 오류와 후속 pinned 재실행을 혼합하지 않는다.

| 실행 | 결과와 범위 |
| --- | --- |
| native membership + edit authorization + DB/legacy migration/CLI5파일 |60/60 PASS; qa_docs 별도 독립 실행60/60 PASS(exit0,6.77s). 이후 membership은14개로 강화 |
| Copy/Template/Import/Catalog 삭제·공정/Target 인접12파일 | 최초141/142 PASS, 구 MAX(version)27 기대를28로 보완한 corrective2파일21/21 PASS. 원래 실패 보존 |
| 견적 보존 REWORK 후 membership/Resource Excel/legacy 견적/Target Plan4파일 |45/45 PASS. membership14개 포함. 기존0.8M/D Assignment의 실제 XLSX 상세 XML 동일·등록-only 미산입·R=1·plain409/Target+legacy409 |
| frontend membership model unit |2/2 PASS |
| 실제 Chromium bounded combined13 |13/13 PASS: 신규 UI10 + 실제 SQLite/HTTP·reload/process restart·정확 Assignment/dirty/Gantt1 + 기존 역할/등급2. unexpected0/flaky0/skipped0 |
| 강화 Chromium2 |2/2 PASS: 기존 native 양수 chart scroll 보호 및 응답불명 뒤 검색만으로 잠금해제0·canonical 복구/focus. 위13개와 중복이며 새로운 고유2개로 합산하지 않음 |
| 기존 #724 exact-screen/legacy 저장보기·권한 경계 |1/1 PASS(15.8s). 변경된 등록 host/별도 전역 관리자 링크로 기대를 갱신하고3/6/4 메뉴·same-instance/무쓰기 보존 |
| 마지막 UI token 반영 후 기존5폭 |5/5 PASS(24.4s). 이후 역할0/1/3개 fixture 조합의 최종5폭5/5 PASS(23.3s), 제품 코드 변경 없이 geometry/캡처 갱신 |
| 정적·문서 검사 | pinned typecheck, backend scoped ESLint23파일 및 견적 REWORK2파일, frontend scoped ESLint, version consistency·Markdown links·diff 검사 PASS. 최종 동결 이후 결과는 아래 동결 기록에 추가 |

Backend의 최종 고유 단위/통합 테스트는19파일223case가 각각 PASS한 합집합이다. 원시60+141+21+45를 단순 합산하지 않는다. qa_docs는 견적 보존 REWORK 뒤 관련3파일38case를 별도로 재실행해 PASS(exit0,6.22s)했고 HTML 내부 원본 report.json의 combined13·강화2 결과도 직접 대조했다. 전체 Vitest/Playwright·6개 독립 runner·Docker/GHCR·Trusted QA는 원격 gate에 남기며 여기서 PASS로 주장하지 않는다. 실제 Windows Excel/VBA/DRM·운영 reverse proxy/TLS·off-host backup/restore와 최종 사용자 수용은 NOT TESTED다.

주요 실제 명령:

```bash
npx vitest run --config tests/config/vitest.config.ts tests/server/resources/project-resource-memberships.test.ts tests/server/projects/edit-authorization-handlers.test.ts tests/server/db/database.test.ts tests/server/db/issue-623-target-migration.test.ts tests/server/migration-cli.test.ts
npx vitest run --config tests/config/vitest.config.ts tests/server/resources/resource-catalog-delete.test.ts tests/server/projects/project-copy-service.test.ts tests/server/projects/project-copy-logistics.test.ts tests/server/templates/project-template-service.test.ts tests/server/templates/project-template-handlers.test.ts tests/server/projects/milestone-membership-copy.test.ts tests/server/templates/milestone-membership-template.test.ts tests/server/imports/project-import-service.test.ts tests/server/process-catalog/process-catalog-service.test.ts tests/server/logistics/logistics-targets-acceptance.test.ts tests/server/logistics/task-target-bindings.test.ts tests/server/resources/project-resource-memberships.test.ts
npx vitest run --config tests/config/vitest.config.ts tests/server/resources/project-resource-memberships.test.ts tests/server/logistics/logistics-targets-acceptance.test.ts
npx vitest run --config tests/config/vitest.config.ts tests/server/resources/project-resource-memberships.test.ts tests/server/projects/resource-excel-export.test.ts tests/server/projects/project-excel-resource-effort.test.ts tests/server/resources/issue-622-target-plan-excel.test.ts
npm run typecheck
node scripts/verify-release-version.mjs
node scripts/check-markdown-links.mjs
```

`verify:prepr --mode=targeted --base=23857b6f3b3481a8402c6c421de2f7ff82304fe2 --issue=727 --risk=HIGH --dry-run`는 실행계획만 출력했다(`NOT TESTED`, 선정66개·UNKNOWN2). CLI 자체를 PASS로 주장하지 않는다. Manager 수동 producer→consumer 매핑: `src/contracts/project-templates.ts`의 optional 참여 필드는 실제 Template 저장/instantiate 서비스와 native test가 소비하고 typecheck를 통과한다. `src/server/resources/project-resource-membership-service.ts`는 server-only DB composition이며 신규 실제 Next route를 호출하는 persistence Chromium에서 실제 DB·등록/재기동까지 실행한다. 자동 selector의 UNKNOWN2를 임의 무시/코드로 완화하지 않고 이 수동 검증과 범위를 남긴다. 전체 자동 선정66개 실행은 NOT TESTED다.

실패와 사전 보완은 [누적 원장](../../ISSUE_727_FAILURE_ANALYSIS.md)을 따른다. 별도 `membership_qa` 사전 검토는 원격/인간 승인과 다른 읽기 전용 Agent 검토다. 최종 소스와 문서의 사전 검토·전체 tree·게시 Head/base/test-merge·CI 시작은 원격 게시 댓글로 인계한다. 원격 Required/Trusted/Manager ACCEPT는 NOT TESTED, main/GHCR/release는 이번 요청 범위 밖이다.

## 최종 동결·증거

선정 source/test/package bytes는 [local-validation.json](../../evidence/issue-727/local-validation.json)의 SHA256 원장에 기록했다. 실제 기하 관측은 [5폭 geometry](../../evidence/issue-727/geometry-five-widths.json), 최종390/1440px 화면은 [390px](../../evidence/issue-727/memberships-390.png), [1440px](../../evidence/issue-727/memberships-1440.png)다. 개발 서버 캡처이며 최종 운영 수용을 대신하지 않는다. 마지막 역할0/1/3개 조합의5폭 실행/geometry는 같은 archive의 `final-role-coverage/`에 별도 보존했다. 전체 로컬 HTML/trace는 `/tmp/mastergantt-issue-727-local-evidence/untracked-output/output/playwright/issue-727/`에 보존한다.

생성 next-env.d.ts/tsconfig.json을 기존 HEAD로 복원하고 전체 기존 tracked output 증거를 보존했다. 새로 생성된 untracked runtime/output만 Git 밖에 보관한다. 정리 후 pinned typecheck·version·Markdown links·diff 확인을 완료했다. 원격 게시 직전 전체 tree/부모/최신 main·단일 canonical Refs를 검증하며 로컬 source와 API commit metadata의 차이는 원격 CI PASS가 아니다.

## 위험과 후속

참여 등록을 개인 부하/Capacity·실제 수행·ACL로 해석하지 않는다. 사용중 해제는 자동 배정 삭제 없이 차단한다. Snapshot revision 변경과 계획공수 변화는 구별한다. 지원되지 않는 일정 교환으로 관계를 잃지 않으며 SVG/PNG/조회 Excel을 전체 백업이라고 하지 않는다. #724의 병합 이력과 최신 main 이동은 원격 exact Head/base/test-merge 재검증 대상으로 유지한다. 새 Required3/Trusted/Owner HIGH 수용·미해결 리뷰0 확인 전 병합은 승인하지 않는다.

## Main 정렬·리뷰 대응 (2026-10-18)

- PR #739에서 main 4ce564a8d9ec646ba584a585a610537f14698476 (#725 포함)를 head에 병합하면서 main 및 #727 양쪽 기능을 함께 보존한다. 0028_process_context는 이름/체크섬을 변경하지 않고 #727의 이전 0028_project_resource_memberships를 0029_project_resource_memberships로 배치한다.
- 상호 겹치는 Resource/공정·작업구역/Copy/Template/JSON·Excel guard, Project host, route inventory 및 기존 migration 회귀를 통합한다. 기존 참여-only DELETE의 P2 리뷰는 원래 membership이 없으면 사용 중이더라도 changed=false no-op, membership이 있을 때만 사용 중409로 처리한다.
- main 0.118.0은 #725 소유이며 이번 신규 기능 후보는 0.119.0이다. 기존 원격 Head192b4f6/local 0.118.0 증거는 역사의 기록으로 보존하되 변경된 통합 tree의 검증 결과로 대체하지 않는다.
- 환경 제약: GitHub 객체 API를 통한 통합·정적 검토이며 수정된 통합 tree의 로컬 npm/Vitest/Playwright/SQLite 런타임 재실행은 NOT TESTED이다. 새 exact-head Full PR CI(quality/e2e/docker)와 Trusted QA/Owner 승인도 새 Run 증거 전 NOT TESTED다. CI 모니터링·병합/정식 배포/Issue 종료는 이번 범위 밖이다.
