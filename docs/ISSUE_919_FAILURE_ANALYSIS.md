# Issue #919 — 0.147.0 운영 배포·UAT 원장

이전 #891/#918의 정식 게시와 구별하는 운영 기록이다. sourcef45f7c0a25960a34970005cae93bd7b55ace2831/0.147.0/indexsha256:5ac1904dac65ef88c64952b67866a84d078a39dc74bea007f254c7a5a1fa10f8을 배포했다. 실제 원시 DB/주소/환경/로그·백업/key는 PUBLIC에 보관하지 않는다. [실제 운영 기록](https://github.com/planner77/masterGantt/issues/919#issuecomment-6891968342)이 현재 상태 원본이다.

## F919-001 — host 경로 직접 접근 권한거부

첫 read-only 경로 진단에서 Docker volume의 host 파일 접근이 권한거부됐다. 소유권을 바꾸지 않고 실제 운영 container의 SQLite Online Backup API 및 Docker 경계로 일관 snapshot을 취득했다. 비필수 존재하지 않는 script경로 검색 exit2도 진단 이력으로 보존했다. 최초 실패의 정확 개별 시각은 미수집이며 제품/DB 실패나 PASS로 바꾸지 않는다.

## F919-002 — 격리 합성 비밀번호의12문자 계약 위반

첫 새 격리 복원/SQL38→39는 기존 table row를 보존했으나 신규 합성 Project 생성에서 API400/기대201이었다. 새 fixture 비밀번호가 기존12문자 한도를 넘은 HARNESS 오류다. 기존 smoke fixture의 유효 입력으로 고친 새 복원/volume에서 API/write/auth401/Origin403/stale412/export200·재시작/integrity/FK를 실제 PASS했다(08:47:40.530904Z 완료). 운영 synthetic write0, 자체 container/volume·복원 평문 제거. 최초 진단과 복원 기록은 보존한다.

## F919-003 — 최종 백업 검산 helper의 DB 경로 불일치

첫 clean stop 후 새 일관 AES 백업과 old/candidate SQL 호환 verify는 PASS했으나 별도 helper는 snapshot mount 대신 image 기본 DB 경로를 읽어 SQLITE_CANTOPEN/exit1이었다. 후보 시작·환경 변경·migration 전에 차단하고 원래0.145.1을 즉시 재개해 healthy를 확인했다. helper DB 경로를 명시해 불변 snapshot 검산을 PASS한 후 별도 실행으로 새 최종 백업부터 진행했다. 처음 실패/암호문/재개 영수증을 지우지 않았다.

## F919-004 — 임시 snapshot WAL/SHM 정리 감사 실패

배포 후 감사에서 복사본 DB 본체를 지운 뒤 남은 task-owned sidecar6개(WAL3개0byte/SHM3개32768byte)를 발견해 감사 FAIL이었다. 정확6개 임시 경로만 제거했고 운영 DB/WAL/SHM은 건드리지 않았다. 08:53:11.292227Z 후속 감사에서 평문0·격리 container/volume0·backup/key mode·사용자 Compose/미추적27파일 보존·운영 healthy를 PASS했다.

## 실제 배포와 사용자 UAT 경계

최종 실행은08:51:27.231948Z~08:51:40.771557Z PASS다. 이는 전체 검증 구간이며 정확한 HTTP 중단시간 측정이 아니다. 새 최종 backup `mg-quiesced-01470-20261115T085127Z-849f5578`의 AES·출처/신선도·old/new SQL verify 후 같은 project/volume/환경/port/network의 app1개를 exact digest로 교체했다. 운영 SQL38→39·모든 기존 table row 보존·integrity ok/FK0, 목록API200/기존 공개Project2개 읽기 및 loopback/canonical HTTP의 HTML/live/ready200을 확인했다. env의 image 선택만 지속 반영했고 사용자 파일·옛image·backup/key를 보존했다. 운영 자동 mutation/restore0이다.

receipt SHA256은9aee53b715a7dae1fed2b75415cadc3cacc9da55f19dd1517cec63155c35b887이다. Manager deployment ACCEPT, qa_method=OWNER_MANAGED_LOCAL/이번 운영 독립 Reviewer=N/A이며 #891의 실제 독립 QA와 구별한다. 사용자 “다른 항목은 문제 없음”은 그 진술 범위로 기록하고, Ctrl+휠 실패는 [#920](ISSUE_920_FAILURE_ANALYSIS.md)으로 인계한다. 전체 Owner UAT는 재확인 전 NOT TESTED/미완료이며 off-host·AT/실기기도 PASS로 표시하지 않는다.
