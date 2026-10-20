# Issue #732 — 누적 실패 원장

## L732-001 — 로컬 Chromium 준비 환경 실패 (2026-10-20)

- 첫 신규 전용 E2E 실행은 존재하지 않는 외부 baseURL로 인해 3개 case의 setup 연결에 ECONNREFUSED가 발생했다. 제품 동작 assertion까지 실행되지 않았으며 제품 FAIL로 단정하지 않는다. 해당 시도는 환경 FAIL이고 성공 evidence가 아니다.
- 다음 정상 webServer 시작에서는 worktree 밖의 node_modules symlink를 Turbopack이 거부해 준비 단계가 BLOCKED됐다. ignored 로컬 의존성을 worktree 내부에 배치하여 같은 소스/기존 E2E assertion을 재실행한다. package/lock dependency·CI setup·timeout/retry/skip 변경 없음.
- 원본 실행 상세·후속 결과는 frontend Result Contract와 이 원장에 누적한다. 로컬 후속 PASS는 최초 준비 실패나 원격 Required Quality/E2E/Docker 미검증을 삭제하지 않는다.

원본 준비 명령은 `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3198 npx playwright test --config tests/config/playwright.config.ts tests/e2e/issue-732-milestone-dashboard.spec.ts --project chromium`였다. 잘못된 외부 서버 환경변수를 제거하고 같은 명령으로 재개했으나 외부 node_modules symlink 준비 차단이 확인되어, ignored 의존성만 worktree 안에 배치했다. 제품/테스트 assertion·CI 환경은 완화하지 않았다.

## R732-001 — 수동 이벤트와 선행 차단의 독립 표시 (2026-10-20)

Manager source review에서 새 Gate summary의 배타적 분기 `manualEvent ? Ready N/A : blocked ? Blocked : ...`가 소속0 수동 이벤트이면서 직접 선행이 미완료인 경우의 Blocked를 숨기는 것을 확인했다. 기존 canonical Gate는 manualEvent=true와 blocked=true를 동시에 지원하며 `tests/domain/milestone-stage-gates.test.ts`가 이 조합을 고정한다. 기존 관리 표/서버 판정이 바뀐 것은 아니지만 새 요약의 전체 Gate 표시 누락으로 P2 REWORK한다.

수정은 표시 플래그를 독립 조합하여 수동 이벤트/Ready N/A와 Blocked, 완료 조건 불일치 진단을 함께 나타내는 것이다. Gate 산식/저장·API는 변경하지 않는다. 전용 presentation regression과 기존 domain Gate test로 확인하며, 실제 테스트 결과는 최종 검증 기록에 추가한다. 이 항목은 정적 검토 finding이고 실행 실패로 주장하지 않는다.

## L732-002 — 최종 browser 준비 연결 단절과 의존성 불일치 (2026-10-20)

최종 assertion 보강 2개와 기존 #550 6개를 묶은8-case 실행 첫 case는 fixture 초기 snapshot GET의 ECONNREFUSED(port44435)로 FAIL했다. Dashboard assertion 도달 전 격리 서버가 사라졌으며, 원인은 UNKNOWN이다. 당시 메모리 약12.8/15.7GiB·swap4084/4096MiB와 다른 worktree browser 동시 실행이 관측됐지만 OOM/외부 process 종료로 확정하지 않는다. 원본 error context에는 합성 cookie가 포함돼 raw 파일을 게시하지 않는다.

Manager가 ignored 로컬 의존성의 실제 Next/@next/env16.3.4와 manifest/lock16.3.8 불일치를 확인했다. 처음 main 의존성을 hardlink copy한 준비 방식은 frozen install과 같지 않다. 기존 feature/server/domain 54 PASS·전용 browser4 PASS 및 새 label regression5 PASS는 당시 stale-dependency 로컬 진단 증거로 보존하며 pinned dependency 결과로 주장하지 않는다.

진행 runner를 자기 PTY에서 중단(exit130): 첫 case FAIL, 다음 case INTERRUPTED, 나머지6 NOT RUN. 자기 fixture의 서버/worker만 종료했고 PID 부재를 확인했다. 다른 worktree 프로세스는 변경하지 않았다. generated next-env/tsconfig 변경을 정확 HEAD 내용으로 되돌리고 이 worktree에서 `npm ci --no-audit --no-fund` frozen install 후 최종 핵심 검증을 수행한다. assertion·기존 timeout/retry/skip·CI 설정 완화 없음. 새 실행 결과는 후속 기록으로 남기며 앞선 실패를 지우지 않는다.

## L732-003 — frozen install 준비 중 종료 (2026-10-20)

`npm ci --no-audit --no-fund`는 public npm registry의 Next16.3.8 패키지 fetch에 약318초를 사용한 뒤 SIGTERM/exit1로 종료됐다. 종료 주체/원인은 UNKNOWN이며 패키지 버전 해석·제품 assertion 실패로 단정하지 않는다. 로그의 비밀 없는 상태·duration만 기록하고 원문 npm debug log를 게시하지 않는다. dependency/lock 변경 없이 새 cache를 재사용하는 `npm ci --prefer-offline --no-audit --no-fund` 한 번으로 frozen install을 재개한다. 성공한 경우의 install/실제 package version과 핵심 검증 결과를 별도 기록하며, 계속 차단되면 로컬 최종 검증은 BLOCKED로 두고 PR의 기존 frozen-install Required CI를 시작한다. gate·assertion 완화나 로컬 진단 PASS의 원격 대체는 없다.

## 최종 source 검증 재개

선행 online/prefer-offline 설치 종료 뒤 CLI 미완성(`tsc: not found`, `vitest: not found`, exit127)을 확인했으며 이를 실행된 test FAIL로 오인하지 않는다. 마지막 `npm ci --offline --no-audit --no-fund`는 exit0/447packages/24초로 완료했고 실제 Next/@next/env16.3.8·Playwright1.63.0·Vitest5.0.0을 확인했다. 고정 환경에서 최종5files/55tests PASS(3.60초): feature5·server5·기존 Gate/원장/acceptance45. R732-001의 수동 이벤트+Blocked·명시완료불일치·선행완료 진단해제 regression 포함. 이는 PR Required3 전체 회귀 PASS가 아니다.

최종 pinned 후속 실행은 typecheck·대상 ESLint exit0, 새 Chromium2/2 PASS(총2.7분, 53.6초/45.1초)다. 5폭/키보드/내부 overflow·native Milestone/marker0 및 조건 밖 생성·정확 원본 재진입·안내 닫기 초점 복귀를 직접 확인했다. 초기4case stale dependency 성공과 중단된8case를 최종 pinned8case PASS로 합치지 않는다. 나머지 readonly/Task원본저장·stale/error 및 기존 #5506case는 새 PR의 전체 E2E에서 다시 검증한다. 독립 사전 코드/문서 검토 P1/P2 0건; 원격 CI/최종 승인 미검증.

## 게시 시 최신 main 충돌 정리

#735가 main08a1d9ff/version0.126.0으로 진행한 것을 재조회했다. 기존 #732 후보0.126.0과 CHANGELOG·TEST_PLAN append 충돌은 양쪽 내용을 보존하고 #732의 새 후보0.127.0으로 정리한다. 코드 충돌은 없으며 공유 WBS의 additive 변경은 최신 source의 관련 회귀로 재검증한다. 이전55unit/2browser PASS를 새 Head의 원격 PASS로 전용하지 않는다.
