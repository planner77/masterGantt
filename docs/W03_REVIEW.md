# W03 SVAR Minimal Integration review

확인일: 2026-09-11. 범위는 SVAR React Gantt Core의 최소 시각화·Client 경계·날짜 Adapter 검증이다. Project API, 인증, 영속 저장 및 Scheduling Engine 완료 판정과 구분한다.

## 공식 근거와 설치

- npm registry의 `@svar-ui/react-gantt` 2.7.3, MIT, React/React DOM peer `>=18`을 확인하고 exact dependency로 설치했다.
- 현재 React 19.3.0은 선언된 peer 범위 안이며 production dependency audit은 vulnerability 0건이다.
- 공식 Next.js guide의 Client Component, mount gate, `Willow`, `all.css`, 명시적 container height 규칙을 적용한다.
- W03 fixture에는 REST provider가 필요하지 않으므로 transitive `@svar-ui/gantt-data-provider`를 직접 사용하지 않는다.

공식 자료: [설치](https://docs.svar.dev/react/gantt/getting-started/installation/), [Next.js 통합](https://docs.svar.dev/react/gantt/integration-guides/nextjs/setup/), [Task](https://docs.svar.dev/react/gantt/api/properties/tasks/), [Link](https://docs.svar.dev/react/gantt/api/properties/links/), [Readonly](https://docs.svar.dev/react/gantt/api/properties/readonly/).

## 구현 경계

- `/gantt-demo`는 `dynamic(..., { ssr: false })`로 SVAR wrapper를 browser에만 올리고 `Willow`, Core CSS, 38rem container를 사용한다.
- fixture는 Summary 1개, 일반 Task 2개, zero-duration Milestone 1개와 `e2s` FS Link 1개를 표시한다.
- 기본 `readonly=true`이며, 명시적인 로컬 미리보기 toggle을 켜야만 Core update event를 실행할 수 있다. 미리보기에는 fetch/API/DB 경로가 없고 비영속임을 화면에 표시한다.
- 날짜 Adapter는 Domain의 inclusive `YYYY-MM-DD`를 local `Date`의 추론된 exclusive end로 바꾸고 역변환한다. UTC timestamp parsing과 `toISOString()`을 사용하지 않는다.
- command gateway는 transient update를 버리고 같은 browser turn의 동일 final update를 한 논리 명령으로 합친다. W03 handler는 상태 문구만 바꾸며 서버 저장은 W07 책임이다.
- 직접 의존·import는 Core뿐이다. REST provider, `setNext`, PRO prop이나 scheduling 기능은 사용하지 않는다.

## Findings와 처리

- 첫 E2E 시도에서 기존 개발 서버가 사용 중인 `.next` lock 때문에 별도 서버를 동시에 시작할 수 없었다. 기본 설정을 격리 포트 3100으로 두고, 명시적 `PLAYWRIGHT_BASE_URL` 사용 시 외부 서버를 재사용하도록 분리했다.
- Task text는 grid와 chart 양쪽에 나타나므로 전역 text locator가 strict-mode 중복을 만들었다. grid scope로 좁혔다.
- SVAR/lib-dom은 문자열 Link ID를 DOM에서 `:design-to-build`로 encode했다. 설치 artifact의 실제 DOM을 확인해 E2E selector를 수정했고 재실행에서 PASS했다.
- Summary의 날짜가 child 범위보다 짧고 Milestone에 task 전용 필드가 들어간 초기 fixture를 설치 타입/표현에 맞게 정리했다.
- `end`의 exclusive 의미는 공식 REST 예제로부터의 추론이지 vendor의 명시적 보장이 아니다. 변환을 한 Adapter에 격리하고, 실제 pointer drag/resize와 서버 round-trip은 W07의 재검증 항목으로 남겼다.

## Verification

독립 QA와 Manager가 2026-09-11에 다음 결과를 확인했다.

| 검증 | 결과 |
| --- | --- |
| `npm test` | PASS — 5 files / 23 tests |
| Gantt targeted unit | PASS — 2 files / 6 tests |
| 시간대별 날짜 Adapter | PASS — UTC, America/New_York, Asia/Seoul에서 각 5 cases |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS — Webpack production build, static `/gantt-demo` |
| Chromium E2E | PASS — 1/1, 실제 widget·fixture·FS Link·readonly·로컬 update event |
| `git diff --check` | PASS |
| production dependency audit | PASS — 0 vulnerabilities |

QA 판정은 W03 범위 **PASS**, Manager 판정은 **ACCEPT**다. 이는 Project API, 서버 authorization, physical drag/resize persistence 또는 Scheduling Engine의 완료 판정이 아니다.

## Remaining

- 실제 Project DB/API data loading과 direct project route는 W04 이후다.
- Edit password와 모든 mutation의 서버 authorization은 W05다.
- Working calendar와 inclusive date 계산은 W06, Task/Link persistence와 server error 복구는 W07이다.
- Core REST provider의 실제 채택 여부는 본 프로젝트 API의 revision·authorization·서버 계산 응답과 비교한 뒤 결정한다.
- 실제 pointer drag/resize, editor form, 서버 rejection 복구와 reload persistence는 W07 통합 E2E에서 검증한다. Link 저장 기반은 W07, 실제 FS Link 생성·수정과 재계산은 W09에서 검증한다.
- exclusive end 가정은 실제 drag/resize·서버 round-trip 결과가 다르면 Adapter와 관련 계약을 함께 수정한다.
- Docker/Turbopack/다른 browser·대규모 일정 성능은 이 최소 POC의 완료 범위가 아니다.
