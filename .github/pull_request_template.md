## Summary

<!-- 변경 목적과 핵심 내용을 작성합니다. -->

## Related Issue

Closes #

## Changes

<!-- 주요 변경 파일/동작을 작성합니다. -->

## Local Fast Feedback

- [ ] 변경과 직접 관련된 최소 로컬 테스트를 수행했거나, 수행하지 않은 이유를 기록했습니다.
- 결과/명령:

> 로컬 전체 회귀 테스트는 기본 완료 조건이 아닙니다. 공식 회귀 검증은 GitHub Actions 결과를 사용합니다.

## GitHub Remote Validation

PR 생성 후 아래 항목은 GitHub Actions `.github/workflows/ci.yml`에서 검증합니다.

- [ ] `quality`: version check / typecheck / lint / Vitest / dependency audit / Markdown links / production build
- [ ] `e2e`: Chromium Playwright E2E
- [ ] `docker`: Docker build / image policy / fail-closed config / readiness / SQLite restart persistence

<!-- PR 작성 시 아직 실행 중이면 체크하지 않습니다. Merge 판단 시 실제 Actions 결과를 확인합니다. -->

## Environment-specific Validation

- [ ] N/A
- [ ] 별도 검증 필요: Windows Excel/VBA/DRM, reverse proxy/TLS, backup/restore, 최종 수동 UX 등
- 결과/미실행 사유:

## Documentation Updated

- [ ] 관련 문서를 갱신했습니다.
- [ ] 문서 변경이 필요하지 않습니다.

## Remaining Risks

<!-- 알려진 위험, NOT TESTED/BLOCKED 항목을 작성합니다. -->

## Main Artifact Validation

> 이 항목은 PR merge 후 `main`에서 확인합니다. PR 작성자가 사전에 PASS로 체크하지 않습니다.

- [ ] `main` quality/e2e/docker PASS
- [ ] immutable `ci-<full SHA>` GHCR publish PASS
- [ ] exact digest pull + readiness/API/auth/restart persistence smoke PASS
- [ ] SBOM/provenance 생성 확인
