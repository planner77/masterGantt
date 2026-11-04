import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(filename) : /\.tsx?$/.test(filename) ? [filename] : [];
  });
}

function runtimeImports(filename: string, text: string): { client: boolean; imports: string[] } {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      if (!clause?.isTypeOnly && !(bindings && ts.isNamedImports(bindings) && !clause?.name
          && bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly))) {
        imports.push(node.moduleSpecifier.text);
      }
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.exportClause;
      if (!(clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((element) => element.isTypeOnly))) imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  const client = source.statements.some((statement) => ts.isExpressionStatement(statement)
    && ts.isStringLiteral(statement.expression) && statement.expression.text === "use client");
  return { client, imports };
}

function llmClientViolations(files: Map<string, string>): string[] {
  const graph = new Map([...files].map(([filename, text]) => [filename, runtimeImports(filename, text)]));
  const violations = new Set<string>();
  for (const [entry, metadata] of graph) {
    if (!metadata.client) continue;
    const visited = new Set<string>();
    const visit = (filename: string) => {
      if (visited.has(filename)) return;
      visited.add(filename);
      if (filename.startsWith(path.join(root, "src/server/llm/") )) violations.add(path.relative(root, filename));
      for (const specifier of graph.get(filename)?.imports ?? []) {
        const imported = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2))
          : specifier.startsWith(".") ? path.resolve(path.dirname(filename), specifier) : undefined;
        if (!imported) continue;
        const target = [imported, `${imported}.ts`, `${imported}.tsx`, path.join(imported, "index.ts"), path.join(imported, "index.tsx")].find((candidate) => graph.has(candidate));
        if (target) visit(target);
      }
    };
    visit(entry);
  }
  return [...violations].sort();
}

describe("LLM server/client and secret boundaries (static source regression)", () => {
  it("rejects direct, indirect and dynamic client imports of the LLM implementation in the real source graph", () => {
    const files = new Map(sourceFiles(path.join(root, "src")).map((filename) => [filename, readFileSync(filename, "utf8")]));
    expect(llmClientViolations(files)).toEqual([]);
  });

  it("detects the actual leak pattern through re-exports and lazy imports, while allowing erased type imports", () => {
    const source = path.join(root, "src");
    const core = path.join(source, "server/llm/client-core.ts");
    const bridge = path.join(source, "lib/bridge.ts");
    const client = path.join(source, "features/client.tsx");
    const fixtures = new Map([[core, "export const secret = 'fake-fixture';"], [bridge, 'export { secret } from "../server/llm/client-core";'], [client, '"use client"; import { secret } from "../lib/bridge";']]);
    expect(llmClientViolations(fixtures)).toEqual(["src/server/llm/client-core.ts"]);
    fixtures.set(client, '"use client"; void import("../server/llm/client-core");');
    expect(llmClientViolations(fixtures)).toEqual(["src/server/llm/client-core.ts"]);
    fixtures.set(client, '"use client"; import type { LlmResult } from "../server/llm/types";');
    expect(llmClientViolations(fixtures)).toEqual([]);
  });

  it("has a server-only guarded public entry, lazy runtime env, no public prompt route or logging sink", () => {
    const llm = sourceFiles(path.join(root, "src/server/llm"));
    const entry = readFileSync(path.join(root, "src/server/llm/index.ts"), "utf8");
    expect(entry).toMatch(/^import "server-only";/);
    expect(entry).toContain("createLlmClient(() => process.env)");
    for (const filename of llm) {
      const text = readFileSync(filename, "utf8");
      expect(text, path.relative(root, filename)).not.toMatch(/NEXT_PUBLIC_|console\s*\.|getServerLogger|logger\.(?:debug|info|warn|error)|process\.(?:stdout|stderr)/);
      if (!filename.endsWith("index.ts")) expect(text).not.toContain("process.env");
    }
    const config = readFileSync(path.join(root, "next.config.ts"), "utf8");
    expect(config).not.toContain("LLM_API_KEYS_JSON");
    expect(sourceFiles(path.join(root, "src/app/api")).filter((filename) => /[/\\]llm[/\\]/.test(filename))).toEqual([]);
  });
});
