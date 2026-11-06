## Issue #881 — Workspace visibility verification (2026-11-07)

기존 `tests/server/projects/project-contract-security.test.ts`, `project-service.test.ts`, `project-visibility.test.ts`, `tests/features/project-workspace-navigation.test.ts`와 E2E Project Settings/Issue/Task/navigation 테스트는 KEEP_UNIQUE. 신규 tests/server/projects/project-workspace-tabs-881.test.ts 및 tests/features/project-workspace-navigation-881.test.ts는 ADD이며 strict Boolean DTO, SQLite migration/create/Project isolation/revision CAS, hidden primary/subview/legacy restore와 re-enable을 보강한다. Full HTTP/PW/KO·EN·VI/125%/스크린리더/실제 운영 검증은 원격 CI 및 환경에서 별도로 기록하고 실행 전 NOT TESTED.

---

