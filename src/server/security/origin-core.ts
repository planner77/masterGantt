export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function parseApplicationBaseUrl(
  configuredValue: string | undefined,
  environment: string | undefined,
): URL {
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
    (environment === "production" && url.protocol !== "https:") ||
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
