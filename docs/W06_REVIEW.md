# W06 Working Calendar and Duration 검증 기록

검증일: 2026-09-11
최종 판정: **DONE / PASS / ACCEPT**

## Summary

W06은 UI·DB·SVAR·system timezone과 분리된 pure TypeScript Scheduling Domain을 추가했다. 지원 범위는 Gregorian date-only, Project Working Calendar, inclusive 근무일 계산, calendar-only Leaf Task와 Milestone 계산이다. 동일 fixture를 Server Component와 hydration 이후 Browser에서 각각 계산해 UTC·Asia/Seoul·America/New_York Chromium context에서 같은 결과임을 확인했다.

Summary/WBS, FS graph 재계산, Task·Calendar 저장과 mutation authorization은 각각 W08/W09/W07의 후속 범위다. W06 완료는 이 기능들의 완료를 뜻하지 않는다.

## Requirement Coverage

| 요구 | 판정 | 검증 내용 |
| --- | --- | --- |
| Strict Gregorian date-only | PASS | `YYYY-MM-DD`, 실재 날짜, `1900-01-01..2199-12-31`, 윤년·세기 경계 |
| Host timezone 독립성 | PASS | `Date`, `Date.parse`, local midnight, system timezone 없이 ordinal 계산 |
| Project Calendar | PASS | exact `Asia/Seoul`, exact weekend `[6,0]`, 사용자 Holiday |
| Holiday 계약 | PASS | invalid·duplicate·상한 거부, 날짜 정렬, 입력 복사·freeze, `name` string/null/미지정 보존 |
| Working-day 연산 | PASS | 근무일 판정, 다음 근무일, inclusive 구간 count, duration 기반 end |
| Leaf Task | PASS | duration 정수 `1..10000`, requested/effective start 분리, optional end 검증 |
| Auto schedule | PASS | 비근무 시작을 다음 근무일로 이동하고 안정 warning 반환 |
| Manual schedule | PASS | 비근무 시작을 `NON_WORKING_MANUAL_START`로 거부 |
| Milestone | PASS | duration 0, start=end, Auto/Manual Calendar 경계 |
| 오류·탐색 상한 | PASS | 구조화된 safe context, 전체 109,573일 절대 상한, 종료 불가능 Calendar 실패 |
| 결정성·불변성 | PASS | 입력 mutation 없음, normalized result freeze, 반복 계산 동일 결과 |
| Server/browser fixture | PASS | raw SSR `pending`과 hydration 이후 Browser 계산을 분리해 3 timezone에서 canonical 결과 비교 |
| Task·Calendar persistence | BLOCKED / W07 | W06은 Domain 계산과 runtime fixture만 제공 |
| Summary/WBS | BLOCKED / W08 | hierarchy 계산 미구현 |
| FS/Manual aggregate conflict | BLOCKED / W09 | dependency graph와 transaction rollback 미구현 |

## Research Findings

- ECMAScript date-only 문자열과 `Date` 객체는 instant/timezone 의미를 가지므로 업무 날짜 산술에 직접 사용하지 않는다. W06은 strict parser와 proleptic Gregorian ordinal을 사용한다.
- 검증 Node.js 22.14.0에는 built-in Temporal이 없어 작은 W06 범위에 polyfill dependency를 추가하지 않았다.
- IANA `Asia/Seoul`은 Project 업무 날짜의 identifier다. W06 date-only 산술은 timezone offset이나 DST database를 읽지 않는다.
- SVAR의 end 의미는 공식 예제로부터 exclusive라고 추론한 상태다. 실제 pointer drag/resize와 서버 저장 왕복은 W07에서 재검증한다.

근거와 외부 출처는 [RESEARCH.md](RESEARCH.md)에 기록했다.

## Architecture Decisions

- 지원 날짜는 기존 API·DB 계약과 맞춘 `1900-01-01..2199-12-31`이며 전체 109,573일을 탐색과 Holiday 수의 절대 상한으로 사용한다.
- Calendar 입력은 v1 계약 그대로 `Asia/Seoul`, `[6,0]`만 허용한다. 임의 국가 법정공휴일을 생성하지 않는다.
- 일반 Task duration은 `1..10000`, Milestone은 0이다. W06의 `scheduleLeaf`는 hierarchy나 dependency를 소비하지 않는다.
- 중복 Holiday는 조용히 합치지 않고 `DUPLICATE_HOLIDAY`로 거부한다. 표시명은 DB/API shape에 맞춰 string, null, 미지정을 구분한다.
- 계산 실패는 전체 caller payload나 secret을 담지 않는 `SchedulingError` code/context로 반환한다.
- 서버 계산이 최종 권위다. Browser fixture 일치는 cross-runtime 결정성 증거이며 edit authorization이나 persistence 증거가 아니다.

## Verification

검증 환경: Linux 6.6.87.2 WSL2 x86_64, Node.js 22.14.0, npm 11.10.0, Chromium 145.0.7632.6.

