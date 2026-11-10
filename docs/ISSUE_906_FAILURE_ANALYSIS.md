# Issue #906 / #908 통합 누적 실패·검증 원장

## 기준과 재사용

- 기준 main/source: `4aad8865972e3446f0d34c7ffcfd2bbab439e366`, Node `22.14.0`, npm `11.10.0`, Docker `29.8.0`, 제품 `0.145.1`.
- Primary #906, related #908. 사용자 입력의 중복 #906은 같은 이슈로 처리한다. 작업 계획은 [통합 Packet](exec-plans/active/ISSUE_906_908.md)이며 #908은 [연결 원장](ISSUE_908_FAILURE_ANALYSIS.md)을 사용한다.
- REUSE_REVIEW=EXTEND: #697/#699 prepr, #704 누적 원장, #711 인벤토리, #895 재사용, #896 합성 화면 증거, 기존 Docker/API/SQLite smoke와 DEPLOYMENT 복원 계약.
- 조회한 과거 회귀: #895 F-001 문서 gate 누락·Visual source 귀속, #711 F711-001 case 수와 파일 수 혼동, #552 Next 생성물 source drift. 과거 원격 실행은 그대로 보존하며 새 로컬 PASS로 치환하지 않는다.
- 모든 신규 PR/CI/Trusted/Finalizer: N/A(Owner #905/#906/#908 명시 미사용). 운영 배포: NOT TESTED/미요청. image 미게시와 테스트 FAIL은 다른 상태다.
- 본문은 append-only로 보완한다. 실제 원시 로그/credential/운영 DB/사내 주소/화면은 공개하지 않는다.

## F906-001 · LOCAL_PREP / LIVE 전환 전제 — BLOCKED

- 관측: 2026-11-10 21:31–21:35 UTC (2026-11-11 KST); actor: Manager, authenticated GitHub account `planner77`.
- 실행: `gh api repos/planner77/masterGantt/rulesets/24043042`, repository Actions permissions, workflow 목록/진행·대기 run read-only 조회.
- 기대: direct Push 이전 PR·필수 Check 조건 해제 및 자동 Actions 중지.
- 실제: ruleset `24043042` / `main-lifecycle-gate` active; deletion/non_fast_forward와 함께 pull_request/required_status_checks 세 조건 존재. Actions enabled=true, CI/Release/QA/Finalizer/Preview active. 첫 Push 미실행.
- 원인: Owner 신규 정책은 Issue에 기록되었지만 LIVE 설정 전환은 아직 수행되지 않음. 제품 코드 테스트 FAIL 아님.
- 판정: BLOCKED(원격 Push/게시/종료); 로컬 작업 계속 가능. 원본 설정 보존 후 #911 최소 관리자 전환이 필요하다.
- Owner 후속 결정: 비동기 응답 `필요한 #911 관리자 전환도 위임`. 자동 gate 우회가 아닌 명시된 새로운 로컬 운영 정책의 설정 전환을 승인했다. 과거 실행/열린 PR은 임의 삭제·종료하지 않는다.
- 복구: NOT TESTED. 전환 후 동일 ruleset의 force/delete 금지·bypass 없음·writer 권한 유지 및 Actions off, 첫 Push 후 신규 Actions run 0건을 확인한다.
- 영향: #906/#908 Push, #909 게시 전제, #911 일부 실증. #911 전체 AC(기존 PR 처리·운영 DB 복구)는 본 범위 밖이다.

## V906-001 · LOCAL_PREP / frozen install — PASS

- 명령: 격리 worktree에서 `npm ci --no-audit --no-fund`.
- 실제: exit `0`, `added 711 packages in 15s`; lockfile 변경 없이 설치 완료. eslint deprecation 경고 원문은 로컬 로그에 보존한다.
- 근거 범위: 의존성 설치 성공만 의미한다. typecheck/lint/unit/build/Docker/게시의 성공 근거가 아니다.
- 남은 결과: 전체 필수 로컬 검사·같은 source admission·독립 QA·Push·GHCR digest 검증은 NOT TESTED.

## F906-002 · LOCAL_PREP / GitHub CLI 페이지 수집 — FAIL → PASS

- 실제 구간: 2026-11-10T21:37:47.951341+00:00~21:37:56.623269+00:00. 배치 구간만 수집했으며 개별 명령 시각은 NOT CAPTURED다.
- 원본: `gh api <workflows/open-prs/packages/package-versions endpoint> --paginate --slurp`, exit `1`. 설치된 `gh 2.45`가 `--slurp`를 지원하지 않았다. endpoint 결과의 비공개 package metadata는 공개하지 않는다.
- 원인 분류: 로컬 운영 도구 호환성, 제품 FAIL 아님. Manager/operations는 설정·Push·이미지 mutation 없이 조회만 했다.
- 교정/재실행: 같은 endpoint에서 `gh api ... --paginate`의 연속 JSON을 Python JSONDecoder로 decode; 모두 exit `0` / PASS. 최초 오류를 삭제하지 않는다.
- 보관: 실제 명령·안전한 결과·hash는 ignored `.prepr-reports/operations-906-908/prep-failure-events.json`과 snapshot manifest. 로컬 원본은 Git/Docker context에 넣지 않는다.

## F906-003 · LOCAL_PREP / Buildx 표시 템플릿 — FAIL → PASS

- 원본 명령: `docker buildx ls --format '{{.Name}} {{.Driver}} {{.Status}}'`, exit `1`; 현재 Buildx template의 `.Driver` field 미지원.
- 개별 실행 시각: NOT CAPTURED. 과거/재실행 시각을 추정해 채우지 않는다.
- 교정/재실행: `docker buildx ls`, exit `0` / PASS. active `default` builder가 running/linux/amd64임을 확인했다. 별도 stale desktop-linux builder 미가용은 운영 서비스 변경 없이 관측만 했다.
- 영향/잔여 위험: 기존 Buildx 버전/출력 차이는 파서가 가정하지 않아야 한다. GHCR write·digest smoke는 아직 NOT TESTED.

## V906-002 · 원격 변경 전 준비 / READ-ONLY

- LIVE read-only: workflow active 81, running 0/queued 0, 열린 PR 7건 유지. 기존 PR의 채택/정리나 태그 조작은 하지 않는다.
- 복구 기준: 기존 정상 `0.145.1` image digest `sha256:7c8e3ed6ed8b78ab8d5832fa2b225cf3f160e1c8e5b044963330e78eb26dc866`, 직전 `0.145.0` `sha256:87d6adf13c0f0cc2e0b92c0c36bb5c75f22a9e19db925cfc28461333ed36fc64` 보존.
- 예정 최소 설정 변경: ruleset active/조건/bypass[]/deletion/non_fast_forward를 그대로 유지하고 pull_request/required_status_checks만 제거; repository Actions enabled=false. 실제 변경은 로컬 필수 검사·문서·독립 QA 이후이며 아직 NOT TESTED다.
- 제품 DB/schema 변경 없음, 운영 배포 미요청. #912 실제 오프호스트 백업·복원 검증은 본 작업에서 PASS로 주장하지 않는다.

## F906-004 · OPERATION / Issue 댓글의 레거시 Finalizer 간접 생성 — FAIL

- 관측/원인: Manager가 신규 workflow dispatch·PR·Push를 하지 않았지만 기존 `.github/workflows/release-finalizer.yml`의 `issue_comment: created`를 확인하기 전에 PLAN/STATUS 댓글을 작성했다. Actions가 활성화된 상태이므로 댓글이 별도 Run을 생성했다. 이는 '신규 Run 0건'과 다르며 Manager의 운영 순서 오류다.
- 실제 원본: 기준 Head `4aad8865972e3446f0d34c7ffcfd2bbab439e366`, 2026-11-10T21:35:35Z [42906545866](https://github.com/planner77/masterGantt/actions/runs/42906545866)·[42906547841](https://github.com/planner77/masterGantt/actions/runs/42906547841), 21:43:47Z [42907842850](https://github.com/planner77/masterGantt/actions/runs/42907842850), 21:43:48Z [42907845535](https://github.com/planner77/masterGantt/actions/runs/42907845535). 네 Run 모두 `event=issue_comment`, completed/skipped.
- 기대: 신규 PR/원격 CI/Trusted/Finalizer를 사용하지 않고 진행 기록을 유지. 실제: 원격 Finalizer Run 4건이 간접 생성됨. skipped를 로컬 테스트·QA·게시 PASS로 사용하지 않는다. 원본 Run/실패는 삭제하지 않는다.
- 판정: 운영 순서 FAIL. User commentary에 오류를 인정했다. 기존 '원격 변경 전'은 수동 dispatch/Push/게시 미수행 범위였으며 세션 전체 Run 미생성 주장은 이 기록으로 정정한다.
- 교정: 이미 명시적으로 승인받은 #911 최소 관리자 전환 중 Actions disabled를 우선 적용하여 후속 Issue 댓글/schedule 자동 생성을 차단한다. Ruleset PR/Required Check 제거는 로컬 검증 뒤 별도 실행한다. 새 Run 취소/삭제나 과거 결론 변경은 하지 않는다.
- 후속: Actions disabled/API 재조회, 실행 중/대기 0건 및 비활성화 이후·첫 Push 이후 신규 Run 0건을 별도 측정한다. 교정 전 네 skipped Run은 전체 세션 합계에 계속 포함한다.
- 재실행/복구 상태: NOT TESTED(추후 실제 관리자 전환 근거는 Owner Issue 댓글에 추가). 운영 DB/실서버 배포 변경 없음.

## F906-005 · OPERATION / Actions 비활성 응답 비교 — FAIL(관측 assertion)

- Owner 위임 아래 `PUT /repos/planner77/masterGantt/actions/permissions`에 `enabled:false` 한 필드만 전송했다. PUT은 성공하고 GET에서 `enabled=false`, `sha_pinning_required=false`를 확인했다.
- 관측 assertion 첫 실행은 exit `1`: 비활성 상태 GET 응답이 `allowed_actions`를 생략했는데 원래 `all`과 동일 필드 비교를 요구해 잘못 실패했다. 설정 변경 실패나 Actions 재활성화가 아니다.
- 교정: 비활성화의 실제 `enabled=false` 및 변하지 않은 sha_pinning_required를 확인하고, 생략된 허용 범위 설정은 보존한 원본 snapshot/복원 payload로 유지한다. 재활성화·반복 PUT 없이 read-only 재조회한다.
- 실제 시각/최종 후조건: operations snapshot을 통해 Owner Issue 댓글에 연결한다. running/queued·Ruleset 불변 및 비활성 이후 신규 Run 검증은 각각 실제 결과로 기록한다. 응답 omission과 설정 실패를 혼동하지 않는다.

## V906-003 · F906-004/F906-005 교정 / Actions 비활성 — PASS

- actor `planner77`, 2026-11-10T21:47:56.437194Z 시작, repository Actions permissions PUT HTTP `204`. payload는 `enabled:false` 한 필드다.
- 21:48:14.890085Z 및 21:48:42Z 실제 readback `enabled=false`; running `0` / queued `0`, 비활성화 이후 신규 Run `0`건.
- ruleset `24043042`의 전체 JSON은 변경 전 snapshot과 동일하다. PR/Required Check 제거는 아직 실행하지 않았다. main/태그/GHCR·운영 서비스 변경 없음.
- `.prepr-reports/operations-906-908/actions-immediate-{before,after}.json`, ruleset-after-actions-only/runs-after-actions-disabled 등 원본은 ignored에 보존한다. 비활성 이전 네 skipped Run과 F906-005 최초 assertion FAIL은 남긴다.
- 증거 범위: Actions 비활성+즉시 후조건만 PASS. 코드 로컬 검증·직접 Push·게시·운영 복원/배포 PASS로 확대하지 않는다.

## R906-001 · 로컬 Gate 설계 검토 / Next 생성 메타데이터

- 정적 근거: 설치 Next의 `node_modules/next/dist/lib/typescript/writeAppTypeDeclarations.js`와 distDir/TypeScript 공식 동봉 문서. distDir에 따른 선언 import 자동 쓰기와 E2E isolated-application의 새 출력 경로를 확인했다.
- 위험: fast `.next-prepr` 및 browser `.next-e2e[-isolated-*]`가 tracked next-env/tsconfig를 변경해 sourceStable=false를 만들 수 있다. 아직 실행되지 않은 검사를 FAIL/PASS로 기록하지 않는다.
- 교정 설계: fast는 표준 `.next`; browser는 원본과 byte 일치하는 clean exact-head snapshot에서 실행하고 허용된 Next 생성 선언/include만 엄격히 검증·기록. 원본 source는 변경하거나 자동 복원하지 않는다.
- 영향: 새 prepr-snapshot helper/unit 및 기존 gantt-demo 3case Chromium을 직접 소비자로 추가. 초기 정책 31case·gate 38case 빠른 PASS는 이 보완 이후 최종 source의 PASS가 아니다.
- actual implementation/helper/Chromium/sourceStable 결과: NOT TESTED. 최종 고정 commit과 정제된 Owner Issue 증거에 연결한다.

## S906-001 · Owner 범위 결정 / #907 통합

초기 입력의 중복 #906을 같은 이슈로 해석했으나, #908의 #907 선행을 확인해 질문했고 Owner가 `#906·#907·#908 통합 처리`를 명시 응답했다. 이에 #907 원장·기계 회귀 인덱스·로컬 검증기를 같은 구현/검증/게시 단위로 포함한다. 기존 실패/초기 해석 기록은 보존한다. [#907 원장](ISSUE_907_FAILURE_ANALYSIS.md)에 구현·직접 검증을 연결한다.

#907 전체 구현·검증 전에는 #908 종료를 허용하지 않는다. 이미 승인된 고유 SHA GHCR 게시와 수동 종료 범위 외에 SemVer/rolling tag·운영 배포·기존 PR 처리를 추가하지 않는다.

## F906-006 · UNIT / Browser snapshot 의존성 공유 — FAIL

- 원본: 새 snapshot helper의 focused run, `tests/scripts/prepr-verifier.test.ts` + `tests/scripts/prepr-snapshot.test.ts`. 실행 명령/exit은 담당 Agent 결과와 최종 Issue 근거에 연결하며 로컬 원문 `/tmp/mastergantt-908-recovery-focused.log`를 보존한다.
- 실제 결과: 2files/48tests, 42 PASS / 6 FAIL, Vitest 시작 표시 06:59:07 KST(2026-11-10 21:59:07 UTC), duration 7.71s. 별도 typecheck PASS는 이 실패를 대체하지 않는다.
- source: baseline/head `4aad8865972e3446f0d34c7ffcfd2bbab439e366` 위의 작업 중 변경. 당시 전체 working fingerprint는 NOT CAPTURED이며 이를 최종 exact commit의 결과로 전용하지 않는다.
- 최초 원인: snapshot root의 node_modules를 symlink로 공유해 baseline `.gitignore`의 directory-only `node_modules/` 규칙에서 제외되지 않았다. sourceEvidence가 untracked source symlink를 정확히 BLOCKED했고 정상 snapshot 생성 양성 6case가 실패했다. 제품 API/DB 동작 실패가 아니다.
- 기대/실제: 원본과 byte 일치하는 clean source snapshot 기대 / 공유 의존 경로가 source inventory에 들어와 source guard 거부.
- 교정: snapshot에 실제 node_modules 디렉터리를 만들고 그 안의 고정 설치 entry만 원본과 공유한다. source guard·exact HEAD/input identity를 완화하거나 원본 파일을 복원해 PASS하지 않는다.
- 후속 검증: NOT TESTED. 수정 이후 실제 재실행과 최종 snapshot/Chromium/sourceStable는 새 결과로 추가하며 최초 6FAIL 기록을 지우지 않는다.
- 영향: #908 snapshot isolation·runner 경로 귀속, #907 회귀 탐색 인덱스/원본 실패 보존.

## V906-004 · F906-006 교정 후 focused 재실행 — PASS

- 원본 실제 명령 확정: `npm test -- tests/scripts/prepr-verifier.test.ts tests/scripts/prepr-snapshot.test.ts`, 첫 exit1/42PASS·6FAIL 원문 유지.
- 같은 명령 재실행: 2026-11-10T22:00:33Z(07:00:33 KST), exit `0`, 2files/48tests 전부 PASS, duration 7.74s. `prepr-verifier` 41개와 snapshot helper 7개다.
- 교정: 실제 node_modules 디렉터리 내부에서 설치 entry만 공유하여 source 검증을 유지했다. 신규 helper 양성·임의 코드/config·fixture 변화·경로/입력 provenance 음성을 함께 실행했다.
- 근거: `/tmp/mastergantt-908-recovery-focused-r2.log` 로컬 원문. 작업 중 동일 명령 재실행 PASS이며 아직 전체 최종 commit 공통/Chromium/Docker/admission·독립 QA·게시 PASS가 아니다.

## F906-007 · DOCKER / 합성 exporter 호환 실험 — FAIL

- scope: SYNTHETIC_TOOLCHAIN_ONLY_NOT_PROJECT_SOURCE. 실제 제품 후보를 두 번 빌드한 것이 아니라 별도 clean Git fixture로 exporter 기능을 확인했다. fixture SHA `20dcb599745261dbcf5e27f227cb2d25ed3a578a`, content SHA256 `471f530027fafa82feb66f61c9e6c619fd58af8225fc23162a7bba7d0029fe4f`.
- 실행: `node .prepr-reports/operations-906-908/run-oci-probe.mjs`의 내부 Docker buildx 명령. pinned BuildKit/scanner·linux/amd64·provenance=max·SBOM으로 OCI와 Docker exporter를 한 solve에 요청했다. 전체 실제 argv/exit/시각은 ignored `oci-probe-result.json`과 step log에 보존한다.
- 실제: 2026-11-10T22:10:50.398Z~22:11:27.869Z. builder create exit0, build 22:10:50.616Z~22:11:27.356Z exit `1`: `docker exporter does not currently support exporting manifest lists`. 자기 builder cleanup exit0.
- 기대/실제: attested OCI와 runtime Docker image의 같은-build 동시 출력 기대 / classic Docker exporter가 attestation 포함 manifest list를 지원하지 않아 거부. 애플리케이션 API/DB FAIL 또는 GHCR 게시 실패가 아니다. 실제 registry write는 0건이다.
- 교정 설계: 단일 build는 SBOM/provenance가 포함된 OCI만 출력하고, 검증된 runtime child/config/layers를 오프라인 Docker-load 포장으로 옮긴다. 재빌드·레이어 의미 변경 없이 config ID와 uncompressed layer diffID·순서를 대조한다. 전체 원본 OCI bytes/index/attestations는 유지하여 같은 OCI를 게시한다.
- 경계: 압축 해제/파일 크기 상한·경로/덮기/미지원 media type 거부, archive 비실행·자기 출력 정리. Build-once를 지원한다고 가정한 최초 오류를 숨기거나 attestation 없는 이미지를 PASS로 대체하지 않는다.
- 교정 후 실제 probe/ORAS 로컬 copy·최종 제품 candidate build/API/SQLite/registry digest smoke: NOT TESTED. 후속 실행 결과를 별도 추가한다.

## F906-008 · STATIC / #907 합성 테스트 타입 — FAIL

- 원본 명령: `npm run typecheck` → exit `2`, `/tmp/mastergantt-907-typecheck.log`. 개별 실행 시각은 NOT CAPTURED다. 같은 변경을 본 통합 Gate typecheck도 `/tmp/mastergantt-908-recovery-freeze-typecheck.log`에서 같은 오류를 관측했으며 별도 원인으로 중복 산정하지 않는다.
- source: 기준 Head `4aad8865972e3446f0d34c7ffcfd2bbab439e366` 위의 uncommitted #907 테스트 구현. 당시 working fingerprint는 NOT CAPTURED이며 최종 exact commit 결과가 아니다.
- 최초 원인: `tests/scripts/issue-ledger-verifier.test.ts`의 synthetic fixture `fixSourceSha:null`이 너무 좁은 타입으로 추론되어 나중 수정 event의 string SHA를 넘길 때 TS2345가 발생했다. 실제 원장 validator 제품 실행 실패나 DB/API 실패가 아니다.
- 근거 범위: 당시 #907 직접 21tests와 validator의 3issues/7failures/12events 검산은 PASS였으나 TypeScript FAIL을 대체하지 않는다. 별도 Gate 직접 3files/71tests PASS 역시 이 전역 typecheck의 PASS가 아니다.
- 교정: 합성 event fixture의 타입을 계약에 맞게 명시하고 같은 typecheck·직접 양성/음성 테스트를 다시 실행한다. 단언·tsconfig·검증 강도를 낮추지 않는다.
- 재실행: NOT TESTED(후속 실제 결과 추가). 최종 공통 Gate의 typecheck 미통과 시 Push/Publish/Close는 계속 BLOCKED다.
- 영향: #907 source/fix provenance·FAIL→PASS append history fixture와 전체 로컬 필수 TypeScript Gate.

## F906-009 · DOCKER / 실제 provenance v1 검증 호환 — BLOCKED

- scope: 합성 toolchain fixture `20dcb599745261dbcf5e27f227cb2d25ed3a578a`이며 제품 후보 source가 아니다. R02 전체 2026-11-10T22:16:09.724Z~22:17:04.141Z, 단일 OCI build 22:16:10.077Z~22:17:02.834Z exit `0`.
- 실제: SBOM/provenance가 포함된 OCI build와 기존 offline OCI verifier는 PASS였으나 추가 predicate wrapper가 실제 BuildKit provenance v1의 buildType을 v0.2의 예전 URI로만 비교해 BLOCKED했다. Docker build FAIL이나 registry 게시 FAIL로 바꾸지 않는다. registry write 0건.
- 원인: v1의 `https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md`를 legacy `https://mobyproject.org/buildkit@v1`와 혼동한 버전 호환 결함. [공식 Docker SLSA 정의](https://docs.docker.com/build/metadata/attestations/slsa-definitions/)로 확인했다.
- 교정: predicateType별 알려진 v0.2/v1의 정확한 buildType·구조를 분기 검증하고 미지원 URI는 계속 거부한다. 단순히 type 검증을 제거하거나 가짜 predicate를 만들지 않는다.
- 후속 검증: 이미 생성된 동일 R02 OCI archive/index/attestations를 재빌드 없이 재검산·runtime import·ORAS 로컬 copy로 검사한다. 실제 artifact digest와 결과는 operations 근거에 연결한다. 아직 최종 제품 source/게시 PASS가 아니다.
- 재실행/동일 object proof: NOT TESTED. 원본 R02 실패·OCI는 ignored 로컬 증거에 보존하고 후속 결과를 별도 추가한다.

## V906-005 · F906-008 타입 교정 / #907 집중 검증 — PASS

- `tests/scripts/issue-ledger-verifier.test.ts` 합성 event 타입을 계약에 맞게 명시했다. typecheck r3 exit `0`, `/tmp/mastergantt-907-typecheck-r3.log`; 실제 원본 typecheck exit2는 보존한다.
- 구현 Agent 직접 테스트: 1file/22tests PASS, 455ms. ESLint 3files/Markdown454/diff 검사 PASS. validator의 당시 3issues/9failures/15events PASS는 구조·이력 검산이며 `publicationEvidence=false`다.
- 독립 qa_docs `/root/qa_recovery`: `npm test -- tests/scripts/issue-ledger-verifier.test.ts --maxWorkers=2` exit0, 22tests/426ms 실제 재실행. core SHA256 `a028d861541cc6bd5f5363a01b0eb9415c94746836adc59b4f41f655119e9974`, CLI `73908d1cda8e92fd6617ad4a4bc3b7951142dedac0b9695f6afb858dab19d42a`, test `0f0b7ba2db85b66fc7ce12f52606f796898381f29fd37a88af07c10b25569c77`.
- 증거 범위: 실제 원본/prefix·중복/경로/상태/provenance·합성 cycle 검증이다. 최종 whole-source Gate·실제 GHCR/운영 복원 PASS가 아니다.

## F906-010 · DOCKER / ORAS 로컬 copy 후조건 — FAIL → PASS

- scope: 같은 합성 R02 OCI의 로컬 copy 호환 실험이며 원격 registry write 0건이다. 공식 checksum 검증한 ORAS v1.3.6을 사용했다.
- 최초 후조건: 2026-11-10T22:19:42.777Z~22:19:42.881Z. ORAS 3개 명령은 모두 exit `0`이었지만 layout index에 root descriptor 1개만 있을 것이라는 후조건 assertion이 FAIL했다. 실제로 untagged child 2개도 등록됐으며 OCI root graph 자체가 변조된 것이 아니다.
- 근거: ignored `oras-local-probe-r01-result.json`에 원본 commands/exit/시각·첫 실패를 보존한다. command 성공과 assertion 실패를 분리한다.
- 교정: 같은 copy 결과에서 named root 1개의 정확 digest와 전체 참조 blob byte 동일성을 확인한다. 새 copy·build·원격 게시로 원본 실패를 덮지 않는다.
- 재검산: 2026-11-10T22:20:22.674Z~22:20:22.797Z PASS. 전체 blob 11개의 bytes와 descriptor 동일성 확인. 실제 제품 registry digest Pull/Smoke는 아직 NOT TESTED다.

## V906-006 · F906-007/F906-009 교정 / 동일 합성 OCI 검증 — PASS

- R02의 이미 생성된 동일 OCI를 재빌드하지 않고 version별 predicate 검증 → bounded runtime 재포장 → Docker load → config ID/rootfs diffID·순서 검산 → non-root Node v26.8.2 실행까지 PASS했다. 실제 Project/Task API/SQLite 검사는 아직 제품 candidate 단계에서 수행해야 한다.
- fixture source `20dcb599745261dbcf5e27f227cb2d25ed3a578a`, OCI index `sha256:70d0d82fe573ba17b6c167aea4be5920a4199c9d5f0cbfad276531739d60ab25`, archive SHA256 `23774ebd4daf6192ba324968f7b6f3829dd17503a207939611d794b9ac693588`, runtime config `sha256:38fe6d084540d6f1284ba56cdc36d68ee073f8a5e2c2aadc1d715c874212b644`.
- 같은 원본 tar@digest의 ORAS 로컬 OCI copy/graph 보존도 F906-010 교정 후 PASS했다. 실제 provenance+SBOM을 보존하며 classic store가 attestation을 보유한다고 주장하지 않는다.
- 자기 probe image tag는 exact ID 확인 후 2026-11-10T22:20:56Z 삭제 exit0. 원본 OCI·최초 실패·교정 증거는 ignored에 남겼다. 제품 candidate build/registry write는 0건이며 이 결과를 제품 최종 PASS로 전용하지 않는다.

## F906-011 · STATIC / 보존 문서 EOF whitespace — FAIL

- 최초 명령: `git add --all && git diff --cached --stat && git diff --cached --check`, exit `2`. 기존 untracked archive는 unstaged diff 검사 대상이 아니었고 staging 뒤 보존 문서 4개의 `new blank line at EOF`가 처음 확인됐다.
- 대상: history의 AGENT_PROMPTS/GENERIC_RELEASE_FINALIZER/ROOT_README/SECURITY_SUPPLY_CHAIN. 원본에 있던 trailing blank를 보존한 결과이며 실행 코드·요구사항 오류가 아니다.
- 최초 wrapper 보완 스크립트는 비ASCII bytes literal로 Python SyntaxError가 발생했고 파일 변경 없이 중단됐다. 문자열을 UTF-8 encode하도록 교정해 재실행했다. 이 오류도 보완 과정의 원문에 남긴다.
- 교정: 원문을 trim/삭제하지 않고 archive wrapper의 '원본 보존 본문 끝' 주석을 뒤에 추가했다. 이전 archive의 모든 byte가 그대로 prefix임을 검산하고 전후 SHA256을 ignored `archive-footer-fix.json`에 보존했다. 원본 SHA256 inventory와 원문은 변경하지 않았다.
- 교정 검증: restage 후 `git diff --cached --check`와 Markdown 링크를 실제 재실행해 결과를 추가한다. 최종 제품 Gate/게시와는 별개다.

## V906-007 · F906-011 교정 재검산 — PASS

`git add --all && git diff --cached --check && node scripts/check-markdown-links.mjs` 재실행 exit `0`, Markdown454파일 검산 PASS. 네 archive의 원문 byte 보존은 주석 footer 추가 전후 prefix/hash 검산으로 확인했다. whitespace 검사 옵션·Gate를 약화하거나 원문을 trim하지 않았다. 이후 final candidate commit과 공통 검증은 별도다.

## F906-012 · UNIT / 첫 exact candidate 전체 회귀 — FAIL

- candidate Head `0671bb72d2ac99cddc31f0ba6ec22e55c8883e76`, base `4aad8865972e3446f0d34c7ffcfd2bbab439e366`, 제품0.145.1. 전체 fast 2026-11-10T22:27:44.193Z~22:30:05.405Z, 최종 exit `1`.
- 실제 명령: `npm run verify:prepr -- --mode=fast --base=4aad8865972e3446f0d34c7ffcfd2bbab439e366 --issue=906 --risk=HIGH --report-dir=.prepr-reports/final-fast-0671bb72`. Unit 내부는 `npm test -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=<해당 reportDir>/vitest-results.json`.
- 선행 Version/discovery/Markdown/원장/dependency/typecheck/lint PASS. lint 0errors/21warnings. Unit 315files 중313PASS/1FAIL/1SKIP, 3905tests 중3901PASS/1FAIL/3SKIP. Unit duration87.308s, runner표시86.91s. production build·Chromium·candidate Docker·Publish는 미실행/NOT TESTED다.
- 실제 실패: `tests/scripts/pr-batch-verifier.test.ts:106`, `Issue #679 — committed batch identity and read-only evidence > preserves multiple code/test/docs edits, deletion and exact tree without publishing content`. 같은 tree의 manifest.sourceFingerprint와 강화된 sourceEvidence의 지문 비교 불일치. 기존 consumer와 source fingerprint 계약 결속을 조사·교정하며 equality나 tree/삭제/path/읽기전용 단언을 삭제·완화하지 않는다.
- source fingerprint `af55f00b26fc9ce39e1994eb762f41d8eb8ed105992cc7d370ec5e6a3b99c1c8`, content SHA256 `b4638906a9a5ca7ad8f7c41f28fd53a637edd2da713f3d5b2b649a8438c56850`, 환경 fingerprint `add634d41fc4e1fe3eef4d091486b028e3f468a95fc02b1d6cd6fa51ee9c2726`. sourceStable=true/environmentStable=true이므로 실행 중 오염으로 실패한 것이 아니다.
- 원본 report integrity SHA256 `9bd661531476f3c02fdb5438606a66f77d3dbff9ff375f5e7fe15d0d373d7c71`, raw JSON/runner/log는 ignored reportDir 및 `/tmp/mastergantt-906-final-fast-0671bb72.log`에 보존한다. 최초 FAIL은 이후 새 Head PASS로 덮지 않는다.
- 판정: REWORK; Push/Publish/Close BLOCKED. legacy batch 도구도 기존 테스트를 보존하고 공유 source 계약과 정합화한다. source 변경 뒤 새 commit으로 공통 전체·영향·Docker/admission/QA를 다시 실행한다.

## D906-001 · F906-012 검토 결정 / 역사적 v1과 현행 v2 분리

별도 qa_docs와 Manager가 원본 코드를 대조했다. 퇴역 batch manifest는 schema v1의 `(baseSha, head)` 지문을 유지하지만 #908 sourceEvidence는 실제 content/index를 포함하는 현행 v2다. 옛 테스트의 두 버전 동치 가정이 깨졌으며, 제품 source 오염이 아니다.

v1의 런타임/기존 영수증/Git 안전 wrapper를 바꾸거나 v2를 약화하지 않는다. 기존 테스트는 v1 schema와 문서화된 v1 hash 계약을 정확히 검증하고 현행 content/index v2와 다름을 음성으로 검사하도록 정합화한다. tree/head/삭제/path/읽기전용 및 나머지43개 보호 검사는 보존한다. sourceEvidence에 새 Git callback/API를 확장하는 안은 구현하지 않는다. 교정의 실제 집중 재실행과 새 candidate 전체 Gate 결과는 후속 증거로 구분한다.

## D906-002 · 필요한 소비자와 기존 opt-in benchmark 구분

첫 전체 Unit JSON에는 기존 `tests/server/projects/task-dependency-performance.test.ts`의 opt-in 5000Task benchmark 3개가 SKIP로 보고됐다. 이 검증기는 전체 파일 inventory와 필수 소비자의 실제 통과를 구분해야 한다. 전체 npm Unit 명령/발견 파일은 유지하고 모든 발견 파일의 runner 결과 존재를 검사한다. 실제 passed>0 요구는 영향/명시 include된 필수 소비자에 적용하며 skip-only는 coveredTests나 PASS로 바꾸지 않는다. 필요한 소비자가 skip-only이거나 보고에서 누락되면 계속 BLOCKED다.

이는 새 skip/제외·timeout 변경이 아니다. 이번 tooling 변경과 무관한 opt-in benchmark는 NOT TESTED로 분리하고 기존3SKIP는 그대로 보고한다. parser 교정·양성/음성 회귀와 새 source의 전체 실행은 실제 결과를 추가한다.

## D906-003 · 기존 opt-in 예외의 범위 고정

D906-002의 inventory/필수 소비자 구분을 실제 관측된 범위로 좁혔다. 공통 Unit의 모든 일반 파일은 실제 pass를 요구한다. 예외는 `tests/server/projects/task-dependency-performance.test.ts`의 기존 default3SKIP이며 `RUN_TASK_DEPENDENCY_BENCHMARK !== "1"`·해당 파일 unselected일 때만 NOT TESTED로 보존한다. selected/명시 include·다른 skip-only·잘못된 skip 개수·파일 누락은 계속 BLOCKED다. 항상 실행되는 correctness fixture `task-dependency-edit.test.ts`는 예외가 아니다. 제품 테스트·opt-in 조건·timeout·skip는 변경하지 않는다.

## V906-008 · F906-012 계약 교정 집중 재실행 — PASS

- legacy v1 manifest/runtime는 그대로 두고 v1 schema/hash와 현행 content/index v2의 구별을 검증했다. 기존44case와 tree/head/삭제/읽기전용 단언을 보존했다.
- 실제 집중 검증: 2026-11-10T22:39:12Z 시작, 3files/95tests(legacy44+Gate43+snapshot8) PASS, duration7.76s, exit0. typecheck/ESLint/구문/diff 검사 PASS. 이 값은 작업 중 교정 집중 실행이며 새 exact commit의 전체 Unit PASS가 아니다.
- runner 분기는 일반 전체 Unit inventory/pass를 유지하고 미선정된 기존 benchmark의 정확3SKIP만 NOT TESTED로 보존한다. 잘못된 skip/개수/환경활성/선정/include/보고누락의 음성 회귀를 통과했다. benchmark 자체/skip/timeout은 수정하지 않았다.
- 다음: 새 commit에서 공통 fast 전체·Chromium·Docker/admit와 독립 QA를 다시 확인한다. 기존 candidate0671bb72의3905중1FAIL은 원본으로 유지한다. 최종 exact SHA/원격 Push·image digest/실행 결과는 Owner Issue 댓글에 append하여 이 원장에 연결한다.
