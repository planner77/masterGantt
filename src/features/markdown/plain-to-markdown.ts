/** Escape punctuation when a user explicitly converts historical plain text. */
export function plainToMarkdownLiteral(value: string): string {
  return value.replace(/([\\\`*{}_[\]()#+.!>|~-])/g, "\\$1")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
