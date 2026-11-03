import { describe, expect, it } from "vitest";
import { isPrivateLlmAddress, parseLlmConfiguration, resolveLlmSelection } from "../../../src/server/llm/config-core";
import { LlmFailure } from "../../../src/server/llm/types";

const providerA = { id: "internal-a", baseUrl: "https://llm-a.internal/v1", models: ["shared", "model-b"] };
const providerB = { id: "internal-b", baseUrl: "https://llm-b.internal/v1", models: ["shared", "model-c"] };
function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    LLM_ENABLED: "true",
    LLM_PROVIDERS_JSON: JSON.stringify([providerA, providerB]),
    LLM_API_KEYS_JSON: JSON.stringify({ "internal-a": "fixture-token-a", "internal-b": "fixture-token-b" }),
    LLM_DEFAULT_PROVIDER: "internal-a",
    LLM_DEFAULT_MODEL: "shared",
    ...overrides,
  };
}

describe("LLM runtime configuration and exact provider/model selection", () => {
  it("ignores all other malformed/secret settings while disabled or unset", () => {
    expect(parseLlmConfiguration({})).toEqual({ enabled: false });
    expect(parseLlmConfiguration(environment({ LLM_ENABLED: "false", LLM_PROVIDERS_JSON: "bad-json", LLM_API_KEYS_JSON: "sensitive-fixture" }))).toEqual({ enabled: false });
  });

  it("registers two servers and multiple models per server, including shared model names", () => {
    const config = parseLlmConfiguration(environment());
    if (!config.enabled) throw new Error("Fixture must enable LLM");
    expect(config.providers).toHaveLength(2);
    expect(resolveLlmSelection(config).provider.id).toBe("internal-a");
    expect(resolveLlmSelection(config, undefined, "model-b").model).toBe("model-b");
    expect(resolveLlmSelection(config, "internal-b").model).toBe("shared");
    expect(resolveLlmSelection(config, "internal-b", "model-c").provider.id).toBe("internal-b");
    expect(() => resolveLlmSelection(config, "missing", "shared")).toThrow(expect.objectContaining({ code: "PROVIDER_NOT_FOUND" }));
    expect(() => resolveLlmSelection(config, "internal-b", "model-b")).toThrow(expect.objectContaining({ code: "MODEL_NOT_ALLOWED" }));
  });

  it.each([
    { LLM_ENABLED: "TRUE" },
    { LLM_PROVIDERS_JSON: "not-json" },
    { LLM_PROVIDERS_JSON: "[]" },
    { LLM_PROVIDERS_JSON: JSON.stringify([providerA, providerA]) },
    { LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, id: "" }]) },
    { LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, id: "constructor" }]) },
    { LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, models: [] }]) },
    { LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, models: ["shared", "shared"] }]) },
    { LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, models: ["\nmodel"] }]) },
    { LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, apiKey: "fixture-secret" }]) },
    { LLM_DEFAULT_PROVIDER: "unknown" },
    { LLM_DEFAULT_MODEL: "unknown" },
    { LLM_API_KEYS_JSON: "{}" },
    { LLM_API_KEYS_JSON: '{"internal-a":"a","internal-b":"b","extra":"c"}' },
    { LLM_API_KEYS_JSON: '{"internal-a":"a","internal-b":null}' },
    { LLM_API_KEYS_JSON: '{"internal-a":"a","internal-a":"replacement","internal-b":"b"}' },
    { LLM_API_KEYS_JSON: '{"internal-a":"a","internal-\\u0061":"replacement","internal-b":"b"}' },
    { LLM_PROVIDERS_JSON: '[{"id":"internal-a","baseUrl":"https://llm-a.internal/v1","baseUrl":"https://other.internal/v1","models":["shared"]}]' },
    { LLM_API_KEYS_JSON: '{"internal-a":"a","internal-b":""}' },
    { LLM_API_KEYS_JSON: '{"internal-a":"a","internal-b":"header\\r\\ninjection"}' },
    { LLM_ALLOW_UNAUTHENTICATED: "yes" },
  ])("rejects ambiguous/invalid settings with a safe LLM-only error (%j)", (override) => {
    let error: unknown;
    try { parseLlmConfiguration(environment(override)); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(LlmFailure);
    expect(error).toMatchObject({ code: "CONFIG_INVALID" });
    expect(JSON.stringify(error)).not.toContain("fixture-secret");
  });

  it("requires a separate explicit opt-in for tokenless internal servers", () => {
    const config = parseLlmConfiguration(environment({ LLM_ALLOW_UNAUTHENTICATED: "true", LLM_API_KEYS_JSON: '{"internal-a":"","internal-b":""}' }));
    expect(config.enabled && config.providers.every((provider) => provider.apiKey === "")).toBe(true);
  });

  it.each([
    "http://10.0.0.5/v1", "https://127.0.0.1/v1", "https://0x7f000001/v1",
    "https://169.254.169.254/v1", "https://100.100.100.200/v1", "https://8.8.8.8/v1",
    "https://[fd00:ec2:0:0:0:0:0:254]/v1", "https://localhost/v1", "https://llm.localhost/v1",
  ])("rejects public/local/metadata or non-opted-in HTTP endpoint %s", (url) => {
    expect(() => parseLlmConfiguration(environment({ LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, baseUrl: url }, providerB]) })))
      .toThrow(expect.objectContaining({ code: "ENDPOINT_NOT_ALLOWED" }));
  });

  it.each([
    "file:///v1", "ftp://10.0.0.1/v1", "https://user:password@llm.internal/v1",
    "https://llm.internal/v1?token=fixture", "https://llm.internal/v1#fixture", "https://llm.internal/not-v1",
  ])("rejects invalid URL structure %s", (url) => {
    expect(() => parseLlmConfiguration(environment({ LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, baseUrl: url }, providerB]) })))
      .toThrow(expect.objectContaining({ code: "CONFIG_INVALID" }));
  });

  it("accepts RFC1918 / IPv6 ULA and permits HTTP only through its own opt-in", () => {
    expect(parseLlmConfiguration(environment({ LLM_ALLOW_INSECURE_HTTP: "true", LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, baseUrl: "http://10.0.0.5:8000/v1/" }, providerB]) })).enabled).toBe(true);
    expect(() => parseLlmConfiguration(environment({ ALLOW_INSECURE_HTTP: "true", LLM_PROVIDERS_JSON: JSON.stringify([{ ...providerA, baseUrl: "http://10.0.0.5/v1" }, providerB]) })))
      .toThrow(expect.objectContaining({ code: "ENDPOINT_NOT_ALLOWED" }));
    for (const address of ["10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.0.1", "fd12:3456::1", "fc00::1"]) expect(isPrivateLlmAddress(address)).toBe(true);
    for (const address of ["0.0.0.0", "127.0.0.1", "172.15.0.1", "172.32.0.1", "192.169.0.1", "169.254.1.1", "100.64.0.1", "::1", "fe80::1", "::ffff:10.0.0.1", "2001:4860:4860::8888", "fd00:ec2::254"]) expect(isPrivateLlmAddress(address)).toBe(false);
  });
});
