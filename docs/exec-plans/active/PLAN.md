# 현재 실행 계획

현행 단일 단계·역할/완료 조건은 [Issue Lifecycle](../../ISSUE_LIFECYCLE.md)이다. 모든 위험도에서 로컬 검증 후 main 직접 fast-forward Push·승인된 수동 GHCR·수동 종료를 사용하며 PR·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다.

## 진행 중: #912 / #909 / #911 · 상위 #905

[통합 Work Packet](ISSUE_912_909_911.md)의 baseline은 `8eaaaaa2b7b9a24e2b4a72e7d81698217da5cf2d`, 구현 source는 `af3d72f85555722c8af81b8e99dc94a5c4f0c08f`다. 기존 SQLite/OCI·#906/#907/#908/#913 자산을 재사용해 백업/복원 CLI, 동일 OCI의 로컬 게시 CLI, 기존 PR 개별 처리와 운영 문서를 구현했다. 위험도 HIGH/AGENT_LOCAL이며 같은 source의 fast 3,970 PASS·0 FAIL·opt-in 3 SKIP, targeted 108 PASS·Chromium 4 PASS, Docker·admit PASS와 네 보고서 source/환경 일치를 확인했다. 독립 QA PASS와 [Manager ACCEPT](https://github.com/planner77/masterGantt/issues/909#issuecomment-6793714928) 이후 main을 정상 fast-forward했다. 비활성 이후 이 Push의 신규 Actions Run은 0건이다.

Owner는 기존 원본 프로젝트의 `backups/mastergantt`에 암호화 archive/manifest를 보관하도록 지정했다. key는 프로젝트 밖에 분리하고 Git/Docker context에서 백업을 제외한다. off-host 요구는 이번 범위에서 제거됐으며 NOT TESTED / N/A(Owner 범위 변경)이지 PASS가 아니다. 같은 호스트 장애 위험은 남는다. 2026-11-12 Owner는 배포 전 백업과 배포 후 문제 시 복원만 확정했다. 정기/30일/월간 연습/RPO24시간·RTO1시간 제안은 미채택으로 추가 승인 대기를 해소했다.

[기존 일곱 PR의 개별 제안](../../PR_DISPOSITIONS_911.md)은 Owner가 `제안대로 이관·개별종료`를 승인했다. Manager가 2026-11-11T10:17:59Z~10:18:31Z에 각각 댓글·미병합 종료하고 7개 CLOSED/merged=false·원본 Head 일치를 재조회했다. #395는 #914 로컬 runtime-security 재평가로, #904의 #898/#899 및 #721의 #720은 OPEN 후속으로 보존한다. #847 원격 ref 일시 누락은 actor를 추정하지 않고 10:21:16.308889Z~10:21:17.336553Z create-only 복구를 기록했으며 최종 원격 7개 ref와 local archive는 원본 Head에 있다. 제품 기능·Node base의 채택이나 merge를 수행하지 않았다.

기존 로컬 archive의 격리 복원 3단계는 2026-11-11T10:17:59.146Z~10:18:10.872Z 실제 PASS했다. current image source `8e29fe828a3a8b5fb5b8dc46b82b74722bae33fe`/digest `sha256:8ebd91b4f6b316c3bdc9a221e5a8ee9d50a3fb4fb845c2ebf140e44ac50292d1`와 rollback source `90c5a1a951c749a9690b1c83e5a74b6d122dd6e3`/digest `sha256:7c8e3ed6ed8b78ab8d5832fa2b225cf3f160e1c8e5b044963330e78eb26dc866`에서 73개 table/SQL38·ledger38·같은 volume의 합성 추가 데이터 보존과 새 volume 복원을 대조했다. 자기 리소스는 10:19:47.417Z 정리했고 운영 DB에 쓰지 않았다. 새 AES-GCM CLI의 별도 실제 volume/image 복원 R02도 10:50:12.971286Z~10:50:16.630893Z PASS했다. 도구 source는 `af3d72f85555722c8af81b8e99dc94a5c4f0c08f`, 캡처 대상 runtime은 위 `8e29fe82` source/digest이며 R01의 CANTOPEN 실패 원본은 보존한다.

