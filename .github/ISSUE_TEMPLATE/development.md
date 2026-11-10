---
name: 개발·운영 Issue
about: 로컬 검증·직접 Push·수동 게시/종료의 단일 작업 원장
---

## 목표·배경

## 범위·비범위·선행 이슈

## 인수 기준

## 담당·파일 소유권·위험

- Manager / 구현 Agent / 문서 작성자 / 실제 Reviewer:
- 위험도와 이유(LOW/MEDIUM/HIGH는 로컬 테스트·백업/복원 강도만 결정):
- baseline main/source SHA·version:

## REUSE_REVIEW

- REUSE_DECISION / REUSE_CANDIDATES / REUSE_CONDITIONS / REUSE_OWNER_EVIDENCE:
- 관련 Regression Index/실패 원장·기존 테스트 검색:

## TEST_LIFECYCLE_REVIEW·로컬 검증

- AC→직접/인접/음성 consumer·실제 테스트/fixture:
- 공통/영향/위험별 명령·환경·source/fixture/lock digest:
- actual exit/count·selected/excluded·artifact·PASS/FAIL/BLOCKED/NOT TESTED:
- 최종 동일 source admission:

## 문서·게시·운영·종료

- required docs UPDATED 또는 N/A(reason):
- Push/GHCR 게시·SemVer/rolling·운영 배포의 각각 요청/승인 범위:
- #911 live 전환 증거·main fast-forward·GHCR exact digest smoke:
- #912 backup ID·호환 rollback digest·복원 결과(해당 시):
- 미게시/미배포·환경별 미검증·잔여 위험·Owner FINAL/위임 범위:

<!-- 모든 위험도에서 PR·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않습니다. 필수 로컬 미통과는 Push/Publish/Close를 차단합니다. PUBLIC 저장소에 운영 DB/백업·비밀값·업무 원시 자료/실화면·사내 주소를 넣지 않습니다. -->
