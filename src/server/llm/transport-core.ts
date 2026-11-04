import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest, type ClientRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { isPrivateLlmAddress, type LlmProvider } from "./config-core";
import { LlmFailure } from "./types";

export const LLM_MAX_RESPONSE_BYTES = 1024 * 1024;
export type ResolvedLlmAddress = Readonly<{ address: string; family: number }>;

/** Test seams are internal. The server-only public entry point does not accept dependencies. */
export type LlmTransportDependencies = Readonly<{
  lookup?: (hostname: string) => Promise<readonly ResolvedLlmAddress[]>;
  request?: (options: RequestOptions & { autoSelectFamily?: boolean; servername?: string; rejectUnauthorized?: boolean }, callback: (response: IncomingMessage) => void) => ClientRequest;
}>;

function aborted(signal: AbortSignal): LlmFailure {
  return new LlmFailure(signal.reason === "LLM_TIMEOUT" ? "TIMEOUT" : "ABORTED");
}

export function withLlmAbort<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(aborted(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => { cleanup(); reject(aborted(signal)); };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then((value) => { cleanup(); resolve(value); }, (error: unknown) => { cleanup(); reject(error); });
  });
}

export async function resolveLlmAddress(url: URL, signal: AbortSignal, dependencies: LlmTransportDependencies = {}): Promise<ResolvedLlmAddress> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await withLlmAbort(
      dependencies.lookup ? dependencies.lookup(hostname) : dnsLookup(hostname, { all: true, verbatim: true }),
      signal,
    );
  if (signal.aborted) throw aborted(signal);
  // Reject mixed DNS answers; never try a different address/provider after a failure.
  if (addresses.length === 0 || addresses.length > 64 || addresses.some((item) =>
    !isPrivateLlmAddress(item.address) || item.family !== isIP(item.address))) {
    throw new LlmFailure("ENDPOINT_NOT_ALLOWED");
  }
  return addresses[0];
}

/** Connect to the validated IP directly while keeping the registered Host and TLS SNI. */
export async function postLlmCompletion(provider: LlmProvider, body: string, signal: AbortSignal, dependencies: LlmTransportDependencies = {}): Promise<string> {
  const pinned = await resolveLlmAddress(provider.baseUrl, signal, dependencies);
  if (signal.aborted) throw aborted(signal);
  const request: NonNullable<LlmTransportDependencies["request"]> = dependencies.request
    ?? ((options, callback) => provider.baseUrl.protocol === "https:" ? httpsRequest(options, callback) : httpRequest(options, callback));
  return new Promise((resolve, reject) => {
    let done = false;
    let outgoing: ClientRequest | undefined;
    const onAbort = () => finish(aborted(signal));
    const finish = (error?: LlmFailure, data?: string) => {
      if (done) return;
      done = true;
      signal.removeEventListener("abort", onAbort);
      if (error) { outgoing?.destroy(); reject(error); } else resolve(data ?? "");
    };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      outgoing = request({
        protocol: provider.baseUrl.protocol,
        hostname: pinned.address,
        family: pinned.family,
        autoSelectFamily: false,
        port: provider.baseUrl.port || undefined,
        path: `${provider.baseUrl.pathname}/chat/completions`,
        method: "POST",
        agent: false,
        servername: isIP(provider.baseUrl.hostname.replace(/^\[|\]$/g, "")) ? undefined : provider.baseUrl.hostname,
        rejectUnauthorized: true,
        maxHeaderSize: 16 * 1024,
        headers: {
          Host: provider.baseUrl.host,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "Content-Length": Buffer.byteLength(body, "utf8"),
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
      }, (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400) { finish(new LlmFailure("ENDPOINT_NOT_ALLOWED")); response.destroy(); return; }
        if (status === 401 || status === 403) { finish(new LlmFailure("AUTH_FAILED")); response.destroy(); return; }
        if (status === 429) { finish(new LlmFailure("RATE_LIMIT")); response.destroy(); return; }
        if (status < 200 || status >= 300) { finish(new LlmFailure("UPSTREAM_ERROR")); response.destroy(); return; }
        const contentType = response.headers["content-type"]?.split(";")[0].trim().toLowerCase();
        const encoding = response.headers["content-encoding"];
        const length = response.headers["content-length"];
        if (contentType !== "application/json" || (encoding && encoding !== "identity")
            || (length !== undefined && (!/^\d+$/.test(length) || Number(length) > LLM_MAX_RESPONSE_BYTES))) {
          finish(new LlmFailure("INVALID_UPSTREAM_RESPONSE")); response.destroy(); return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          if (done) return;
          bytes += chunk.length;
          if (bytes > LLM_MAX_RESPONSE_BYTES) {
            finish(new LlmFailure("INVALID_UPSTREAM_RESPONSE")); response.destroy(); return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => finish(undefined, Buffer.concat(chunks).toString("utf8")));
        response.on("error", () => finish(new LlmFailure("UPSTREAM_ERROR")));
        response.on("aborted", () => finish(new LlmFailure("UPSTREAM_ERROR")));
      });
      outgoing.on("error", () => finish(signal.aborted ? aborted(signal) : new LlmFailure("UPSTREAM_ERROR")));
      if (signal.aborted) { finish(aborted(signal)); return; }
      outgoing.end(body);
    } catch {
      finish(new LlmFailure("UPSTREAM_ERROR"));
    }
  });
}