새 게시 CLI는 2026-11-11T10:44:59.604Z~10:48:40.550Z 실제 PASS했다. 태그는 `sha-af3d72f85555722c8af81b8e99dc94a5c4f0c08f`, index는 `sha256:9b68d8dda46f469d5fab87843f65f8b393ad6bb2fb767cd788f19afa90f85f2f`다. 동일 OCI 복사 1회·17개 blob·exact Pull/runtime·SBOM/provenance와 게시 후 기존 6개 ref/`0.145.0` 보존을 확인했다. 새 게시 image와 실제 운영 중인 `8e29fe82` image는 구분한다.

수동 운영 launcher `~/.local/bin/mastergantt-recovery`는 10:47:32.236Z~10:47:47.572Z 활성화됐고 실제 help/AES verify와 독립 runtime 파일 100개·native hash 검증을 통과했다. 자동 timer·prune·배포 hook은 0개이며 새 정책에서도 설치하지 않는다. #909/#911은 FINAL·수동 종료를 마쳤다. #912/#905는 새 Owner 결정의 문서·원장 정합화와 최종 로컬 검증·독립 QA·정상 Push 뒤 수동 종료하며 실제 최종 상태는 각 Issue FINAL을 따른다. Actions 비활성·force/delete 보호를 유지하며 운영 재배포·SemVer/latest 변경은 수행하지 않았다. 문서 전용 후속 commit의 새 image/build는 실행 입력 불변을 근거로 N/A이며 게시 artifact source는 `af3d72f85555722c8af81b8e99dc94a5c4f0c08f`로 고정한다.

## 이전 source 기록: #906 / #907 / #908 통합 구현

[통합 Work Packet](ISSUE_906_908.md)을 따른다. 현행 정책·템플릿/Agent 지침, #907의 append-only 원장·기계 회귀 인덱스/검증기, 기존 로컬 실행기·source admission을 통합 구현했다. 실제 실행·최초 실패·교정·Push/GHCR·Owner 결정은 같은 source의 Packet/원장과 Issue 증거에 연결한다. 과거 main/PR 성공을 새 source PASS로 사용하지 않는다.

## 애플리케이션 검증·게시 근거

