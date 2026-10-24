# Issue #479 — PR CI 누적 실패 원장

| ID | 출처/Attempt/Head | 직접 원인 | 분석·조치 | 새 CI 검증 |
| --- | --- | --- | --- | --- |
| F-000 | PR 최초 실행 전 | 실패 확인되지 않음 | 기능·보안·DB·UI 설계와 단위 테스트 추가. 원격 Build/TypeScript/Vitest/Chromium/Docker는 NOT TESTED | PR 생성 후 시작. 사용자 요청대로 모니터링 없음 |

향후 실패(취소 포함)를 누적 보존: Run ID, Attempt, exact PR HEAD/base/test merge, 직접/파생 Job, 로그 근거, 관련 review, 패치, 새 실행 여부. 실패·미실행을 PASS로 분류하지 않고, 원인 교정 없이 단순 반복하지 않는다. Required Quality/E2E8/Docker, Trusted QA, Owner Gate, Main/GHCR/Finalizer는 불변.
