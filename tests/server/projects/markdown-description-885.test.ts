import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { isSafeMarkdownDescription, safeDescriptionUrl } from "../../../src/lib/markdown/description-policy";
import { plainToMarkdownLiteral } from "../../../src/features/markdown/plain-to-markdown";

describe("Issue #885 explicit description format and Markdown safety", () => {
  it("adds checked plain defaults without touching legacy content", () => {
    const { database } = openDatabase({ filename: ":memory:", migrationsDirectory: join(process.cwd(), "db", "migrations") });
    try {
      for (const table of ["tasks", "project_issues"] as const) {
        const columns = database.prepare("PRAGMA table_info(" + table + ")").all() as { name: string; notnull: number; dflt_value: string }[];
        expect(columns.find(column => column.name === "description_format")).toMatchObject({ notnull: 1, dflt_value: "'plain'" });
      }
    } finally { database.close(); }
  });

  it("supports GFM, code fences and http(s) while rejecting HTML, images and unsafe protocols", () => {
    expect(isSafeMarkdownDescription("# 제목\n\n- [x] 완료\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[문서](https://example.com/x)")).toBe(true);
    expect(isSafeMarkdownDescription("~~~html\n<script>alert(1)</script>\n~~~")).toBe(true);
    expect(isSafeMarkdownDescription("<script>alert(1)</script>")).toBe(false);
    expect(isSafeMarkdownDescription("![자동 요청](https://example.com/pixel.png)")).toBe(false);
    expect(isSafeMarkdownDescription("[click](javascript:alert(1))")).toBe(false);
    expect(isSafeMarkdownDescription("[relative](/local/path)")).toBe(false);
    expect(isSafeMarkdownDescription("[data](data:text/html,abc)")).toBe(false);
    expect(safeDescriptionUrl("https://example.com/a")).toBe(true);
    expect(safeDescriptionUrl("http://example.com/a")).toBe(true);
    expect(safeDescriptionUrl("javascript:alert(1)")).toBe(false);
  });

  it("does not interpret legacy formatting unless the user explicitly converts", () => {
    const original = "literal **bold** # heading [link](https://example.com) <script>";
    const converted = plainToMarkdownLiteral(original);
    expect(converted).toContain("\\*\\*bold\\*\\*");
    expect(converted).toContain("&lt;script&gt;");
    expect(isSafeMarkdownDescription(converted)).toBe(true);
  });
});
