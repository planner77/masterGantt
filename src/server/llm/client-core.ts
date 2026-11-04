import { isRecord, parseLlmConfiguration, resolveLlmSelection, type LlmEnvironment } from "./config-core";
import { postLlmCompletion, type LlmTransportDependencies } from "./transport-core";
import { llmFailure, LlmFailure, type InvokeLlmInput, type LlmResult } from "./types";

export const LLM_LIMITS = Object.freeze({
  messages: 64,
  requestBytes: 64 * 1024,
  defaultTokens: 1024,
  maxTokens: 4096,
  defaultTimeoutMs: 30_000,
  maxTimeoutMs: 60_000,
  concurrentRequests: 4,
});

function invalidRequest(): never { throw new LlmFailure("INVALID_REQUEST"); }

function parseInput(input: InvokeLlmInput): { body: string; timeoutMs: number } {
  if (!isRecord(input) || Object.keys(input).some((key) => ![
    "providerId", "modelId", "messages", "maxTokens", "temperature", "timeoutMs", "signal",
  ].includes(key)) || (input.providerId !== undefined && typeof input.providerId !== "string")
      || (input.modelId !== undefined && typeof input.modelId !== "string")
      || !Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > LLM_LIMITS.messages
      || input.messages.some((message) => !isRecord(message)
        || Object.keys(message).sort().join(",") !== "content,role"
        || !["system", "user", "assistant"].includes(message.role as string) || typeof message.content !== "string")) return invalidRequest();
  const maxTokens = input.maxTokens ?? LLM_LIMITS.defaultTokens;
  const timeoutMs = input.timeoutMs ?? LLM_LIMITS.defaultTimeoutMs;
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens > LLM_LIMITS.maxTokens
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > LLM_LIMITS.maxTimeoutMs
      || (input.temperature !== undefined && (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2))
      || (input.signal !== undefined && !(input.signal instanceof AbortSignal))) return invalidRequest();
  // Serialize a strict allowlist; credentials/URLs/stream/tools are never caller-controlled.
  const body = JSON.stringify({
    messages: input.messages.map(({ role, content }) => ({ role, content })),
    stream: false,
    max_tokens: maxTokens,
    ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
  });
  if (Buffer.byteLength(body, "utf8") > LLM_LIMITS.requestBytes) return invalidRequest();
  return { body, timeoutMs };
}

function parseResponse(raw: string, providerId: string, modelId: string): LlmResult {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { throw new LlmFailure("INVALID_UPSTREAM_RESPONSE"); }
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length !== 1) throw new LlmFailure("INVALID_UPSTREAM_RESPONSE");
  const choice: unknown = value.choices[0];
  if (!isRecord(choice) || choice.index !== 0 || !["stop", "length"].includes(choice.finish_reason as string)
      || !isRecord(choice.message) || choice.message.role !== "assistant" || typeof choice.message.content !== "string"
      || choice.message.tool_calls !== undefined || choice.message.function_call !== undefined) throw new LlmFailure("INVALID_UPSTREAM_RESPONSE");
  const result: Extract<LlmResult, { ok: true }> = {
    ok: true, providerId, modelId, content: choice.message.content, finishReason: choice.finish_reason as "stop" | "length",
  };
  if (value.usage !== undefined) {
    if (!isRecord(value.usage)) throw new LlmFailure("INVALID_UPSTREAM_RESPONSE");
    const usage = value.usage;
    const counts = [usage.prompt_tokens, usage.completion_tokens, usage.total_tokens];
    if (!counts.every((count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0)) throw new LlmFailure("INVALID_UPSTREAM_RESPONSE");
    return { ...result, usage: { promptTokens: usage.prompt_tokens as number, completionTokens: usage.completion_tokens as number, totalTokens: usage.total_tokens as number } };
  }
  return result;
}

/** Internal constructor for deterministic tests. Runtime callers import invokeLLM from index.ts. */
export function createLlmClient(readEnvironment: () => LlmEnvironment, dependencies: LlmTransportDependencies = {}) {
  let inFlight = 0;
  return async function invoke(input: InvokeLlmInput): Promise<LlmResult> {
    let acquired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let removeCallerAbort: (() => void) | undefined;
    try {
      const configuration = parseLlmConfiguration(readEnvironment());
      if (!configuration.enabled) return llmFailure("DISABLED");
      const { body, timeoutMs } = parseInput(input);
      const { provider, model } = resolveLlmSelection(configuration, input.providerId, input.modelId);
      const payload = JSON.stringify({ ...JSON.parse(body) as Record<string, unknown>, model });
      if (Buffer.byteLength(payload, "utf8") > LLM_LIMITS.requestBytes) return invalidRequest();
      if (input.signal?.aborted) return llmFailure("ABORTED");
      if (inFlight >= LLM_LIMITS.concurrentRequests) return llmFailure("RATE_LIMIT");
      inFlight += 1;
      acquired = true;
      const controller = new AbortController();
      if (input.signal) {
        const callerSignal = input.signal;
        const onAbort = () => controller.abort();
        callerSignal.addEventListener("abort", onAbort, { once: true });
        removeCallerAbort = () => callerSignal.removeEventListener("abort", onAbort);
        if (callerSignal.aborted) controller.abort();
      }
      timer = setTimeout(() => controller.abort("LLM_TIMEOUT"), timeoutMs);
      const raw = await postLlmCompletion(provider, payload, controller.signal, dependencies);
      return parseResponse(raw, provider.id, model);
    } catch (error: unknown) {
      return llmFailure(error instanceof LlmFailure ? error.code : "UPSTREAM_ERROR");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      removeCallerAbort?.();
      if (acquired) inFlight -= 1;
    }
  };
}
