# Agent configuration validation

## 2026-09-12: GitHub / CI / GHCR 담당 역할 확장

검사 기준: `main` commit `60b3c80d1bc2006a77e94787af8d85b48b6a5799`.

기존 `.codex/agents/infra.toml`에는 Docker/Compose, GitHub Actions CI, Semantic Version Release Gate, GHCR publish/digest smoke, SHA/digest pin, SBOM/provenance가 이미 포함되어 있었다. 별도 `github` 또는 `ci_cd` Agent를 추가하면 workflow와 Docker 파일의 책임이 겹치므로 기존 `infra`를 GitHub·CI/CD·GHCR의 주 담당자로 확장한다. 7개 Sub-Agent 구성과 기존 Agent ID/파일명은 유지한다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| Agent | `infra` | `infra` 유지 |
| Model | `gpt-5.6-terra` | `gpt-6-astra` |
| Effort | `medium` | `high` |
| 담당 범위 | Docker/배포 + CI/GHCR 기술 작업 | 기존 범위 + GitHub 운영 설정, Issue/PR/check 이력, CI 장애 대응, registry 권한·보관·복구 절차 |
| Sandbox / Approval | 부모 세션 상속 | 변경 없음: 부모 세션 상속 |

모델 선택은 이 프로젝트의 권한 경계, release gate, CI 의존 관계와 native runtime 호환성을 교차 검토하는 작업에 깊은 검토를 우선한 설계 판단이다. `gpt-6-astra`는 기존 Main/Scheduler에 설정된 모델 ID를 재사용한다. 특정 작업에서의 성능이나 비용 개선을 측정한 결과는 아니다. 지원 여부와 실제 적용값은 실행 환경에서 별도 확인한다.

`.codex/config.toml`의 Main 모델과 `max_concurrent_threads_per_session = 6`은 변경하지 않는다. 공식 Subagents 문서의 standalone `.codex/agents/*.toml` 형식을 유지하며 중복 `[agents.infra]` 등록이나 임의 설정 키를 추가하지 않는다. Agent의 `name`이 역할 식별 기준이다.

현재 역할 배정과 운영 절차는 `AGENTS.md` 19/20/26/28/31절 및 [GITHUB_OPERATIONS.md](GITHUB_OPERATIONS.md)를 따른다. 기존 CI/CD·release·Docker 정책은 [CI_CD.md](CI_CD.md), [DEPLOYMENT.md](DEPLOYMENT.md), [SECURITY.md](SECURITY.md), [DECISIONS.md](DECISIONS.md)를 유지한다.

### 검증 범위

- 변경한 `infra.toml`을 Python `tomllib`로 검사하여 TOML 문법, 필수 문자열 필드, `name=infra`, `model=gpt-6-astra`, `model_reasoning_effort=high`를 확인했다.
- `.codex/agents/`의 기존 7개 역할 정의와 Main 설정 경로를 확인했다. 나머지 6개 Agent TOML과 Main 설정은 이번 변경 대상이 아니다.
- 실제 Codex custom agent 실행, 모델 접근 권한/내부 적용값, OS sandbox enforcement와 network 접근은 이번 정적 검증으로 입증하지 않는다.
- 이번 작업은 역할·모델 설정과 문서 변경이다. GitHub 관리자 설정, Secrets, GHCR visibility/접근 권한 변경, image 삭제, release tag 발행 또는 운영 배포를 수행한 것으로 해석하지 않는다.
- Workflow와 Application runtime은 변경하지 않는다. 원격 CI/GHCR 실행 결과는 해당 commit의 실제 run 결과로 별도 판단한다.

### 실행 환경에서 확인할 smoke test

새 세션 또는 설정 재로드 후 Manager가 `infra`를 이름으로 선택해 읽기 전용 점검을 배정한다. 대상 repository/commit, GitHub·CI·GHCR 담당 범위, 설정에서 요청한 model/effort, 실제 환경이 제공하는 실행 metadata를 보고하도록 한다. 실제 값 조회가 불가능하면 요청값과 미확인을 구분한다. 모델을 지원하지 않으면 오류와 가용 대안을 보고하고 조용히 다른 모델로 대체하지 않는다. 이 smoke test는 release/publish 권한을 자동 부여하지 않는다.

공식 근거(확인일 2026-09-12):

- [OpenAI Subagents: standalone TOML, 모델/effort와 상속 규칙](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [OpenAI Models: Astra와 reasoning effort 선택](https://learn.chatgpt.com/docs/models)
- [OpenAI Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)

---

## 2026-09-10 Bootstrap 검증 기록 (과거 상태)

아래 내용은 당시 기록을 보존한 것이다. Application 소스 유무, 모델 표, CLI version, 동시 실행 한도와 검증 결과를 현재 세션의 상태로 간주하지 않는다. 현재 `infra` 모델/effort는 위 2026-09-12 변경과 실제 TOML이 우선한다.

확인일: 2026-09-10. 검증 대상 commit: `131f3bb`. 설정 경로 수정은 `81725bd`에 포함된다.

### 저장소 검사

- `AGENTS.md`, 최소 README, `.codex/config.toml`, 7개 Agent TOML이 존재한다.
- 원래 `.condex/`였던 경로는 이번 원격 pull에서 `.codex/`로 옮겨졌다. Manager가 설정을 임의로 교체하지 않았다.
- application source, `package.json`, lockfile, migration, Docker 실행 파일은 아직 없다. `docs/`는 이번 Bootstrap 작업에서 생성한 설계 기준선이다.
- root의 빈 `codex` 파일은 원격 commit `131f3bb`에서 삭제되었다. 이번 pull에 반영했으며 실행한 적은 없다.
- `.env`는 로컬에만 존재하고 인증값은 출력·문서화하지 않았다.

### 설정과 실제 실행의 구분

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

### 공식 자료 대조

공식 문서는 Project custom agent 위치로 `.codex/agents/`를 설명하며, standalone TOML의 이름·설명·model·effort·sandbox·developer instructions 구성을 제시한다. 현재 경로와 구조는 이에 부합한다. [OpenAI Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

현재 공식 config reference에 `agents.max_concurrent_threads_per_session`이 있으며, Main을 제외한 동시 subagent 한도다. 이 키 자체를 오류나 legacy로 판정하지 않는다. [OpenAI Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)

로컬 CLI version 출력은 `codex-cli 0.153.4`였다. 제한된 파일시스템에서 PATH alias 생성 경고가 나왔으나 version 조회는 성공했다. CLI version만으로 이 대화 실행 환경이 TOML을 적용했다고 입증할 수 없다.

### 판정 / 권장

경로 문제는 **해결**. 7개 정의 존재와 TOML syntax는 정적 검증 대상이며 결과는 [QA 기록](BOOTSTRAP_REVIEW.md)에 남긴다. 실제 프로젝트 custom agent 자동 탐색과 read-only sandbox enforcement는 새 세션에서 별도 smoke test가 필요하다. 설정의 model/effort를 임의 변경할 이유는 발견하지 못했다.
