export type CountryCalendarError = { text: string; opaque: boolean | readonly boolean[] };

export function resolveCountryCalendarError(body: unknown, fallback: string): CountryCalendarError {
  const error = body && typeof body === "object" && "error" in body && body.error && typeof body.error === "object" ? body.error : null;
  const upstream = error && "message" in error && typeof error.message === "string" && error.message.trim() ? error.message : null;
  const lines = (upstream ?? fallback).split("\n");
  const opaque = lines.map(() => upstream !== null);
  const details = error && "details" in error && Array.isArray(error.details) ? error.details : [];
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue;
    const path = "path" in detail && typeof detail.path === "string" ? detail.path : null;
    const message = "message" in detail && typeof detail.message === "string" ? detail.message : null;
    if (path === null && message === null) continue;
    const detailLines = `${path ?? "입력"}: ${message ?? "확인해 주세요."}`.split("\n");
    lines.push(...detailLines);
    opaque.push(...detailLines.map(() => true));
  }
  return { text: lines.join("\n"), opaque };
}

/** Preserve opaque server-side validation details; only local strings are i18n keys. */
export function presentCountryCalendarError(message: string, opaque: CountryCalendarError["opaque"], translateLocal: (key: string) => string): string {
  return message.split("\n").map((line, index) => (typeof opaque === "boolean" ? opaque : opaque[index] ?? true) ? line : translateLocal(line)).join("\n");
}
