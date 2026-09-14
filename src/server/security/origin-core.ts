export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function parseApplicationBaseUrl(
  configuredValue: string | undefined,
  environment: string | undefined,
  allowInsecureHttp?: string,
): URL {
  const allowHttp = parseAllowInsecureHttp(allowInsecureHttp);
  if (!configuredValue || configuredValue.trim() !== configuredValue) {
    throw new ConfigurationError("APP_BASE_URL is missing or invalid.");
  }

  let url: URL;
  try {
    url = new URL(configuredValue);
  } catch {
    throw new ConfigurationError("APP_BASE_URL is missing or invalid.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    (environment === "production" && url.protocol === "http:" && !allowHttp) ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    configuredValue !== url.origin
  ) {
    throw new ConfigurationError("APP_BASE_URL is missing or invalid.");
  }

  return url;
}

export function isExactAllowedOrigin(
  requestOrigin: string | null,
  applicationUrl: URL,
): boolean {
  if (
    !requestOrigin ||
    requestOrigin === "null" ||
    requestOrigin.includes(",") ||
    requestOrigin.trim() !== requestOrigin
  ) {
    return false;
  }

  try {
    const parsed = new URL(requestOrigin);
    return (
      parsed.origin === applicationUrl.origin &&
      parsed.href === `${parsed.origin}/` &&
      requestOrigin === parsed.origin
    );
  } catch {
    return false;
  }
}

/** Only a server-side deployment value may opt into clear-text production HTTP. */
export function parseAllowInsecureHttp(value: string | undefined): boolean {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new ConfigurationError("ALLOW_INSECURE_HTTP must be true or false.");
}

/** Mapping only; callers validate inside their normal error boundary. */
export function readApplicationConfiguration(env: Readonly<Record<string, string | undefined>>) {
  return {
    applicationBaseUrl: env.APP_BASE_URL,
    environment: env.NODE_ENV,
    allowInsecureHttp: env.ALLOW_INSECURE_HTTP,
  };
}
