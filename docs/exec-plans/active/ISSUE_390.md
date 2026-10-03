# Issue #390 실행 계획 — 작업 Context Menu Copy ID

상태: CI #1536.1 실패 보완 및 최신 main 재정렬.

- latest main: `5656096f295fd003010d9581ac883dbd1eee7d03` / 0.70.2
- target: 0.71.0
- branch: `feat/issue-390-copy-task-id`
- PR: #394
- previous head: `60b3aefdeed8fd1819b996c8470f160ba139cfb6`
- previous CI: #1536.1 FAILURE
- release_required=true / release_authorized=false

## 실패 원인

신규 E2E 두 곳의 URL 정규식에 불필요한 이중 escape가 기록되어 TS1127 / invalid regular expression flag가 발생했다. TypeScript, ESLint, build, policy, Chromium 4 shards는 같은 parse 오류로 실패했고 Vitest/Docker smoke는 PASS였다.

## 보완

- URL wait를 pathname predicate로 변경해 escape 오류 제거.
- 최신 main 0.70.2 위에 #390만 재적용.
- #364 `writeTextWithCompatibility`와 legacy copy helper 재사용.
- #384 다중 선택 clipboard/selection 계약 보존.
- version 0.71.0으로 재산정.
- 새 exact head의 GitHub Actions 전체 검증을 다시 사용.
