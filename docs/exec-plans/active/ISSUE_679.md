# Issue #679 — PR 보완 변경 일괄 게시 Work Packet

## PLAN · 착수 전 재검토 (2026-10-17)

- Primary Issue: [#679](https://github.com/planner77/masterGantt/issues/679)
- 기준 main: `78ec8d2ced62f543f73a8477c3e62fca8274274b`; 기준 tree: `6501679e8547f0346c6f345e8e188e760eec48ce`.
- 작업 branch: `ci/issue-679-batch-publish`. 착수 조회에서 #679 기존 branch/PR/댓글 없음.
- 사용자 최신 지시: AGENTS.md·관련 지침을 참조해 구현, 미해결 리뷰·충돌 해결 후 PR CI 시작까지. 최초 Issue의 등록만 허용한 경계는 이 새 지시로 구현·게시 범위까지 갱신되었다. CI 완료 모니터링·병합·배포는 이번 단계 밖이다.
- lifecycle_phase: IMPLEMENTATION → LOCAL_VALIDATED → DOCUMENTATION_SYNC → PR_READY → PR_CI_STARTED.
- application_version: `0.114.1`; version_decision: keep. 제품·배포 변경이 없는 개발 운영 도구/문서 개선이다.
- release_required: false
- release_authorized: false
- risk_level: HIGH
- risk_reason: `scripts/**` 및 `AGENTS.md`의 개발 운영 보호 경로를 변경한다. 원격 쓰기·인증·workflow를 새 CLI에 넣지 않지만 잘못된 게시 일치 판정의 영향을 검토한다.
- qa_method: OWNER_MANAGED
- qa_required: true
- independent_qa: N/A(Owner-managed; 별도 로컬 사전 검토 결과는 최종 GitHub QA 승인과 구별)
- manager_decision: NOT TESTED (최종 Owner 병합 승인 아님)
- Required Quality/E2E/Docker, Preflight·기본 브랜치 Trusted QA·strict main·리뷰 0·Owner 최종 판단은 그대로 유지한다.

### AC1 — 최신 근거와 A~D 선택

실제 Ruleset `24043042 / main-lifecycle-gate`는 active, strict Required 세 check와 review thread resolution을 요구한다. Required approval count는 0, bypass actor는 없다. `ci.yml`은 PR opened/reopened/synchronize/edited 및 main push를 구독하고 Full/metadata concurrency를 분리한다. 이 설정을 변경하지 않는다.

| 대안 | 실현 가능성·권한 | 복구·복잡도 | 검증/비용·속도 판단 | 결정 |
| --- | --- | --- | --- | --- |
| A: 로컬 branch/worktree에서 완성 후 push 1회 | Git clone/ls-remote 성공. 이번 세션 push dry-run은 인증 부재 exit 128 | 기존 Git 사용, 이력과 여러 로컬 commit 보존. non-force push 및 전후 ref 확인 | 쓰기 인증이 있는 환경에서는 가장 단순. 로컬 커밋마다 PR CI를 만들 필요 없음 | 일반 운영 우선. 이번 세션 게시 BLOCKED |
| B: Git Data blob/tree/commit 후 Ref 1회 게시 | 연결된 도구 실제 제공. 기존 package blob을 같은 base tree에 지정한 비변경 tree probe가 동일 tree SHA를 반환 | 객체 준비와 게시 분리. expected SHA·force=false·tree/parent 조회·응답 유실 후 read-back 필요 | 같은 변경 묶음을 한 번 게시 가능. 객체 호출 수/한계와 API commit SHA 차이를 관리 | 이번 세션 조건부 채택. 실제 Ref 게시·CI 증거는 이후 판정 |
| C: Contents API staging | PR 없는 staging을 사용할 수 있으나 전체 workflow 영향 확인과 마지막 Ref 이동 수단 필요 | 파일별 중간 commit은 staging에만 남김. live PR 직접 연속 수정은 partial 게시 | Ref 이동 도구가 없으면 중간 CI 절감을 주장할 수 없음 | B 실패 시 자동 전환 금지. 허용되는 staging/인계 가능성부터 재평가 |
| D: event/concurrency/path/manual 변경 | 현재도 Full/metadata 취소와 Fast Gate 존재 | 정책 변경·최종 검사 누락 위험 및 운영 복잡도 증가 | 게시 단위 문제를 직접 해결할 근거 부족. #659/#703 범위와도 구분 | 보류. 현행 YAML/required/Ruleset 유지 |

A dry-run 오류는 `could not read Username for 'https://github.com'`이며 원격 쓰기는 발생하지 않았다. 새 토큰을 찾거나 인증/보호 규칙을 바꾸지 않는다. B의 tree probe는 원격 branch·commit·파일 내용을 바꾸지 않았으며 객체 API 동작만 입증한다. 도구의 expected_sha 설명으로 서버 내부 원자적 CAS까지 단정하지 않는다.

### 실제 Run 비용·효율 재검토

2026-10-17 읽기 snapshot, #618/#552의 목적 표본. [측정 자료](../../evidence/issue-679/ci-publication-baseline.json)는 Run/Attempt/Head 및 실제 Job 시간 합을 보존한다.

| 관측 | 결과 | 해석 |
| --- | --- | --- |
| #618 PR #678, #2731~#2740 | 12 commits / 서로 다른 Head의 10 CI / 9 cancelled / 최종 failure | commit 개수와 CI 개수의 일대일 관계는 보장하지 않음 |
| #2731.1 | assigned Job 합 5,473초(91.22분). Quality/E2E6/Docker success, QA latest Head stale, overall cancelled | 중간 Head의 실측 비용 후보. 취소됐어도 즉시 중단된 것은 아님 |
| #2732~#2739 | 각 attempt jobs=0, 관측 assigned Job 시간 0초 | 모든 취소 Run이 Runner 시간을 소비했다고 주장하지 않음 |
| #2740.1 | 생성→첫 assigned Job 1,179초, Job 합 62초, 생성→updated_at 1,236초 | 시작 지연과 실행시간·전체 경과를 구분 |
| #552 PR #561 최근 완료 표본 | Full 10 runs/10 Heads 모두 failure, Full cancelled 0, Job 합 32,850초 | batching이 제품/테스트 회귀 실패를 해결한다는 근거 없음 |
| #552 metadata #2860/#2865 | Job 합 96초 | metadata 운영 비용은 별도 집계 |

Job 시간은 유효 started_at/completed_at 및 runner_id를 가진 비-skipped Job의 차이를 합한다. 병렬 Job을 더하며 청구 분·금액과 다르다. 생성→첫 시작에는 orchestration/concurrency pending/runner scheduling이 섞인다. updated_at은 종료 시각의 proxy다. 취소 요청 주체/시각/직접 인과는 UNKNOWN. REST의 event=pull_request와 Issue/Head/표시·topology는 일치하지만 모든 원본 action payload를 독립 확인하지는 않았다.

이 두 PR은 무작위·동등 표본이 아니다. 통계적 신뢰구간, 절감률, 비용, 최종 성공률 개선은 **NOT TESTED**. 예상 효익은 불필요한 중간 게시 감소와 최종 Head 식별 단순화다. 계획된 별도 인수 단위·위험 가설 진단·리뷰 checkpoint·사용자 요청의 중간 CI는 이유/Head를 기록하고 허용한다.

### 채택·Rollback·Owner 판단

현재 승인 범위 안에서 B를 조건부 실행하고 A를 표준 권장으로 문서화한다. 변경 묶음 검증기는 읽기 전용 prepare/verify만 제공한다. 원격 쓰기 엔진, CI 취소/dispatch, credential 설정, reset/clean/force push는 추가하지 않는다.

- 준비 중 객체 API 거부: 기존 Ref 유지 여부 확인, 완료 객체를 checkpoint에 보존. 허용되지 않은 도구/자격증명으로 우회하지 않음.
- 응답 유실: intended Head이면 게시 완료를 검사; expected Head이면 원인 해소 후 제한적 재시도; 제3 Head이면 경합으로 중단·재통합.
- 기대 SHA·tree·parent·최신 main 불일치: 새 묶음 준비·재검증. expected 값을 자동 대체하지 않음.
- 도구가 불필요한 차단·업무 복잡도를 늘리면 도구만 사용 중단/revert하고 기존 A/B 수동 절차를 유지. 이미 게시한 Head는 정방향 보완/revert commit으로 복구.
- Owner의 별도 최종 병합 판단은 새 PR의 Required/Trusted 결과와 HIGH 잔여 위험이 준비된 이후다. 이번 지시를 병합·릴리스 승인으로 확대하지 않음.

## 구현 범위 및 담당

| 담당 | 범위 |
| --- | --- |
| Manager (/root) | PLAN, version/release, 문서 소유·동기화, 실제 원격 branch/PR 게시 통합과 최종 보고 |
| infra (/root/batch_design) | `pr-batch-core.mjs`/선언/`verify-pr-batch.mjs`, batch 테스트 및 prepr 신규 경로 매핑만 |
| researcher (/root/ci_evidence) | 과거·최근 Run snapshot 조사. 완료; 코드/원격 변경 없음 |
| qa_docs (별도 실행) | 최종 diff·안전성·문서·로컬 증거 read-only 검토. Owner/Trusted QA 대체 아님 |

issue_comment_writer: manager. issue_comment_allowed_types: PLAN, STATUS, EXCEPTION. Sub-Agent는 외부 댓글을 쓰지 않는다. 공용 파일 동시 쓰기 없음. #552/#624 제품 source 및 #703 workflow는 수정하지 않는다.

구현은 committed clean source → metadata-only manifest → 인증된 원격 관측값 비교를 제공한다. local commit과 API candidate commit은 별개이며 tree 동등성만 로컬 테스트 내용의 연결 근거로 사용한다. 신규 branch는 main을 부모로, 기존 branch는 expected Head와 필요한 최신 main 부모를 보존한다. 비교 JSON은 입력 자료이지 인증된 GitHub 결과 자체가 아니다.

## 변경 영향·로컬 검증 계획 (#697/#699)

| Producer/계약 | 직접·간접 소비자 | 선택/음성 검증 | 제외 근거 |
| --- | --- | --- | --- |
| batch prepare/verify | A 로컬 Git, B API 게시 담당자, Work Packet 인계 | 실제 임시 Git에서 복수 code/test/docs 추가·수정·삭제, staged/unstaged/untracked, ancestry, 부모·tree·Head/branch 불일치, UNKNOWN·거부·경합/응답 유실 입력, manifest 변조, read-only | 실제 원격 권한 만료/취소 주입은 수행하지 않음 |
| 새 scripts 경로 | verify:prepr 영향 매핑 | 새 batch 경로→실제 test, 기존 prepr 회귀 | prepr 전체 fingerprint/선정 정책 재설계 없음 |
| Agent 운영 문서 | Manager/infra 및 기존 QA docs_gate | Markdown links, AC_TEST_COVERAGE/DOCUMENTATION_SYNC, 기존 policy/QA/metadata 회귀 | UI/HTTP/SQLite/Chromium 사용자 동작 변경 없음 |

Node 22 및 lockfile 의존성을 격리 준비하고 `verify:prepr --mode=fast`와 직접 영향 테스트를 실행한다. 자동 targeted 선정은 dry-run으로 검토하며 그 자체는 테스트 PASS가 아니다. 필요한 local CLI/test·정책 회귀를 따로 수행한다. 전체 Chromium 6-shard/Docker 및 GitHub 이벤트·fork·metadata/Trusted의 원격 의미는 기존 Full PR CI에서 판정한다.

## DOCUMENTATION_SYNC

- `AGENTS.md`: UPDATED
- `docs/PR_BATCH_PUBLICATION.md`: UPDATED
- `docs/GITHUB_OPERATIONS.md`: UPDATED
- `docs/CI_CD.md`: UPDATED
- `docs/REMOTE_VALIDATION.md`: UPDATED
- `docs/TEST_PLAN.md`: UPDATED
- `docs/exec-plans/active/ISSUE_679.md`: UPDATED
- `docs/exec-plans/active/PLAN.md`: UPDATED
- `docs/evidence/issue-679/ci-publication-baseline.json`: UPDATED
- `docs/LOCAL_PREPR.md`: N/A(기존 CLI 모드/사용 계약 유지, 좁은 신규 경로 매핑은 batch 문서에서 설명)
- `docs/ISSUE_LIFECYCLE.md`: N/A(기존 phase·권한·승인 계약 유지, 게시 시점의 세부 절차만 추가)
- `docs/QA_REVIEW_POLICY.md`: N/A(OWNER_MANAGED/Required/Trusted·Owner 승인 변경 없음)
- `docs/SECURITY.md`: N/A(인증·권한·제품 보안 정책 변경 없음; 보조 CLI의 입력 검증은 batch 문서)
- `DESIGN.md`: N/A(제품 UI 변경 없음)
- `docs/API.md`: N/A(제품 HTTP API 변경 없음)
- `docs/DB_SCHEMA.md`: N/A(DB·migration 변경 없음)
- `docs/ARCHITECTURE.md`: N/A(앱 아키텍처 변경 없음)
- `docs/DEPLOYMENT.md`: N/A(배포·컨테이너 변경 없음)
- `README.md`: N/A(제품 설치/사용법 변경 없음)
- `CHANGELOG.md`: N/A(앱 버전·기능 출시 변경 없음)

## AC_TEST_COVERAGE

- AC1: 이 PLAN의 실제 main/Ruleset/API probe·A dry-run·Run/Attempt 표본 및 A~D 선택·한계·rollback 검토. 구현 전 재검토 PASS.
- AC2: batch 임시 Git 테스트와 실제 #679 복수 script/test/docs 최종 remote tree·candidate Head, PR Full CI 자동 시작을 연결. 시작 후 비용/성공률은 모니터링 범위 밖 NOT TESTED.
- AC3: 기존 ci.yml/Ruleset/QA 검증기 불변 diff 및 관련 policy·prepr 회귀. 실제 Required Quality/E2E/Docker·Preflight·Trusted·Owner는 최종 원격 source에서 별도 판정.
- AC4: 거부·UNKNOWN·경합·부분 객체/응답 유실의 구조 입력 검증과 actual local Git ancestry/read-only 테스트. 실제 A 인증 거부/B object probe 구분. 운영 원격 권한 만료·제3자 경합 주입은 NOT TESTED이며 fixture를 그 증거로 승격하지 않음.
- AC5: baseline JSON과 위 Run별 구분·측정 정의로 유지/도입/보류 결정. 새 CI 완료 전 절감/queue/최종 wall-clock/성공률 비교 NOT TESTED.
- AC6: 위 DOCUMENTATION_SYNC, Markdown/QA 구조·상호참조·한국어 운영 문구 검토 및 PR 결과 계약 인계.

## 실행 결과

로컬 구현 및 직접 회귀 완료. 신규 batch 44개와 기존 Pre-PR/매핑 22개, 합계 **66/66 PASS**(Node 22.23.3, 9.31초, exit 0). 직접 ESLint 및 Node 문법 확인도 PASS했다. 첫 제한 sandbox의 Git/Node 자식 프로세스 EPERM은 동일 명령을 승인된 실행 환경에서 재검증하여 구분했으며 테스트 skip·단언 완화는 없다.

별도 읽기 전용 사전 검토에서 숨긴 index 변경, replace/graft 조상 관계, status 중 외부 clean/process 필터 실행을 실제 임시 Git으로 재현하여 차단·회귀를 추가했다. 필터 미실행, refs/index/추적 파일 불변 및 CLI 왕복을 확인했다. 검토 중 발견한 manifest-sha256 옵션명 파싱 결함도 고쳤다.

기존 metadata evidence 회귀, metadata reconcile 13개, QA Final Automated 34개와 Markdown 링크 검증은 PASS했다. 기존 docs_gate는 DOCUMENTATION_SYNC 구조 및 AC1~AC6 매핑을 통과했다. 이 결과는 fixture/로컬 구조 증거이며 원격 QA 승인이 아니다.

### 전체 fast 실행과 source 변경 구분

Node 22.23.3에서 `npm run verify:prepr -- --mode=fast --base=origin/main --issue=679 --risk=HIGH`를 2026-10-17 08:22:38~08:25:29 UTC에 실행했다. 시작 local Head는 `fbeb899002a919f432597517da4628b7c9a831f0`, tree는 `eea1c4092d77f5e85c5b8474f19769083079c111`이며 dirty=false였다. 정책 5단계·의존성·Typecheck·Lint·전체 Unit·Production build의 **10개 명령은 모두 exit 0**이었다. Unit은 **225 files/2,823 PASS**, 기존 **1 file/3 tests SKIPPED**이며 이번 변경에서 skip을 추가하지 않았다. 변경 영향 선정은 두 직접 Unit 파일 READY, UNKNOWN/MISSING=0이었다.

단, 기존 Next build가 `NEXT_DIST_DIR=.next-prepr`에 따라 `next-env.d.ts`의 생성 타입 경로와 `tsconfig.json`의 include 두 항목을 자동 변경했다. 전체 실행기의 source fingerprint가 달라져 최종 판정은 **BLOCKED / sourceStable=false**이다. 시작 fingerprint `f274d294c8960d0637a6fd2e4573ea967cb8b70e5bfc37ea5fb366924ff52a49`, 종료 `614680c7d89e750a4f8723a838cdf074bd500c0f09668bdf92d9f8ec1156214b` 및 원본 report를 보존했다. 개별 명령 성공을 전체 fast PASS로 승격하지 않는다.

자동 변경된 두 파일의 bytes가 위 생성 경로 치환만 포함함을 확인하고 보존한 뒤, 해당 두 파일만 원래 커밋 bytes로 복원했다. 가드/tsconfig/Next 설정을 완화하거나 #699 검증기 재설계로 범위를 넓히지 않는다. 최종 변경에는 두 파일이 포함되지 않는다. 이 후속 로컬 commit은 Work Packet 결과 기록만 변경하며 구현·테스트 blob은 fast 시작 source와 같다. 최종 committed clean source에서 영향 Unit targeted 검증과 별도 사전 검토를 수행하여 source 안정성 증거를 따로 인계한다.

최종 local Head/tree, targeted 결과, API candidate Head/부모, manifest SHA-256, 실제 Ref 게시·PR·Run/Attempt는 최초 PR 본문 및 Issue STATUS 댓글에 연결한다. 원격 게시 전인 이 기록에서 제품 회귀, CI PASS, 최종 QA 또는 Owner ACCEPT를 미리 주장하지 않는다. Local fast의 위 기존 build/source 한계는 잔여 위험으로 남기며 실제 Required Quality/E2E/Docker는 최종 PR의 원격 CI에서 검증한다.
