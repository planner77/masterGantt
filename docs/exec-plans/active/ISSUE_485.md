# Issue #485 — Global Resource Role 단일 기준 전환

- 기준: Issue #485, `AGENTS.md`, `DESIGN.md`, `docs/ISSUE_LIFECYCLE.md`, `docs/CI_CD.md`, `docs/REMOTE_VALIDATION.md`
- branch: `feat/issue-485-global-role-source-of-truth`
- version: `0.93.0` (MINOR), `release_required=true`, `release_authorized=false`
- 종료점: PR 생성 및 exact-head PR CI 시작 확인. CI 완료/병합/release는 범위 밖.

## 결정

- Resource Catalog Global Role이 수행 역할의 단일 Source of Truth다.
- Task assignment는 Resource/Group + allocation만 저장한다. legacy `assignment_role`은 호환 컬럼으로 남기되 항상 NULL/non-authoritative다.
- Global Role 후보 필터는 유지하지만 Task별 role 값은 만들지 않는다.
- workload/Milestone/Excel role subtotal은 multi-role Resource 때문에 비가산이다. Grand Total은 assignmentId dedup을 유지한다.

## 구현 범위

- Task Editor role select/validation 제거, read-only Global Role badge 및 후보 filter 유지
- API/service/repository canonical role null 및 non-null legacy input 거부
- migration 0023으로 기존 role 값/index/guard 비권위화
- Copy/Template/Milestone/workload/Excel Global Role 전환
- REQUIREMENTS/TASK_EDITOR/API/DB/workload/Excel/TEST_PLAN/UX/CHANGELOG 동기화

## 검증

- 관련 Vitest/E2E fixture를 #485 의미로 갱신한다.
- 공식 판정은 PR exact-head GitHub Actions `quality`, `e2e`, `docker`다.
- 이 작업의 사용자 요청 종료점에서는 CI가 시작됐는지만 확인하고 결과는 `RUNNING / NOT TESTED`로 남긴다.
