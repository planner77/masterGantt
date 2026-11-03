# Issue #869 — 독립 PR #872 누적 실패 원장

Primary Issue: https://github.com/planner77/masterGantt/issues/869
독립 PR: https://github.com/planner77/masterGantt/pull/872
원본 통합 PR: https://github.com/planner77/masterGantt/pull/870 (Primary #866 기록은 별도 유지)

## PR872-FULL-001 — #3480.1 Policy PATH_POLICY 위험도 FAIL (2026-11-04)

- 원본 [Full #3480.1 / Run41742966171](https://github.com/planner77/masterGantt/actions/runs/41742966171), attempt1, `pull_request` event, `.github/workflows/ci.yml`, Head `151675c8b7c3c48aa742c690f8a267ab6a1326bd`, Base `352a43e74c7b34c72d952f67783a53463f8b519d`, 결론 FAILURE.
- 직접 실패: QA Final 신뢰 경계 Job126288805856은 `보호된 CI/QA/정책 파일 변경은 HIGH 위험도 필수`; QA Preflight Job126288955622는 `PATH_POLICY: 변경 경로 기반 최소 위험도 HIGH, 현재 MEDIUM`을 보고했다. `package.json`/`package-lock.json` 버전 상향이 실행·릴리스 보호 경로로 분류됨을 base `scripts/qa_final_automated.py:risk_floor`에서 확인했다.
- PASS: Preflight의 PRIMARY_ISSUE/RISK_LEVEL(field 문법)/QA_METHOD/QA_REQUIRED/RELEASE_REQUIRED/RELEASE_AUTHORIZED/ISSUE_AC/DOCUMENTATION_SYNC. 실패는 메타 정책 충돌 하나이고 다른 Job의 Quality/E2E/Docker aggregate 실패는 구현 Job SKIPPED의 파생이다. 웹 화면·TypeScript/Playwright/SQLite/Docker 제품 동작을 실행하지 않았으므로 **NOT TESTED**.
- 보완: PR 본문과 Work Packet의 `risk_level: HIGH`로 상향하고 QA 방법 `OWNER_MANAGED`·`qa_required=true`, `release_required=true`, `release_authorized=false`를 유지. 기존 코드/E2E/Compose/DB/CI workflow/skip·retry·timeout/8Shard 설정 변경 없음.
- 새 PR CI 시작과 Head/attempt를 확인하되 결과 모니터링·병합/Main CI/GHCR/Release·Issue 종료는 수행하지 않는다. 기존 통합 PR #870의 성공/실패 이력은 새 독립 PR의 PASS 증거로 승계하지 않는다.
