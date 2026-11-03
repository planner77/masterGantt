import { readFileSync } from "node:fs";
import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLlmClient, LLM_LIMITS } from "../../../src/server/llm/client-core";
import { resolveLlmAddress, type LlmTransportDependencies } from "../../../src/server/llm/transport-core";
import type { InvokeLlmInput, LlmResult } from "../../../src/server/llm/types";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); })));
});
type Received = { url: string | undefined; headers: IncomingMessage["headers"]; body: Record<string, unknown> };
const completion = { choices: [{ index: 0, message: { role: "assistant", content: "fixture answer" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } };
const input: InvokeLlmInput = { messages: [{ role: "user", content: "fixture prompt" }] };
async function mockServer(reply?: (response: ServerResponse, received: Received) => void) {
  const received: Received[] = [];
  const server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
    request.on("end", () => {
      const record = { url: request.url, headers: request.headers, body: JSON.parse(raw) as Record<string, unknown> };
      received.push(record);
      if (reply) reply(response, record);
      else { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(completion)); }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { received, port: (server.address() as AddressInfo).port };
}

function env(portA = 8000, portB = 8001) {
  return {
    LLM_ENABLED: "true", LLM_ALLOW_INSECURE_HTTP: "true",
    LLM_PROVIDERS_JSON: JSON.stringify([
      { id: "a", baseUrl: `http://llm-a.internal:${portA}/v1`, models: ["shared", "model-a2"] },
      { id: "b", baseUrl: `http://llm-b.internal:${portB}/v1`, models: ["shared", "model-b2"] },
    ]),
    LLM_DEFAULT_PROVIDER: "a", LLM_DEFAULT_MODEL: "shared",
    LLM_API_KEYS_JSON: '{"a":"fixture-token-a","b":"fixture-token-b"}',
  };
}

/** Exercise real HTTP protocol against loopback mocks after asserting production IP pinning. */
function mockTransport() {
  const lookup = vi.fn(async () => [{ address: "10.25.0.8", family: 4 }]);
  const request: NonNullable<LlmTransportDependencies["request"]> = vi.fn((options, callback) => {
    expect(options.hostname).toBe("10.25.0.8");
    expect(options.agent).toBe(false);
    expect(options.family).toBe(4);
    expect(options.rejectUnauthorized).toBe(true);
    return httpRequest({ ...options, hostname: "127.0.0.1", family: 4 }, callback);
  });
  return { lookup, request };
}
function expectFailure(result: LlmResult, code: string) {
  expect(result).toMatchObject({ ok: false, error: { code } });
  const serialized = JSON.stringify(result);
  for (const secret of ["fixture-token-a", "fixture-token-b", "fixture prompt", "upstream-secret-body", "llm-a.internal"]) expect(serialized).not.toContain(secret);
}

describe("server-only OpenAI-compatible text calls", () => {
  it("makes no network calls at construction/disabled/invalid config/selection time", async () => {
    const dependencies = mockTransport();
    const disabled = createLlmClient(() => ({}), dependencies);
    expect(dependencies.lookup).not.toHaveBeenCalled();
    expectFailure(await disabled(input), "DISABLED");
    expectFailure(await createLlmClient(() => ({ LLM_ENABLED: "true" }), dependencies)(input), "CONFIG_INVALID");
    const enabled = createLlmClient(() => env(), dependencies);
    expectFailure(await enabled({ ...input, providerId: "missing" }), "PROVIDER_NOT_FOUND");
    expectFailure(await enabled({ ...input, providerId: "b", modelId: "model-a2" }), "MODEL_NOT_ALLOWED");
    expect(dependencies.lookup).not.toHaveBeenCalled();
    expect(dependencies.request).not.toHaveBeenCalled();
  });

  it("sends exact model/messages/path/auth to two independent servers and two models of one server", async () => {
    const a = await mockServer(); const b = await mockServer(); const dependencies = mockTransport();
    const invoke = createLlmClient(() => env(a.port, b.port), dependencies);
    expect(await invoke(input)).toMatchObject({ ok: true, providerId: "a", modelId: "shared", content: "fixture answer", usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 } });
    expect(await invoke({ ...input, modelId: "model-a2", temperature: 0.3, maxTokens: 128 })).toMatchObject({ ok: true, modelId: "model-a2" });
    expect(await invoke({ ...input, providerId: "b", modelId: "model-b2" })).toMatchObject({ ok: true, providerId: "b", modelId: "model-b2" });
    expect(await invoke({ ...input, providerId: "b" })).toMatchObject({ ok: true, providerId: "b", modelId: "shared" });
    expect(a.received.map((item) => item.body.model)).toEqual(["shared", "model-a2"]);
    expect(b.received.map((item) => item.body.model)).toEqual(["model-b2", "shared"]);
    expect(a.received[0]).toMatchObject({ url: "/v1/chat/completions", headers: { authorization: "Bearer fixture-token-a", host: `llm-a.internal:${a.port}` }, body: { messages: input.messages, stream: false, max_tokens: 1024 } });
    expect(a.received[1].body).toMatchObject({ max_tokens: 128, temperature: 0.3 });
    expect(b.received[0].headers.authorization).toBe("Bearer fixture-token-b");
    expect(dependencies.lookup).toHaveBeenCalledTimes(4);
    expect(dependencies.request).toHaveBeenCalledTimes(4);
  });

  it.each([[301, "ENDPOINT_NOT_ALLOWED"], [307, "ENDPOINT_NOT_ALLOWED"], [401, "AUTH_FAILED"], [403, "AUTH_FAILED"], [429, "RATE_LIMIT"], [500, "UPSTREAM_ERROR"], [404, "UPSTREAM_ERROR"]] as const)("maps HTTP %s safely without redirect/retry/fallback", async (status, code) => {
    const a = await mockServer((response) => { response.writeHead(status, { Location: "http://169.254.169.254/", "Content-Type": "application/json" }); response.end("upstream-secret-body"); });
    const b = await mockServer();
    const dependencies = mockTransport();
    expectFailure(await createLlmClient(() => env(a.port, b.port), dependencies)(input), code);
    expect(a.received).toHaveLength(1); expect(b.received).toHaveLength(0);
    expect(dependencies.request).toHaveBeenCalledTimes(1);
  });

  it.each([
    {}, { choices: [] }, { choices: [{ ...completion.choices[0], finish_reason: "tool_calls" }] },
    { choices: [{ ...completion.choices[0], message: { role: "assistant", content: null } }] },
    { ...completion, usage: { prompt_tokens: -1, completion_tokens: 1, total_tokens: 0 } },
    { choices: [{ ...completion.choices[0], message: { role: "assistant", content: "text", tool_calls: [] } }] },
  ])("rejects malformed/unsupported response structure without exposing upstream text", async (payload) => {
    const a = await mockServer((response) => { response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(payload)); });
    expectFailure(await createLlmClient(() => env(a.port), mockTransport())(input), "INVALID_UPSTREAM_RESPONSE");
  });

  it.each(["json", "size", "type", "encoding", "length"])("rejects invalid response mode %s", async (mode) => {
      const a = await mockServer((response) => {
        response.writeHead(200, { "Content-Type": mode === "type" ? "text/html" : "application/json", ...(mode === "encoding" ? { "Content-Encoding": "gzip" } : {}), ...(mode === "length" ? { "Content-Length": "2000000" } : {}) });
        response.end(mode === "size" ? "x".repeat(1024 * 1024 + 1) : "upstream-secret-body");
      });
      expectFailure(await createLlmClient(() => env(a.port), mockTransport())(input), "INVALID_UPSTREAM_RESPONSE");
  });

  it("bounds input/options and rejects arbitrary caller URL/token/tools before DNS", async () => {
    const dependencies = mockTransport(); const invoke = createLlmClient(() => env(), dependencies);
    const invalid = [
      { ...input, messages: [] }, { ...input, messages: [{ role: "tool", content: "x" }] },
      { ...input, messages: [{ role: "user", content: "x".repeat(65536) }] },
      { ...input, messages: Array.from({ length: 65 }, () => input.messages[0]) },
      { ...input, maxTokens: 0 }, { ...input, maxTokens: 4097 }, { ...input, maxTokens: 1.5 },
      { ...input, temperature: NaN }, { ...input, temperature: 2.1 }, { ...input, timeoutMs: 60001 },
      { ...input, baseUrl: "http://169.254.169.254/" }, { ...input, apiKey: "injected" },
      { ...input, stream: true }, { ...input, tools: [] },
    ];
    for (const bad of invalid) expectFailure(await invoke(bad as InvokeLlmInput), "INVALID_REQUEST");
    expect(dependencies.lookup).not.toHaveBeenCalled(); expect(dependencies.request).not.toHaveBeenCalled();
  });

  it("times out the complete request and honors caller abort without another server call", async () => {
    const a = await mockServer(() => {}); const b = await mockServer(); const dependencies = mockTransport();
    const invoke = createLlmClient(() => env(a.port, b.port), dependencies);
    expectFailure(await invoke({ ...input, timeoutMs: 30 }), "TIMEOUT");
    const controller = new AbortController();
    const pending = invoke({ ...input, signal: controller.signal });
    await vi.waitFor(() => expect(a.received).toHaveLength(2));
    controller.abort(new Error("upstream-secret-body"));
    expectFailure(await pending, "ABORTED");
    expectFailure(await invoke({ ...input, signal: controller.signal }), "ABORTED");
    expect(b.received).toHaveLength(0); expect(dependencies.request).toHaveBeenCalledTimes(2);
  });

  it("bounds total concurrency and releases every slot on abort", async () => {
    const a = await mockServer(() => {}); const dependencies = mockTransport();
    const invoke = createLlmClient(() => env(a.port), dependencies);
    const controllers = Array.from({ length: LLM_LIMITS.concurrentRequests }, () => new AbortController());
    const pending = controllers.map((controller) => invoke({ ...input, signal: controller.signal }));
    await vi.waitFor(() => expect(a.received).toHaveLength(4));
    expectFailure(await invoke(input), "RATE_LIMIT");
    controllers.forEach((controller) => controller.abort());
    for (const result of await Promise.all(pending)) expectFailure(result, "ABORTED");
    const nextController = new AbortController(); const next = invoke({ ...input, signal: nextController.signal });
    await vi.waitFor(() => expect(a.received).toHaveLength(5)); nextController.abort(); expectFailure(await next, "ABORTED");
  });

  it("blocks public, metadata, IPv6 aliases and mixed DNS before any connection", async () => {
    for (const address of ["8.8.8.8", "127.0.0.1", "169.254.169.254", "fd00:ec2::254", "::ffff:10.0.0.1"]) {
      const dependencies = mockTransport(); dependencies.lookup.mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }]);
      expectFailure(await createLlmClient(() => env(), dependencies)(input), "ENDPOINT_NOT_ALLOWED");
      expect(dependencies.request).not.toHaveBeenCalled();
    }
    const dependencies = mockTransport(); dependencies.lookup.mockResolvedValue([{ address: "10.0.0.4", family: 4 }, { address: "169.254.169.254", family: 4 }]);
    expectFailure(await createLlmClient(() => env(), dependencies)(input), "ENDPOINT_NOT_ALLOWED");
    expect(dependencies.request).not.toHaveBeenCalled();
  });

  it("does not reconnect after DNS timeout, late resolution or DNS errors and sanitizes exceptions", async () => {
    let resolveDns: ((addresses: { address: string; family: number }[]) => void) | undefined;
    const dependencies = mockTransport(); dependencies.lookup.mockImplementation(() => new Promise((resolve) => { resolveDns = resolve; }));
    expectFailure(await createLlmClient(() => env(), dependencies)({ ...input, timeoutMs: 10 }), "TIMEOUT");
    resolveDns?.([{ address: "10.0.0.4", family: 4 }]); await Promise.resolve(); await Promise.resolve();
    expect(dependencies.request).not.toHaveBeenCalled();
    dependencies.lookup.mockRejectedValue(new Error("upstream-secret-body fixture-token-a"));
    expectFailure(await createLlmClient(() => env(), dependencies)(input), "UPSTREAM_ERROR");
    expect(dependencies.request).not.toHaveBeenCalled();
  });

  it("validates literal private addresses without DNS and retains HTTPS verification/SNI", async () => {
    const dependencies = mockTransport();
    expect(await resolveLlmAddress(new URL("https://10.1.2.3/v1"), new AbortController().signal, dependencies)).toEqual({ address: "10.1.2.3", family: 4 });
    expect(dependencies.lookup).not.toHaveBeenCalled();
    const request: NonNullable<LlmTransportDependencies["request"]> = vi.fn((options) => {
      expect(options).toMatchObject({ protocol: "https:", hostname: "10.25.0.8", servername: "llm-a.internal", rejectUnauthorized: true, agent: false });
      throw new Error("upstream-secret-body fixture-token-a");
    });
    const secureEnv = env(); secureEnv.LLM_PROVIDERS_JSON = secureEnv.LLM_PROVIDERS_JSON.replaceAll("http:", "https:");
    expectFailure(await createLlmClient(() => secureEnv, { ...dependencies, request })(input), "UPSTREAM_ERROR");
  });

  it("keeps the production entry point server-only with runtime environment reading and no public route", () => {
    const source = readFileSync(new URL("../../../src/server/llm/index.ts", import.meta.url), "utf8");
    expect(source).toContain('import "server-only"'); expect(source).toContain("createLlmClient(() => process.env)");
    expect(source).not.toContain("NEXT_PUBLIC_");
  });
});
