import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { displayName, messages, translate, type MessageCatalog } from "../../src/lib/i18n";
import { coreMessages } from "../../src/lib/i18n/catalogs/core";
import { shellMessages } from "../../src/lib/i18n/catalogs/shell";
import { domainsMessages } from "../../src/lib/i18n/catalogs/domains";
import { domainErrorsMessages } from "../../src/lib/i18n/catalogs/domain-errors";
import { phaseCMessages } from "../../src/lib/i18n/catalogs/phase-c";

const placeholders = (value: string) => [...new Set(value.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g) ?? [])].sort();

describe("Issue #866 Phase C presentation contract", () => {
  it("preserves placeholders across all languages, including semantic Korean aliases", () => {
    for (const [key, entry] of Object.entries(messages)) {
      const expected = placeholders(entry.ko ?? key);
      for (const locale of ["ko", "en", "vi"] as const) {
        const text = locale === "ko" ? entry.ko ?? key : entry[locale];
        expect(text.trim(), `${key}:${locale}`).not.toBe("");
        expect(placeholders(text), `${key}:${locale}`).toEqual(expected);
        const variants = entry.plural?.[locale];
        if (!variants) continue;
        for (const [form, variant] of Object.entries(variants)) {
          expect(variant.trim(), `${key}:${locale}:${form}`).not.toBe("");
          // A plural form may spell out the count, but cannot drop other values
          // or introduce parameters the caller never supplies.
          expect(placeholders(variant).filter(value => value !== "{count}"), `${key}:${locale}:${form}`)
            .toEqual(expected.filter(value => value !== "{count}"));
        }
      }
    }
    expect(translate("ko", "issue.action.register")).toBe("등록");
    expect(translate("en", "issue.action.register")).toBe("Register");
    expect(translate("vi", "issue.status.registered")).toBe("Đã đăng ký");
  });

  it("preserves the product entity term Milestone across supported display languages", () => {
    for (const key of ["Milestone Timeline 기술 미리보기", "Milestone 연결…", "Summary, 일반 작업, milestone과 Finish-to-Start 연결을 표시하는 브라우저 전용 fixture입니다."]) {
      for (const locale of ["en", "vi"] as const) expect(translate(locale, key), `${locale}:${key}`).toMatch(/Milestone/i);
    }
  });

  it("keeps Phase A/B translations authoritative when Phase C adds overlapping keys", () => {
    const previous: MessageCatalog = Object.assign({}, coreMessages, shellMessages, domainsMessages, domainErrorsMessages);
    for (const [key, entry] of Object.entries(previous)) expect(messages[key], key).toEqual(entry);
    for (const [key, entry] of Object.entries(phaseCMessages)) {
      if (!Object.hasOwn(previous, key)) expect(messages[key], key).toEqual(entry);
    }
    expect(translate("en", "전체")).toBe("All");
    expect(translate("en", "작업")).toBe("Task");
  });

  it("treats user parameters and canonical names as opaque text, with explicit optional name translations", () => {
    const name = "{count} 주요 메뉴 <script>secret</script> & ' \"";
    const item = { id: "canonical-owner-id", name, translations: { en: "Managed name", vi: "  " } };
    const before = JSON.stringify(item);
    for (const locale of ["ko", "en", "vi"] as const) {
      const rendered = translate(locale, "선택한 리소스: {name}", { name });
      expect(rendered).toContain(name);
      expect(translate(locale, "선택한 리소스: {name}")).toContain("{name}");
      expect(displayName({ name }, locale)).toBe(name);
      expect(displayName(item, locale)).toBe(locale === "en" ? "Managed name" : name);
    }
    expect(JSON.stringify(item)).toBe(before);
    expect(displayName({ name, translations: { ko: "한국어 표시", vi: "Tên quản lý" } }, "ko")).toBe("한국어 표시");
    expect(translate("vi", "{count}개 프로젝트에서 사용 중", { count: 1234 })).toContain("1.234");
  });

  it("provides translations for Korean t/translate literals in Phase C feature sources", () => {
    const root = fileURLToPath(new URL("../../src/features/", import.meta.url));
    const missing: string[] = [];
    function scan(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) { scan(path); continue; }
        if (!/\.tsx?$/.test(entry.name)) continue;
        const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, entry.name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        function visit(node: ts.Node) {
          if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["t", "translate"].includes(node.expression.text)) {
            const argument = node.arguments[node.expression.text === "t" ? 0 : 1];
            function checkKey(value: ts.Expression | undefined) {
              if (!value) return;
              if (ts.isConditionalExpression(value)) { checkKey(value.whenTrue); checkKey(value.whenFalse); return; }
              if (ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) { checkKey(value.left); checkKey(value.right); return; }
              if (ts.isStringLiteralLike(value) && /[가-힣]/.test(value.text) && !Object.hasOwn(messages, value.text)) {
                missing.push(`${path.slice(root.length)}: ${value.text}`);
              }
            }
            checkKey(argument);
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
    for (const feature of ["projects", "gantt", "logistics", "resources", "milestones", "templates", "country-calendars", "project-master"]) scan(`${root}${feature}`);
    expect(missing).toEqual([]);
  });
});
