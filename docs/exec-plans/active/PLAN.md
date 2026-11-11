# 현재 실행 계획

현행 단일 단계·역할/완료 조건은 [Issue Lifecycle](../../ISSUE_LIFECYCLE.md)이다. 모든 위험도에서 로컬 검증 후 main 직접 fast-forward Push·승인된 수동 GHCR·수동 종료를 사용하며 PR·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다.

## #906 / #907 / #908 통합 구현

[통합 Work Packet](ISSUE_906_908.md)을 따른다. 현행 정책·템플릿/Agent 지침, #907의 append-only 원장·기계 회귀 인덱스/검증기, 기존 로컬 실행기·source admission을 통합 구현했다. 실제 실행·최초 실패·교정·Push/GHCR·Owner 결정은 같은 source의 Packet/원장과 Issue 증거에 연결한다. 과거 main/PR 성공을 새 source PASS로 사용하지 않는다.

## 애플리케이션 검증·게시 근거

2026-11-11 UTC 기준 애플리케이션 source는 `8e29fe828a3a8b5fb5b8dc46b82b74722bae33fe`다. 같은 Head/base의 fast(316파일·3915 PASS/기존 opt-in 3 SKIP), targeted(196 Unit·4 Chromium PASS), Docker 10단계와 admit가 PASS했고 source/환경은 불변이다. 실제 독립 QA PASS와 HIGH 범위 Manager ACCEPT는 [#906 판정](https://github.com/planner77/masterGantt/issues/906#issuecomment-6782794390)에 연결한다.

main 일반 fast-forward Push 후 같은 OCI를 `sha-8e29fe828a3a8b5fb5b8dc46b82b74722bae33fe`로 게시했다. 검증한 registry root index는 `sha256:8ebd91b4f6b316c3bdc9a221e5a8ee9d50a3fb4fb845c2ebf140e44ac50292d1`이며 exact digest 새 Pull·image policy·readiness·API/auth·재시작 persistence·native SQLite/integrity/FK smoke와 원본 OCI graph 17개 blob 대조가 PASS했다. SBOM/provenance와 기존 정상/직전 이미지·태그·권한·7개 PR·운영 서비스는 보존했다. 비활성화 전 댓글이 만든 네 skipped Run과 ORAS 첫 호출 실패 F906-019는 지우지 않는다.

현재 후속은 **문서 전용 완료 증거 commit의 로컬 검증·fast-forward 연결과 세 Issue의 FINAL/수동 종료**다. 이 기록만으로 CLOSED를 주장하지 않는다. 후속 commit은 실행 코드·빌드 입력을 바꾸지 않는 기록 변경이므로 새 이미지/재빌드는 N/A이며 위 애플리케이션 source·digest를 그대로 귀속한다. 최신 문서 Head와 실제 최종 gate/종료 상태는 각 Issue FINAL과 원격 main을 따른다. 운영 배포·SemVer/latest 변경은 요청 범위에 포함하지 않는다.

## 선행과 병행

- #907: 통합 구현에 포함. [원장 계약](../../ISSUE_LEDGER.md)·[회귀 인덱스](../../REGRESSION_INDEX.md)·검증기를 실제 로컬 검사했다. 애플리케이션 source `8e29fe82` 기준 3개 Issue·18개 Failure·39개 event이며 게시 중 F906-019는 원본과 후속 기록으로 보존한다. 이후 누적 수치는 해당 source의 실제 validator 결과로 확인한다.
- #909: 이번 source의 Build-once·동일 OCI 수동 게시·exact digest smoke는 완료했으며 #909 전체 운영 플랫폼 AC/종료는 별도다.
- #911: 필요한 관리자 전환과 첫 main fast-forward Push·비활성 이후 신규 Run 0건은 실증했다. 기존 7개 PR의 개별 처리 등 나머지 AC/종료는 별도다.
- #912: 일관 백업·새 격리 volume 복원·호환 DB+image·off-host 실증. 데이터 위험 배포의 사전조건.

기존 open PR과 제품 변경은 Owner가 개별 채택/재작업/미채택을 판단하며 일괄 종료·무검증 병합하지 않는다. 이전 실행 계획 전체와 당시 승인 범위/미검증은 [보존 기록](../../history/owner-ci-retired-20261110/ACTIVE_PLAN.md)에 있다. 이전 Work Packet의 PR/CI 단계는 그 당시 기록이며 신규 재개는 현행 Lifecycle로 새 범위를 정한다.
