# Issue #865 — 사내 LLM 모듈 독립 검증 계획

Source: https://github.com/planner77/masterGantt/issues/865

## 직접 단위·통합·음성 테스트

기존 #870 구현에서 `tests/server/llm/llm-config.test.ts`, `llm-client.test.ts`, `llm-boundary.test.ts`를 추출한다. 각 테스트는 원격 실제 사내 LLM을 호출하지 않으며, 등록된 2개 provider와 첫 provider의 2개 모델·override·중복/미등록·설정 기본 OFF, mock OpenAI 비스트리밍 호출·인증·error/timeout/abort, DNS 및 사설망 주소 제한·redirect/secret 비노출·비허용 모델 전송0을 검증한다. 단, 이 파일들의 존재 자체가 **독립 브랜치에서 PASS했다는 증거는 아니다**.

## 교차·배포 테스트

`npm ci`/Vitest 전체, typecheck/lint/production build, Compose runtime 전달, 기존 Project/Gantt/DB readiness·SQLite persistence, Playwright E2E8Shard와 Docker smoke를 최신 독립 Head의 공식 PR CI에서 검증한다. 운영망 사설 DNS/CA·토큰·모델 연결은 별도 환경에서 승인/검증하며 공개 URL 테스트로 대체하지 않는다.

## 회귀와 경계

`src/lib/i18n/**`와 Project Issue 화면/Gantt writer에 직접 변경 없음. CI skip/timeout/retry·Required/Trusted/Owner 게이트 완화 금지. 기존 PR #870의 같은 소스 일부에서 관측한 Quality/Unit/Docker 결과를 새 Main-based 독립 Head의 PASS로 합산하지 않는다. 실제 실행/인수 결과는 각 PR의 source SHA/run/attempt/job별로 별도 기록한다.
