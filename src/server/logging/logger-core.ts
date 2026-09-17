export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY = /(password|passwd|cookie|authorization|token|secret|csrf|hash|digest|request.?body|response.?body)/i;
const MAX_STRING_LENGTH = 1024;

export interface StructuredLogFields {
  [key: string]: unknown;
}

export interface StructuredLogEntry extends StructuredLogFields {
  timestamp: string;
  level: LogLevel;
  event: string;
  component: string;
  environment: string;
}

export interface StructuredLogSink {
  debug(line: string): void;
  info(line: string): void;
  warn(line: string): void;
  error(line: string): void;
}

export interface StructuredLogger {
  readonly level: LogLevel;
  debug(event: string, fields?: StructuredLogFields): void;
  info(event: string, fields?: StructuredLogFields): void;
  warn(event: string, fields?: StructuredLogFields): void;
  error(event: string, fields?: StructuredLogFields): void;
}

export interface LogConfiguration {
  level: LogLevel;
  invalidValue?: string;
}

export interface StructuredLoggerOptions {
  level?: string;
  environment?: string;
  component?: string;
  sink?: StructuredLogSink;
  now?: () => Date;
}

function defaultLevel(environment: string): LogLevel {
  return environment === "development" ? "debug" : "info";
}

export function resolveLogConfiguration(
  rawLevel: string | undefined,
  environment = "development",
): LogConfiguration {
  const fallback = defaultLevel(environment);
  if (rawLevel === undefined || rawLevel.trim() === "") {
    return { level: fallback };
  }

  const normalized = rawLevel.trim().toLowerCase();
  if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error") {
    return { level: normalized };
  }

  return { level: fallback, invalidValue: rawLevel.slice(0, 64) };
}

function truncate(value: string): string {
  return value.length <= MAX_STRING_LENGTH
    ? value
    : `${value.slice(0, MAX_STRING_LENGTH)}…`;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") return truncate(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      result[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeValue(child, depth + 1);
    }
    return result;
  }
  return truncate(String(value));
}

export function sanitizeLogFields(fields: StructuredLogFields = {}): StructuredLogFields {
  const sanitized: StructuredLogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    sanitized[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeValue(value);
  }
  return sanitized;
}

export interface SafeErrorFields extends StructuredLogFields {
  errorType: string;
  errorCode?: string;
  errorMessage: string;
  stack?: string;
}

export function safeErrorFields(error: unknown, environment = "production"): SafeErrorFields {
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown; stack?: unknown } | null;
  const errorType = typeof candidate?.name === "string" && candidate.name.length > 0
    ? truncate(candidate.name)
    : error instanceof Error
      ? error.constructor.name
      : typeof error;
  const code = typeof candidate?.code === "string" || typeof candidate?.code === "number"
    ? truncate(String(candidate.code))
    : undefined;
  const exposeDetail = environment !== "production";
  const message = exposeDetail && typeof candidate?.message === "string"
    ? truncate(candidate.message)
    : "Unexpected server error.";
  const stack = exposeDetail && typeof candidate?.stack === "string"
    ? truncate(candidate.stack)
    : undefined;

  return sanitizeLogFields({
    errorType,
    ...(code ? { errorCode: code } : {}),
    errorMessage: message,
    ...(stack ? { stack } : {}),
  }) as SafeErrorFields;
}

const consoleSink: StructuredLogSink = {
  debug: (line) => console.debug(line),
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
};

export function createStructuredLogger(options: StructuredLoggerOptions = {}): StructuredLogger {
  const environment = options.environment ?? "development";
  const configuration = resolveLogConfiguration(options.level, environment);
  const component = options.component ?? "application";
  const sink = options.sink ?? consoleSink;
  const now = options.now ?? (() => new Date());

  function write(level: LogLevel, event: string, fields: StructuredLogFields = {}): void {
    if (LOG_LEVEL_WEIGHT[level] < LOG_LEVEL_WEIGHT[configuration.level]) return;

    const entry: StructuredLogEntry = {
      ...sanitizeLogFields(fields),
      timestamp: now().toISOString(),
      level,
      event: truncate(event),
      component,
      environment,
    };

    try {
      sink[level](JSON.stringify(entry));
    } catch {
      // Logging must never change application behavior.
    }
  }

  const logger: StructuredLogger = {
    level: configuration.level,
    debug: (event, fields) => write("debug", event, fields),
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };

  if (configuration.invalidValue !== undefined) {
    logger.warn("logging_configuration_invalid", {
      configuredLevel: configuration.invalidValue,
      fallbackLevel: configuration.level,
    });
  }

  return logger;
}
