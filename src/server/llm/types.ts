export const LLM_ERROR_MESSAGES = {
  DISABLED: "LLM 기능이 비활성 상태입니다.",
  CONFIG_INVALID: "LLM 서버 설정을 확인해 주세요.",
  PROVIDER_NOT_FOUND: "등록되지 않은 LLM 서버입니다.",
  MODEL_NOT_ALLOWED: "이 서버에 등록되지 않은 모델입니다.",
  ENDPOINT_NOT_ALLOWED: "허용되지 않은 LLM 연결 대상입니다.",
  AUTH_FAILED: "LLM 서버 인증에 실패했습니다.",
  TIMEOUT: "LLM 요청 제한 시간을 초과했습니다.",
  ABORTED: "LLM 요청이 취소되었습니다.",
  RATE_LIMIT: "LLM 요청 한도를 초과했습니다.",
  UPSTREAM_ERROR: "LLM 서버 요청에 실패했습니다.",
  INVALID_UPSTREAM_RESPONSE: "LLM 서버 응답을 확인할 수 없습니다.",
  INVALID_REQUEST: "LLM 요청 형식을 확인해 주세요.",
} as const;

export type LlmErrorCode = keyof typeof LLM_ERROR_MESSAGES;
export type LlmMessage = Readonly<{ role: "system" | "user" | "assistant"; content: string }>;
export type InvokeLlmInput = Readonly<{
  providerId?: string;
  modelId?: string;
  messages: readonly LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}>;

export type LlmResult =
  | Readonly<{
      ok: true;
      providerId: string;
      modelId: string;
      content: string;
      finishReason: "stop" | "length";
      usage?: Readonly<{ promptTokens: number; completionTokens: number; totalTokens: number }>;
    }>
  | Readonly<{ ok: false; error: Readonly<{ code: LlmErrorCode; message: string }> }>;

/** Contains no upstream body, input, URL, token, nested cause, or server exception. */
export class LlmFailure extends Error {
  constructor(readonly code: LlmErrorCode) {
    super(LLM_ERROR_MESSAGES[code]);
    this.name = "LlmFailure";
  }
}

export function llmFailure(code: LlmErrorCode): Extract<LlmResult, { ok: false }> {
  return { ok: false, error: { code, message: LLM_ERROR_MESSAGES[code] } };
}
