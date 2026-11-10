# Agent 역할·모델 설정

실제 설정의 원본은 `.codex/config.toml`과 `.codex/agents/*.toml`이다. 설정과 실제 런타임의 모델/effort 지원·독립 실행은 다르며 실제 실행 메타데이터 없이 PASS를 주장하지 않는다. 현행 [AGENTS](../AGENTS.md)·[Issue Lifecycle](ISSUE_LIFECYCLE.md)에 따라 PR·원격 CI·Trusted QA·자동 Finalizer를 실행하지 않는다.

| 역할 | 설정 모델 / effort | 책임 |
| --- | --- | --- |
| Main/Manager | gpt-6.1-sol / high | 계획·소유권·통합·Owner 결정 연결 |
| researcher | gpt-6-luna / medium | 공식 자료 read-only 조사 |
| ui_ux | gpt-6.1-terra / medium | read-only UX 설계/구현 비교 |
| frontend | gpt-6.1-terra / medium | UI·테스트 구현 |
| backend | gpt-6.1-sol / high | API·SQLite·인증·Import/Export |
| scheduler | gpt-6.1-sol / high | pure 일정 엔진·알고리즘 검증 |
| excel_vba | gpt-6-luna / medium | 승인된 Excel/VBA 변환 |
| infra | gpt-6.1-sol / high | 로컬 build·직접 Push·GHCR·복원 운영 |
| qa_docs | gpt-6.1-sol / high | 구현자와 분리된 read-only 검토 |

read-only 역할의 `sandbox_mode`와 각 model/effort 값, `max_concurrent_threads_per_session = 6` 설정을 유지한다. 같은 파일에 여러 Write Agent를 배정하지 않는다. 실제 환경 한도가 작으면 작은 값을 따른다. 고위험 UI 공통 상태·보안·native 경합/성능은 Manager에게 Sol/high 작업별 승격을 요청하며 조용한 fallback을 하지 않는다. Astra 승격은 해당 작업의 실제 난이도/위험 근거가 있을 때만 한시적으로 선택한다.

Agent의 활성 `developer_instructions`는 로컬 테스트·same source admission·문서/원장·역할/위임 경계를 따른다. Owner 수동 종료 또는 명시적으로 위임된 Manager의 수동 API 종료는 실제 요청 범위와 모든 증거를 확인한 후 수행한다. 기계 PASS가 Owner 수용은 아니다. 한글 운영 보고·정확 SHA/digest·실패/미검증·PUBLIC 자료 경계를 보존한다.

모델 비용/벤치마크·과거 설정 정책 전문은 [보존 기록](history/owner-ci-retired-20261110/AGENT_CONFIGURATION.md)에 있다. 과거 수치가 현재 프로젝트의 비용/속도·성공률 실측은 아니다. 이번 문서·지침 정리는 모델 값 변경이나 실제 Agent runtime 성능 검증이 아니다.
