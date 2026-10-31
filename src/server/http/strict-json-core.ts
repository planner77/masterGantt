export type StrictJsonErrorKind = "tooLarge" | "invalidUtf8" | "invalidJson" | "duplicateKey" | "depth";
export interface StrictJsonOptions {
  maximumBytes: number;
  maximumDepth: number;
  error: (kind: StrictJsonErrorKind) => Error;
}

/** Scan before JSON.parse so duplicate keys cannot disappear during object construction. */
function checkJsonSyntax(text: string, options: StrictJsonOptions): void {
  let cursor = 0;
  const invalid = (): never => { throw options.error("invalidJson"); };
  const whitespace = () => { while (/[\t\r\n ]/.test(text[cursor] ?? "") && cursor < text.length) cursor++; };
  const string = (): string => {
    if (text[cursor] !== '"') invalid();
    const start = cursor++;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === "\\") { if (cursor >= text.length) invalid(); cursor++; }
      else if (char === '"') {
        try { return JSON.parse(text.slice(start, cursor)) as string; } catch { return invalid(); }
      }
    }
    return invalid();
  };
  const value = (depth: number): void => {
    whitespace();
    const char = text[cursor];
    if (char === "{" || char === "[") {
      if (depth + 1 > options.maximumDepth) throw options.error("depth");
      cursor++;
      const end = char === "{" ? "}" : "]";
      whitespace();
      if (text[cursor] === end) { cursor++; return; }
      const keys = new Set<string>();
      while (true) {
        if (char === "{") {
          whitespace();
          const key = string();
          if (keys.has(key)) throw options.error("duplicateKey");
          keys.add(key);
          whitespace();
          if (text[cursor++] !== ":") invalid();
        }
        value(depth + 1);
        whitespace();
        const separator = text[cursor++];
        if (separator === end) return;
        if (separator !== ",") invalid();
      }
    }
    if (char === '"') { string(); return; }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, cursor)) { cursor += literal.length; return; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(cursor));
    if (!number) invalid();
    cursor += number![0].length;
  };
  value(0);
  whitespace();
  if (cursor !== text.length) invalid();
}

export function parseStrictJsonBytes(bytes: Uint8Array, options: StrictJsonOptions): unknown {
  if (bytes.byteLength > options.maximumBytes) throw options.error("tooLarge");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw options.error("invalidUtf8"); }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  checkJsonSyntax(text, options);
  try { return JSON.parse(text) as unknown; }
  catch { throw options.error("invalidJson"); }
}
