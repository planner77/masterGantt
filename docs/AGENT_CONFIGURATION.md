# Agent configuration validation

확인일: 2026-09-10. 검증 대상 commit: `131f3bb`. 설정 경로 수정은 `81725bd`에 포함된다.

## 저장소 검사

- `AGENTS.md`, 최소 README, `.codex/config.toml`, 7개 Agent TOML이 존재한다.
- 원래 `.condex/`였던 경로는 이번 원격 pull에서 `.codex/`로 옮겨졌다. Manager가 설정을 임의로 교체하지 않았다.
- application source, `package.json`, lockfile, migration, Docker 실행 파일은 아직 없다. `docs/`는 이번 Bootstrap 작업에서 생성한 설계 기준선이다.
- root의 빈 `codex` 파일은 원격 commit `131f3bb`에서 삭제되었다. 이번 pull에 반영했으며 실행한 적은 없다.
- `.env`는 로컬에만 존재하고 인증값은 출력·문서화하지 않았다.

## 설정과 실제 실행의 구분

| 역할 | TOML | Model | Effort | 명시적 Sandbox |
| --- | --- | --- | --- | --- |
| Main / Manager | `.codex/config.toml` | gpt-6-astra | high | 없음: session 정책 상속 |
| researcher | `.codex/agents/researcher.toml` | gpt-5.6-terra | medium | read-only |
| frontend | `.codex/agents/frontend.toml` | gpt-5.6-terra | medium | 없음: session 정책 상속 |
| backend | `.codex/agents/backend.toml` | gpt-5.6-sol | high | 없음: session 정책 상속 |
| scheduler | `.codex/agents/scheduler.toml` | gpt-6-astra | high | 없음: session 정책 상속 |
| excel_vba | `.codex/agents/excel-vba.toml` | gpt-5.6-sol | medium | 없음: session 정책 상속 |
| infra | `.codex/agents/infra.toml` | gpt-5.6-terra | medium | 없음: session 정책 상속 |
| qa_docs | `.codex/agents/qa-docs.toml` | gpt-5.6-sol | high | read-only |

모든 TOML을 parser로 검사하며 역할별 `developer_instructions`를 읽고 위임에 적용했다. 실제 위임 호출에는 해당 model/effort를 명시했다. 별도의 Manager Sub-Agent는 생성하지 않았다.

현재 협업 도구는 Agent별 sandbox를 지정하거나 실제 내부 model/effort를 독립 조회하는 기능을 제공하지 않는다. 따라서 model/effort는 **요청값 확인**, sandbox는 **역할의 read-only 지침 준수 확인**까지이며, TOML 자동 로드·별도 OS sandbox 강제 적용·Main의 실제 engine 설정까지 검증했다고 주장하지 않는다. researcher와 qa_docs에는 문서도 쓰지 않는 read-only 작업을 부여하고 Manager가 결과를 반영한다.

설정의 `max_concurrent_threads_per_session = 6`은 그대로 유지한다. 이 세션의 협업 한도는 Main 포함 4개이므로 동시에 전문 작업 3개 이하를 실행하고 완료 후 다음 역할로 순환한다. 설정을 바꿔 세션 한도를 늘리지 않는다.

## 공식 자료 대조

공식 문서는 Project custom agent 위치로 `.codex/agents/`를 설명하며, standalone TOML의 이름·설명·model·effort·sandbox·developer instructions 구성을 제시한다. 현재 경로와 구조는 이에 부합한다. [OpenAI Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

현재 공식 config reference에 `agents.max_concurrent_threads_per_session`이 있으며, Main을 제외한 동시 subagent 한도다. 이 키 자체를 오류나 legacy로 판정하지 않는다. [OpenAI Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)

로컬 CLI version 출력은 `codex-cli 0.153.4`였다. 제한된 파일시스템에서 PATH alias 생성 경고가 나왔으나 version 조회는 성공했다. CLI version만으로 이 대화 실행 환경이 TOML을 적용했다고 입증할 수 없다.

## 판정 / 권장

경로 문제는 **해결**. 7개 정의 존재와 TOML syntax는 정적 검증 대상이며 결과는 [QA 기록](BOOTSTRAP_REVIEW.md)에 남긴다. 실제 프로젝트 custom agent 자동 탐색과 read-only sandbox enforcement는 새 세션에서 별도 smoke test가 필요하다. 설정의 model/effort를 임의 변경할 이유는 발견하지 못했다.
