import { isIP } from "node:net";
import { LlmFailure } from "./types";

export type LlmEnvironment = Readonly<Record<string, string | undefined>>;
export type LlmProvider = Readonly<{
  id: string;
  baseUrl: URL;
  models: readonly string[];
  apiKey: string;
}>;
export type LlmConfiguration =
  | Readonly<{ enabled: false }>
  | Readonly<{
      enabled: true;
      providers: readonly LlmProvider[];
      defaultProvider: string;
      defaultModel: string;
    }>;

const PROVIDER_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const FORBIDDEN_IDS = new Set(["__proto__", "prototype", "constructor"]);

function invalid(): never {
  throw new LlmFailure("CONFIG_INVALID");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booleanSetting(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  if (value.trim() === "true") return true;
  if (value.trim() === "false") return false;
  return invalid();
}

function parseJson(value: string | undefined): unknown {
  if (!value || Buffer.byteLength(value, "utf8") > 32 * 1024) return invalid();
  try {
    const parsed = JSON.parse(value) as unknown;
    // JSON.parse silently keeps the last duplicate key. Configuration must have
    // one unambiguous token/endpoint per key, including escaped key aliases.
    const objects: (Set<string> | null)[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (character === "{") objects.push(new Set());
      else if (character === "[") objects.push(null);
      else if (character === "}" || character === "]") objects.pop();
      else if (character === '"') {
        const start = index;
        index += 1;
        while (index < value.length && value[index] !== '"') {
          if (value[index] === "\\") index += 1;
          index += 1;
        }
        let next = index + 1;
        while (/\s/.test(value[next] ?? "") && next < value.length) next += 1;
        if (value[next] === ":") {
          const key = JSON.parse(value.slice(start, index + 1)) as string;
          const keys = objects[objects.length - 1];
          if (!keys || keys.has(key)) return invalid();
          keys.add(key);
        }
      }
      if (objects.length > 16) return invalid();
    }
    return parsed;
  } catch {
    return invalid();
  }
}

function modelId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200
    && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function parseLlmBaseUrl(value: unknown, allowHttp: boolean): URL {
  if (typeof value !== "string" || value.length > 2048 || value.trim() !== value) return invalid();
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password || url.search || url.hash
      || !/^\/(?:[a-zA-Z0-9_-]+\/)*v1\/?$/.test(url.pathname)) return invalid();
  if (url.protocol === "http:" && !allowHttp) throw new LlmFailure("ENDPOINT_NOT_ALLOWED");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (!hostname || hostname.includes("%") || hostname === "localhost" || hostname.endsWith(".localhost")
      || (isIP(hostname) !== 0 && !isPrivateLlmAddress(hostname))) {
    throw new LlmFailure("ENDPOINT_NOT_ALLOWED");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  return url;
}

/** Strict RFC1918 / IPv6 ULA only. Loopback, CGNAT, metadata and link-local are excluded. */
export function isPrivateLlmAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (isIP(address) !== 6) return false;
  // Normalize before comparing aliases of the AWS IPv6 metadata endpoint.
  let normalized: string;
  try { normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1); } catch { return false; }
  if (normalized === "fd00:ec2::254") return false;
  return /^f[cd][0-9a-f]{2}:/i.test(normalized);
}

/** Runtime-only parsing. Disabled mode intentionally ignores all other settings. */
export function parseLlmConfiguration(env: LlmEnvironment): LlmConfiguration {
  if (!booleanSetting(env.LLM_ENABLED)) return { enabled: false };
  const allowHttp = booleanSetting(env.LLM_ALLOW_INSECURE_HTTP);
  const allowUnauthenticated = booleanSetting(env.LLM_ALLOW_UNAUTHENTICATED);
  const rawProviders = parseJson(env.LLM_PROVIDERS_JSON);
  const rawKeys = parseJson(env.LLM_API_KEYS_JSON);
  if (!Array.isArray(rawProviders) || rawProviders.length === 0 || rawProviders.length > 32 || !isRecord(rawKeys)) return invalid();
  const ids = new Set<string>();
  const providers = rawProviders.map((raw): LlmProvider => {
    if (!isRecord(raw) || Object.keys(raw).sort().join(",") !== "baseUrl,id,models"
        || typeof raw.id !== "string" || !PROVIDER_ID.test(raw.id) || FORBIDDEN_IDS.has(raw.id)
        || ids.has(raw.id) || !Array.isArray(raw.models) || raw.models.length === 0
        || raw.models.length > 64 || !raw.models.every(modelId)
        || new Set(raw.models).size !== raw.models.length) return invalid();
    ids.add(raw.id);
    if (!Object.hasOwn(rawKeys, raw.id)) return invalid();
    const apiKey = rawKeys[raw.id];
    if (typeof apiKey !== "string" || apiKey.length > 8192 || /[\u0000-\u0020\u007f-\uffff]/u.test(apiKey)
        || (!apiKey && !allowUnauthenticated)) return invalid();
    return { id: raw.id, baseUrl: parseLlmBaseUrl(raw.baseUrl, allowHttp), models: raw.models, apiKey };
  });
  if (Object.keys(rawKeys).length !== ids.size || Object.keys(rawKeys).some((key) => !ids.has(key))) return invalid();
  const defaultProvider = env.LLM_DEFAULT_PROVIDER;
  const defaultModel = env.LLM_DEFAULT_MODEL;
  const selected = providers.find((provider) => provider.id === defaultProvider);
  if (!selected || !defaultModel || !selected.models.includes(defaultModel)) return invalid();
  return { enabled: true, providers, defaultProvider: selected.id, defaultModel };
}

/** A provider override never chooses that server's first model implicitly. */
export function resolveLlmSelection(config: Extract<LlmConfiguration, { enabled: true }>, providerId?: string, requestedModel?: string) {
  const provider = config.providers.find((item) => item.id === (providerId ?? config.defaultProvider));
  if (!provider) throw new LlmFailure("PROVIDER_NOT_FOUND");
  const model = requestedModel ?? config.defaultModel;
  if (!provider.models.includes(model)) throw new LlmFailure("MODEL_NOT_ALLOWED");
  return { provider, model };
}
