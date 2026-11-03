import { readdirSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
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
            const text = ts.isStringLiteral(initializer) ? jsxLiteralMessageText(initializer, syntax) : ts.isJsxExpression(initializer) && initializer.expression && ts.isStringLiteralLike(initializer.expression) ? initializer.expression.text : null;
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
            Object.hasOwn(messages, jsxLiteralMessageText(node.initializer, syntax));
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

const characterReference = /&(?:[a-z][a-z0-9]*|#[0-9]+|#x[0-9a-f]+);/gi;
const knownCharacterReferences = new Map<string, boolean>();

/** Inspect installed compiler semantics only in tests, never decode application text. */
function compiledJsxLiteralText(literalSource: string): string {
  const compiled = ts.transpileModule(`const element = <span text=${literalSource} />;`, {
    fileName: "quoted-attribute.tsx", compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext },
  }).outputText;
  const syntax = ts.createSourceFile("quoted-attribute.js", compiled, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let text: string | undefined;
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(syntax) === "text" && ts.isStringLiteralLike(node.initializer)) text = node.initializer.text;
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  if (text === undefined) throw new Error("Quoted JSX attribute did not compile to a static text property.");
  return text;
}

function hasEncodedCharacterReference(text: string): boolean {
  return [...text.matchAll(characterReference)].some(([reference]) => {
    let encoded = knownCharacterReferences.get(reference);
    if (encoded === undefined) {
      encoded = compiledJsxLiteralText(JSON.stringify(reference)) !== reference;
      knownCharacterReferences.set(reference, encoded);
    }
    return encoded;
  });
}

/** Quoted JSX attributes decode entities; expression values remain JavaScript text. */
function jsxLiteralMessageText(literal: ts.StringLiteral, source: ts.SourceFile): string {
  return hasEncodedCharacterReference(literal.text) ? compiledJsxLiteralText(literal.getText(source)) : literal.text;
}

function encodedStaticUiLiterals(source: string, file: string, catalog = false): string[] {
  const found: string[] = [];
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const inspect = (node: ts.Node) => {
    const text = ts.isStringLiteralLike(node) ? node.text : ts.isTemplateExpression(node)
      ? [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join("{expression}") : null;
    if (text && hasEncodedCharacterReference(text)) found.push(`${syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1}: ${text}`);
  };
  function visit(node: ts.Node) {
    if (catalog && ts.isStringLiteralLike(node)) inspect(node);
    if (!catalog && ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const key = node.expression.text === "t" ? node.arguments[0] : node.expression.text === "translate" ? node.arguments[1] : undefined;
      if (key) inspect(key);
    }
    if (!catalog && (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(syntax) === "LocalizedText") {
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxAttribute(attribute) && attribute.name.getText(syntax) === "text" && attribute.initializer &&
          ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) inspect(attribute.initializer.expression);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  return found;
}

it("keeps static translation expressions and catalog keys/values free of encoded character references", () => {
  const found: string[] = [];
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) { scan(file); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = readFileSync(file, "utf8");
      const catalog = file.startsWith(resolve(process.cwd(), "src/lib/i18n/catalogs") + sep);
      if (!catalog && !source.includes("useI18n") && !source.includes("LocalizedText") && !source.includes("i18n")) continue;
      found.push(...encodedStaticUiLiterals(source, file, catalog).map(value => `${file.replace(`${process.cwd()}/`, "")}:${value}`));
    }
  }
  scan(resolve(process.cwd(), "src"));
  expect(found).toEqual([]);
});

it("distinguishes JavaScript translation text from normal JSX, serializers and authored values", () => {
  const source = [
    'const authored = "User &amp; name";',
    'const escapeXml = value => value.replace(/&/g, "&amp;");',
    'const element = <><h2>A &amp; B</h2><span title="A &amp; B" /><LocalizedText text="A &amp; B" /><LocalizedText text={"A &amp; B"} /></>;',
    't("A &amp; B");',
    't(`A &gt; B`);',
    'translate("vi", "A &apos; B");',
    't("{name}", { name: authored });',
    't("A &copy; B");',
    't("A &notARealEntity; B");',
  ].join("\n");
  expect(encodedStaticUiLiterals(source, "entity-boundary.tsx")).toEqual([
    "3: A &amp; B", "4: A &amp; B", "5: A &gt; B", "6: A &apos; B", "8: A &copy; B",
  ]);
  const syntax = ts.createSourceFile("entity-boundary.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const quoted: ts.StringLiteral[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText(syntax) === "text" && node.initializer && ts.isStringLiteral(node.initializer)) quoted.push(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(syntax);
  expect(quoted.map(literal => jsxLiteralMessageText(literal, syntax))).toEqual(["A & B"]);
});
