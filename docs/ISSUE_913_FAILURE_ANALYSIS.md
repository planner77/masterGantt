# Issue #913 운영 배포 누적 실패·검증 원장

## 범위·출처와 공개 경계

Owner의 실제 운영 배포 요청에 따라 검증된 app source `8e29fe828a3a8b5fb5b8dc46b82b74722bae33fe`·version0.145.1·exact digest `sha256:8ebd91b4f6b316c3bdc9a221e5a8ee9d50a3fb4fb845c2ebf140e44ac50292d1`를 적용했다. 착수 시 documentation main은 `64e25de3abe105901761a39ca82b2f2269aea23b`다. 앱 재빌드·SemVer/rolling tag 변경·새 제품 기능은 범위 밖이다. [Issue 계획](https://github.com/planner77/masterGantt/issues/913), [원장 계약](ISSUE_LEDGER.md), [기계 인덱스](REGRESSION_INDEX.json)를 연결한다.

이 원장은 append-only이며 #913을 새 Primary로 둔다. 기존 #906/#907/#908 원장·19개 실패·42events를 변경하지 않는다. 비공개 원본 DB·환경·내부 주소·비밀번호·키·쿠키·로그·원래 project/volume/port/network 명칭은 공개하지 않는다. 실제 argv는 private 원본에 보존하고 아래 placeholder는 의도적인 정제임을 명시한다. 공개 댓글과 명시 허용된 sanitized summary만 읽었으며 다른 private DB/env/log/원본 receipt는 열지 않았다.

## F913-001 · RESTORE / 첫 격리 clone 네트워크 — BLOCKED(wrapper FAIL)

- 최초 정제 명령: `node <private-runner>/run-restore-rehearsal.private.mjs <private-evidence-dir>`. 실제09:03:20.770Z~09:03:20.788Z(2026-11-11), wrapper exit1/FAIL. 원문 오류는 `BLOCKED: smoke의 단일 published port를 확인하지 못했습니다.`이며 작업 분류는 환경 BLOCKED다. 이를 성공이나 API/DB 결함으로 바꾸지 않는다.
- Docker internal network에 published port가 생성되지 않아 strict loopback endpoint 검사에서 차단됐다. API/업무 DB mutation 전에 중단했고 운영 서비스/DB/설정 변경은0이었다. 첫 restore-rehearsal 원본은 private에 그대로 보존한다. [공개 EXCEPTION](https://github.com/planner77/masterGantt/issues/913#issuecomment-6791731783).
- 해당 시점 운영 source는 `90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`, rollback digest `sha256:7c8e3ed6ed8b78ab8d5832fa2b225cf3f160e1c8e5b044963330e78eb26dc866`다. target8e29와 SQL38개 파일·migration ledger38·schema checksum이 동일하고 pending/변경/삭제 migration0이었다. 사전 readonly integrity=ok/FK0/WAL을 확인했다.
- 앞선 SQLite Online Backup·접근 통제·AES256-GPG 암호화/복호화 byte 검증은 PASS. opaque backup ID `mg-20261111T085745Z-cd8da054`와 호환 old image를 결속했다. 실제 backup·키·원시 data fingerprint는 Git에 넣지 않는다.
- 교정은 자기 소유 복원 clone만 일반 bridge·검증된 loopback 동적 매핑·별도 복원 volume으로 재생성하는 것이다. 운영 network/volume/container는 이 단계에서 변경하지 않았고, Origin/session/revision·주소/identity guard를 제거하지 않았다.

## 후속 R02 · 같은 backup의 격리 복원 실제 검증 — PASS

- 같은 정제 argv의 R02는2026-11-11T09:06:09.374Z~09:06:11.824Z,exit0였다. 실제 환경/Origin 값은 비공개로 유지했다. redirect를 따르지 않는 검증된 loopback 요청만 수행했다. [복원/사전 QA 근거](https://github.com/planner77/masterGantt/issues/913#issuecomment-6791875917).
- backup·격리 복원본·target startup의73개 table identity·schema·ledger38이 동일하고 integrity=ok/FK0였다. 실제 Cookie·401/403/412·Project/Task 쓰기·JSON export·restart persistence는 복원 clone에만 실행해 PASS했다. 이 시점 운영 쓰기/stop/설정 변경은0이었다.
- 독립 qa_docs는 이 단계의 복호화/암호문·접근 권한(파일0600/디렉터리0700)·data/ledger·clone API/restart·14개 env 보존을 직접 대조했다. 여기의 사전 QA PASS와 뒤의 최종 운영 QA 판정은 구분한다. 원본 R01을 R02 성공으로 삭제하거나 소급 PASS하지 않는다.

## 실제 운영 교체 · DEPLOYED_VERIFIED 관측 — PASS

- 정제된 실제 운영 runner: `python3 <private-runner>/execute-stage2.private.py <private-evidence-dir>`,2026-11-11T09:15:36.375506Z~09:15:42.309742Z,exit0. [공개 운영 STATUS](https://github.com/planner77/masterGantt/issues/913#issuecomment-6791954696), 명시 허용된 deployment-sanitized-summary 근거다.
- actual stop argv는 `docker compose --project-name <existing-project> --project-directory <existing-workdir> --file <existing-compose> --env-file <existing-env> stop app`,09:15:36.459448Z~09:15:36.947210Z,exit0. 같은 prefix의 `up -d --no-build --pull never --no-deps --force-recreate --scale app=1 app`은09:15:37.564406Z~09:15:37.929756Z,exit0였다. placeholder는 private 식별자를 정제했으며 원래 argv는 비공개 receipt에 있다.
- clean stop 관측09:15:36.947326Z→target healthy09:15:42.022010Z, 관측 중단5.074684초. 추가 production restart는 하지 않았다. 중단 전 확인한 exact digest cache를 사용했고 재빌드·tag 변경은 없다.
- stop 이후 /data 전체 일관 최종 backup ID `mg-final-20261111T091537Z-2e77d3fb`를 생성하고 AES256 암호화·복호화 roundtrip 및 full directory 보존을 확인했다. 호환 rollback image/백업은 보존했다. raw backup/암호문/키/실제 데이터는 공개하지 않는다.
- IMAGE_NAME 한 값만 영속 변경했고 기존 사용자 수정 Compose bytes·runtime env14개·동일 project/실제 named volume·ports/networks·replica1을 보존했다. actual runtime config ID `sha256:b78c505f15c114560c3f84d778dbfd97b3c0eef560ef42f4f0cc63c979d84ab3`와 source8e29·target index8ebd91…292d1이 일치했다.
- 정지 시점과 교체 후73개 table fingerprint·schema·ledger38이 모두 동일했다. integrity=ok/FK0, pending migration0, production synthetic writes0이다. 실제 row/업무 값·원시 hash-map은 공개하지 않는다.
- actual readonly 명령 `node <private-runner>/production-readonly-probe.private.mjs <private-evidence-dir> after`,09:15:42.107319Z~09:15:42.309540Z,exit0. readiness/home/참조 JS·CSS8개가200이고 Cookie 없는 current session은 readonly/noSetCookie였다. 권한·쓰기·export·restart 시험은 clone에만 실행했으므로 운영 쓰기/추가 restart PASS를 주장하지 않는다.
- 자기 복원 clone 자원 cleanup은09:16:22Z PASS로 보고됐다. 최종 독립 QA는 운영/데이터 보존 검토 결과와 cleanup 최종 검토를 구분하며, 최종 통합 QA/Manager ACCEPT·Issue 종료는 이 원장 작성 시점에 선기록하지 않는다.

## 남은 환경·문서 검증 경계

실제 HTTP 운영 배포·readonly 전송 검증은 위 source/digest/backup 범위에서 관측했다. off-host backup/restore 전체 체계(#912), 수동 browser UX, TLS/reverse proxy는 NOT TESTED다. 이번 비파괴·migration0 교체로 전체 DR/RPO/RTO 체계 완료를 주장하지 않는다. 후속 저장소 변경은 정제한 이 원장/회귀 인덱스 문서뿐이며 별도 local fast/targeted/admit·독립 QA와 일반 fast-forward Push가 필요하다. 후속 문서 SHA는 아직 모르는 값으로 두고 이미지 source8e29·digest를 바꾸거나 새 이미지를 만들지 않는다.

## 자기 소유 임시 자료 최종 정리

2026-11-11T09:20:48.551089Z 자기 소유 임시 clone/plaintext 정리 PASS를 추가 확인했다. 두 일관 암호화 backup과 접근 통제된 key(0600)는 복구용으로 보존하고 실제 운영 DB/service는 삭제·재시작하지 않았다. 이는 새 실패나 추가 배포가 아닌 기존 실행의 cleanup 완료 근거다. 키·백업 내용·원시 파일명/경로는 공개하지 않는다.