2026-11-11 UTC 기준 애플리케이션 source는 `8e29fe828a3a8b5fb5b8dc46b82b74722bae33fe`다. 같은 Head/base의 fast(316파일·3915 PASS/기존 opt-in 3 SKIP), targeted(196 Unit·4 Chromium PASS), Docker 10단계와 admit가 PASS했고 source/환경은 불변이다. 실제 독립 QA PASS와 HIGH 범위 Manager ACCEPT는 [#906 판정](https://github.com/planner77/masterGantt/issues/906#issuecomment-6782794390)에 연결한다.

main 일반 fast-forward Push 후 같은 OCI를 `sha-8e29fe828a3a8b5fb5b8dc46b82b74722bae33fe`로 게시했다. 검증한 registry root index는 `sha256:8ebd91b4f6b316c3bdc9a221e5a8ee9d50a3fb4fb845c2ebf140e44ac50292d1`이며 exact digest 새 Pull·image policy·readiness·API/auth·재시작 persistence·native SQLite/integrity/FK smoke와 원본 OCI graph 17개 blob 대조가 PASS했다. SBOM/provenance와 기존 정상/직전 이미지·태그·권한·7개 PR·운영 서비스는 보존했다. 비활성화 전 댓글이 만든 네 skipped Run과 ORAS 첫 호출 실패 F906-019는 지우지 않는다.

이전 source 기록 당시의 후속은 **문서 전용 완료 증거 commit의 로컬 검증·fast-forward 연결과 세 Issue의 FINAL/수동 종료**였다. 이 기록만으로 CLOSED를 주장하지 않는다. 후속 commit은 실행 코드·빌드 입력을 바꾸지 않는 기록 변경이므로 새 이미지/재빌드는 N/A이며 위 애플리케이션 source·digest를 그대로 귀속한다. 최신 문서 Head와 실제 최종 gate/종료 상태는 각 Issue FINAL과 원격 main을 따른다. 운영 배포·SemVer/latest 변경은 요청 범위에 포함하지 않는다.

## 이전 source 기록의 선행과 병행

- #907: 통합 구현에 포함. [원장 계약](../../ISSUE_LEDGER.md)·[회귀 인덱스](../../REGRESSION_INDEX.md)·검증기를 실제 로컬 검사했다. 애플리케이션 source `8e29fe82` 기준 3개 Issue·18개 Failure·39개 event이며 게시 중 F906-019는 원본과 후속 기록으로 보존한다. 이후 누적 수치는 해당 source의 실제 validator 결과로 확인한다.
- #909: 이번 source의 Build-once·동일 OCI 수동 게시·exact digest smoke는 완료했으며 #909 전체 운영 플랫폼 AC/종료는 별도다.
- #911: 필요한 관리자 전환과 첫 main fast-forward Push·비활성 이후 신규 Run 0건은 실증했다. 기존 7개 PR의 개별 처리 등 나머지 AC/종료는 별도다.
- #912: 일관 백업·새 격리 volume 복원·호환 DB+image·off-host 실증. 데이터 위험 배포의 사전조건.

기존 open PR과 제품 변경은 Owner가 개별 채택/재작업/미채택을 판단하며 일괄 종료·무검증 병합하지 않는다. 이전 실행 계획 전체와 당시 승인 범위/미검증은 [보존 기록](../../history/owner-ci-retired-20261110/ACTIVE_PLAN.md)에 있다. 이전 Work Packet의 PR/CI 단계는 그 당시 기록이며 신규 재개는 현행 Lifecycle로 새 범위를 정한다.

## #913 운영 배포 결과

Owner의 명시적 운영 배포 요청으로 [#913](https://github.com/planner77/masterGantt/issues/913)에서 위 검증 이미지 source `8e29fe828a3a8b5fb5b8dc46b82b74722bae33fe`, exact digest `sha256:8ebd91b4f6b316c3bdc9a221e5a8ee9d50a3fb4fb845c2ebf140e44ac50292d1`를 적용했다. 2026-11-11T09:15:36.947326Z clean stop 후 09:15:42.022010Z healthy로 전환했고 관측 중단은 5.074684초다. SQL/ledger38 일치·pending migration0, 전후73개 table/schema/ledger 지문 동일, integrity=ok/FK0, 기존 환경14개·volume/ports/networks/project·사용자 수정 Compose 원문 보존을 검증했다. 실제 canonical HTTP readiness/HTML/정적 자산8개와 익명 readonly session도 PASS다.

SQLite Online Backup과 격리 복원·HTTP/권한/쓰기/export/restart 검증 후, clean stop 시점의 전체 `/data` 최종 암호화 백업 `mg-final-20261111T091537Z-2e77d3fb`를 보존했다. 원래 환경파일의 IMAGE_NAME만 exact digest로 영구 반영했고 추가 운영 restart·합성 데이터 쓰기는 하지 않았다. F913-001의 격리 네트워크 첫 실행 실패와 복구는 [Primary 원장](../../ISSUE_913_FAILURE_ANALYSIS.md)에 연결한다. 원시 DB/환경/백업·내부 주소/로그는 비공개다.

후속 문서 Head는 이 실행 결과의 증거 기록이며 새 이미지·재빌드는 N/A다. 문서 검증·정상 fast-forward와 독립 QA/Manager 최종 판정은 #913의 STATUS/FINAL을 따른다. 오프호스트 복원·TLS·실브라우저 수동 UX는 NOT TESTED로 남기며 #912 전체 완료를 주장하지 않는다.
