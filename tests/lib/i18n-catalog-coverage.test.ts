import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
import { messages } from "../../src/lib/i18n";

/** Check the actual UI call sites, rather than a hand-maintained key count. */
it("registers every static Korean translation key used by UI consumers", () => {
  const missing: string[] = [];
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) { if (entry.name !== "i18n") scan(file); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = readFileSync(file, "utf8");
      if (!source.includes("useI18n") && !source.includes("LocalizedText") && !source.includes("i18n")) continue;
      const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, entry.name.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      function visit(node: ts.Node) {
        const keyArgument = ts.isCallExpression(node) && ts.isIdentifier(node.expression)
          ? node.expression.text === "t" ? node.arguments[0] : node.expression.text === "translate" ? node.arguments[1] : undefined
          : undefined;
        if (keyArgument && ts.isStringLiteralLike(keyArgument)) {
          const key = keyArgument.text;
          if (/[가-힣]/.test(key) && !Object.hasOwn(messages, key)) missing.push(`${file.replace(`${process.cwd()}/`, "")}:${syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1}: ${key}`);
        }
        if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(syntax) === "LocalizedText") {
          for (const attribute of node.attributes.properties) {
            if (!ts.isJsxAttribute(attribute) || attribute.name.getText(syntax) !== "text" || !attribute.initializer) continue;
            const initializer = attribute.initializer;
            const text = ts.isStringLiteral(initializer) ? initializer.text : ts.isJsxExpression(initializer) && initializer.expression && ts.isStringLiteralLike(initializer.expression) ? initializer.expression.text : null;
            if (text && /[가-힣]/.test(text) && !Object.hasOwn(messages, text)) missing.push(`${file.replace(`${process.cwd()}/`, "")}:${syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1}: ${text}`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(syntax);
    }
  }
  scan(resolve(process.cwd(), "src"));
  expect(missing).toEqual([]);
});