| 검증 | 결과 |
| --- | --- |
| W06 Domain unit/purity | PASS — 4 files / 135 tests |
| 전체 Vitest | PASS — 15 files / 226 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — Next.js 16.3.4 Webpack production build |
| `npm run test:e2e` | PASS — clean 원본 repository, 기본 Turbopack, Chromium 7/7, worker 1 |
| Browser timezone fixture | PASS — UTC, Asia/Seoul, America/New_York |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |
| 로컬 Markdown 링크 검사 | PASS |
| source credential pattern 검사 | PASS |

Domain 날짜 시험은 109,573개 지원 날짜 전체를 독립 UTC oracle과 왕복·요일 비교했고, 윤년·월말·연말·범위 밖·최대 duration·전 날짜 Holiday 종료 실패를 포함한다. 별도 Node process를 다섯 timezone에서 실행해 같은 fixture 결과를 확인했다. Browser 시험은 raw SSR HTML의 `data-scheduling-match="pending"`을 먼저 확인한 뒤 hydration 이후 server/browser canonical JSON이 같아지는지 검사했다.

## Independent QA

초기 독립 QA에서 다음 두 blocker를 발견해 재작업했다.

1. Client Component의 SSR 계산만으로 runtime E2E가 통과할 수 있었다. 초기 state를 `pending`으로 두고 `useEffect` 이후에만 Browser 계산하도록 변경했으며 raw SSR도 별도로 검증한다.
2. Domain Holiday `name?: string`이 DB/API의 `name: null` 계약과 맞지 않았다. string/null/미지정을 복사·보존하도록 수정했다.

추가 non-blocking finding이었던 malformed leaf 입력의 raw `TypeError`와 date-range 끝 Auto failure의 low-level context도 구조화된 Domain 오류로 보완했다. 재검토 결과 Scheduler/Frontend code는 **ACCEPT**였다. Manager는 clean 원본 Turbopack 전체 E2E와 production build를 별도로 재실행했다.

## Changed Files

- `src/domain/scheduling/`: date-only, Calendar, Leaf 계산, 공개 API와 안정 오류
- `tests/domain/scheduling/`: 전체 날짜 oracle, Calendar/Leaf edge case, 불변성·timezone purity
- `src/features/gantt/scheduling-runtime-fixture.ts`: Server/Browser 공용 canonical fixture
- `src/app/gantt-demo/page.tsx`, `src/features/gantt/gantt-demo.tsx`: server result 전달과 hydration 이후 Browser 비교 상태
- `tests/e2e/gantt-demo.spec.ts`: raw SSR 및 세 Browser timezone 검증
- README, Scheduling/Architecture/Requirements/Research/Decision/Test/Plan 문서

Package dependency, SQL schema와 migration, REST route는 변경하지 않았다.

## Security Findings

- Domain source는 React, SVAR, SQLite, HTTP, filesystem, network, process 환경과 시스템 시각을 import하지 않는다.
- 사용자 제공 Holiday와 날짜 순회에 절대 상한이 있으며 실패 시 무한 탐색하지 않는다.
- 오류 context에는 전체 input payload를 복사하지 않는다.
- W06 변경 source와 문서에서 credential pattern은 발견되지 않았다.
- Production dependency audit는 0건이다.

이전 작업 중 노출된 repository 자격증명은 source/Git에 포함되지 않았지만 별도 폐기·재발급이 필요하다. 정상 인증 복구 전에는 원격 push/release를 시도하지 않는다.

## Documentation Updated

- `README.md`
- `docs/REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/SCHEDULING_ENGINE.md`
- `docs/PRO_FEATURE_MATRIX.md`
- `docs/API.md`
- `docs/DB_SCHEMA.md`
- `docs/TEST_PLAN.md`
- `docs/RESEARCH.md`
- `docs/DECISIONS.md`
- `docs/ISSUE_BREAKDOWN.md`
- `docs/W03_REVIEW.md`
- `docs/exec-plans/active/PLAN.md`
- `docs/W06_REVIEW.md`

## Remaining Risks

- 실제 Task/Link/Calendar 저장, protected mutation과 reload persistence는 W07까지 BLOCKED다.
- Summary/WBS와 FS dependency, cycle, link 삭제 후 날짜 복귀, Calendar 변경 시 Manual conflict rollback은 W08/W09까지 BLOCKED다.
- SVAR pointer drag/resize의 inclusive/exclusive end, 서버 거부 복원과 command 중복 방지는 W07에서 실제 저장 왕복으로 재검증한다.
- Holiday name의 HTTP 길이 제한은 Calendar mutation route를 추가할 때 strict schema로 적용해야 한다.
- Runtime fixture는 계산 모듈의 cross-runtime 증거이지 실제 Project Task 통합 증거가 아니다.
- Docker native target, SQLite volume restart·backup/restore, 운영 header/log/rate/KDF benchmark는 W16까지 NOT TESTED다.
- 실제 Excel/VBA 환경과 Workbook은 D01/W10까지 UNKNOWN/BLOCKED다.

## Recommendation

W06을 **DONE / PASS / ACCEPT**로 종료하고 W07 Task and Link Persistence로 진행한다. W07은 server-side authorization·revision transaction, Project isolation, 계산 결과 저장, Gantt edit/reload, pointer date adapter와 오류 복원을 함께 검증해야 한다.
