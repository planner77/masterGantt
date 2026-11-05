/** Preserve opaque server-side validation details; only local strings are i18n keys. */
export function presentCountryCalendarError(message: string, opaque: boolean, translateLocal: (key: string) => string): string {
  return message.split("\n").map(line => opaque ? line : translateLocal(line)).join("\n");
}
