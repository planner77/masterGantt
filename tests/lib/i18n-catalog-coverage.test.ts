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

/** Server pages must not escape coverage merely because they do not yet import i18n. */
it("localizes fixed Korean JSX in every application Server Component", () => {
  const unlocalized: string[] = [];
  const adminPages = new Set([
    "src/app/project-master-admin/page.tsx", "src/app/resources/page.tsx",
    "src/app/logistics-admin/page.tsx", "src/app/country-calendar-admin/page.tsx",
  ]);
  const technicalTerm = /^(?:masterGantt|SVAR|Task|Summary|Milestone|WBS|API|ID|JSON|CSV|Excel)$/;
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== "api") scan(resolve(directory, entry.name));
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      const file = resolve(directory, entry.name);
      const source = readFileSync(file, "utf8");
      const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      if (syntax.statements.some(statement => ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) && statement.expression.text === "use client")) continue;
      const report = (node: ts.Node, text: string) => unlocalized.push(
        `${file.replace(`${process.cwd()}/`, "")}:${syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1}: ${text.trim()}`,
      );
      function visit(node: ts.Node) {
        if (ts.isJsxText(node) && (/[가-힣]/.test(node.text) ||
          (adminPages.has(file.replace(`${process.cwd()}/`, "")) && /[A-Za-z]/.test(node.text) && !technicalTerm.test(node.text.trim())))) report(node, node.text);
        if (ts.isJsxExpression(node) && ts.isJsxElement(node.parent) && node.expression &&
          ts.isStringLiteralLike(node.expression) && /[가-힣]/.test(node.expression.text)) report(node, node.expression.text);
        if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) &&
          /^(?:aria-label|title|placeholder|alt|label)$/.test(node.name.getText(syntax)) && /[가-힣]/.test(node.initializer.text)) {
          const owner = node.parent.parent;
          const completeHelpLabel = (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)) &&
            owner.tagName.getText(syntax) === "ContextHelp" && node.name.getText(syntax) === "label" &&
            Object.hasOwn(messages, node.initializer.text);
          if (!completeHelpLabel) report(node, node.initializer.text);
        }
        ts.forEachChild(node, visit);
      }
      visit(syntax);
    }
  }
  scan(resolve(process.cwd(), "src/app"));
  expect(unlocalized).toEqual([]);
});
