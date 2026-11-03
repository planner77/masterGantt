# 사내 LLM runtime 설정과 내부 호출 (#865)

이 기능은 Node.js 서버 전용 공통 모듈이다. 공개 prompt API, 채팅/자동 번역/업무 AI 화면을 제공하지 않는다. 시작, readiness, 프로젝트 조회, 언어 변경 및 일반 Gantt 사용은 LLM 연결을 만들지 않는다. 기존 DB/서비스 가용성은 LLM endpoint 상태와 독립적이다.

## 설정

| 환경변수 | 계약 |
| --- | --- |
| `LLM_ENABLED` | 미설정/false 기본 OFF. 비활성일 때 잘못된 나머지 설정도 연결 없이 DISABLED |
| `LLM_PROVIDERS_JSON` | 비밀정보 없는 `[{"id":"internal-a","baseUrl":"https://llm-a.internal/v1","models":["model-a","model-b"]}]` |
| `LLM_DEFAULT_PROVIDER` / `LLM_DEFAULT_MODEL` | 등록된 provider/model 쌍. 동일 model ID가 타 provider에 있어도 별도 쌍 |
| `LLM_API_KEYS_JSON` | provider ID별 token JSON. **전체가 secret**이며 provider 목록과 정확히 일치해야 함 |
| `LLM_ALLOW_INSECURE_HTTP` | 기본 false. 조직이 허용한 사내 HTTP에 한해 별도 true. 웹앱 `ALLOW_INSECURE_HTTP`와 무관 |
| `LLM_ALLOW_UNAUTHENTICATED` | 기본 false. 조직이 명시적으로 인증 없는 내부 서버를 허용할 때만 true; 해당 provider의 빈 token도 명시 |

JSON 중복 키(escape된 동명 키 포함), 중복 provider/model, 잘못된 기본값·schema·URL·token 매핑은 CONFIG_INVALID다. disabled를 제외한 잘못된 enabled 값도 설정 오류다. model 목록은 운영자 등록값이며 `/models` 탐색은 하지 않는다. runtime 환경을 호출 시 읽고 build arg/NEXT_PUBLIC에는 넣지 않는다.

`.env.example`은 placeholder이며 실제 token/운영 주소를 커밋하지 않는다. Compose는 위 7개 변수를 `app.environment`에 명시적으로 전달한다. `docker compose --env-file .env -f deploy/compose.yml config --quiet`로 값 출력 없이 검사한 뒤 기존 project/volume을 유지하고 컨테이너를 재생성한다. `--env-file`만 지정해 임의 환경변수가 모두 컨테이너로 전달된다고 가정하지 않는다. config 원문과 secret JSON을 로그/Issue/CI artifact에 게시하지 않는다.

## 내부 호출

```ts
import { invokeLLM } from "@/server/llm";

// 실제 기능 호출자는 이 지점 전에 명시적 사용자 요청, Project 읽기 권한,
// 최소 전송 범위를 검증해야 한다. 공통 모듈은 업무 데이터를 조회하지 않는다.
const result = await invokeLLM({
  providerId: "internal-a",
  modelId: "model-b",
  messages: [{ role: "user", content: "승인된 최소 입력" }],
  maxTokens: 512,
  timeoutMs: 10_000,
  signal: abortController.signal,
});
```

provider/model 생략은 검증한 기본값을 사용한다. provider만 지정하면 기본 model ID가 그 provider에서도 허용되어야 하며 첫 model로 대체하지 않는다. 요청에 baseUrl/token/tools/stream/임의 옵션은 허용하지 않는다. `POST <baseUrl>/chat/completions`, `stream:false`, `model`, `messages`, `max_tokens`, 선택적 temperature만 전송한다. 다른 provider/model로 fallback하거나 재시도하지 않는다.

기본 timeout30초/상한60초, 기본 maxTokens1024/상한4096, messages64개/직렬화 요청64KiB, 응답1MiB, 프로세스 내 동시4개다. 초과/취소는 안전한 코드로 반환한다. `{ok:true,providerId,modelId,content,finishReason,usage?}` 또는 `{ok:false,error:{code,message}}`이며 error.message는 고정 문구다. `DISABLED`, `CONFIG_INVALID`, `PROVIDER_NOT_FOUND`, `MODEL_NOT_ALLOWED`, `ENDPOINT_NOT_ALLOWED`, `AUTH_FAILED`, `TIMEOUT`, `ABORTED`, `RATE_LIMIT`, `UPSTREAM_ERROR`, `INVALID_UPSTREAM_RESPONSE`, `INVALID_REQUEST`를 구별한다. Prompt·응답 원문·upstream body·nested cause·Authorization을 로깅하지 않는다.

## 연결·인증서

등록한 endpoint만 사용하고 모든 DNS A/AAAA 결과가 RFC1918 사설 IPv4 또는 IPv6 ULA인지 검증한다. public/loopback/link-local/metadata 주소, 혼합 DNS 응답, URL 자격증명·query·fragment·redirect를 거부한다. 검증한 IP로 직접 연결하고 등록 Host/TLS SNI를 보존하여 DNS 재조회/rebinding을 막는다. 사설 주소라는 사실은 조직의 신뢰를 자동 보장하지 않으므로 운영자가 허용 서버만 등록한다.

HTTPS 인증서 검증은 항상 유지한다. 내부 CA는 운영 환경에서 읽기 전용으로 마운트하고 Node의 `NODE_EXTRA_CA_CERTS`로 별도 주입한다. 기본 Compose가 CA 경로를 자동 마운트한다고 가정하지 않는다. `NODE_TLS_REJECT_UNAUTHORIZED=0`을 사용하지 않는다. 사설 DNS·내부 CA·실제 모델/토큰·조직 HTTP 허용과 endpoint별 접근성은 운영 환경 별도 검증이며 mock CI로 PASS를 주장하지 않는다.

검증·실패 이력은 [통합 Work Packet](exec-plans/active/ISSUE_866.md) 및 [누적 원장](ISSUE_866_FAILURE_ANALYSIS.md)을 따른다.

## 호환 프로토콜 확인 (2026-11-03)

[공식 Chat Completions 요청 규격](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)의 POST/model/messages/stream:false/temperature 형식을 대조했다. 이 모듈은 사내 호환 서버의 텍스트·비스트리밍·max_tokens 방식을 지원한다. 공식 OpenAI 규격에서는 max_tokens가 deprecated이고 일부 reasoning 모델에서 지원하지 않으므로 모든 모델 호환을 주장하지 않는다. 등록 모델이 해당 요청 필드를 지원하는지는 실제 명시 호출에서 확인하고 실패 시 다른 서버나 모델로 대체하지 않는다. 공개 OpenAI endpoint를 등록하거나 실제 API key를 사용한 검증은 수행하지 않는다.
