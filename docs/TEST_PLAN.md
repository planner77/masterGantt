

## Issue #785 F785-002 — Zod 보안 패치와 역사 테스트 보존 (2026-10-24)

TEST_LIFECYCLE_REVIEW: 기존 `tests/scripts/prepr-verifier.test.ts` 역사 캡처·정확 Next/SRI/의존성 거부 검증을 **EXTEND**하여 Zod `4.6.7` 정확 metadata와 registry/SRI/manifest/lock/임의 버전 음성 단언 추가. 관련 3개 Gantt 캡처 소비자·Zod parser/보안/HTTP/SQLite는 **KEEP_UNIQUE**. 원본 snapshot 수정/중복 신규 E2E/skip 없음. 전체 CI Policy `npm audit --omit=dev`, Vitest, Quality/Chromium8/Docker, Trusted QA·Owner 승인 강도 불변. 다른 직접 오류 F785-001을 소급 PASS로 변경하지 않는다.

