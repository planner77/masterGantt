import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProjectMasterItemDto } from "../../../src/contracts/project-master";
import { linkedProjectMasterChoices, ProjectMasterSelectFields } from "../../../src/features/projects/project-master-select-fields";

const language = vi.hoisted(() => ({ locale: "ko" as "ko" | "en" | "vi" }));
vi.mock("../../../src/lib/i18n/provider", () => ({ useI18n: () => ({ locale: language.locale }) }));

const product = (id: string, active = true): ProjectMasterItemDto => ({
  id,
  category: "PRODUCT",
  code: id,
  name: id,
  active,
  sortOrder: 0,
});

describe("Issue #866: 기준정보 선택의 언어별 표시명과 원본 선택", () => {
  it("세 선택 필드에서 현재 언어 동명만 코드로 구분하고 ID·원문 fallback을 보존한다", () => {
    const unit = { ...product("unit"), category: "BUSINESS_UNIT" as const, name: "사업부 원문", translations: { en: "Shared unit", vi: "Đơn vị" } };
    const otherUnit = { ...unit, id: "other-unit", code: "other-unit", name: "다른 사업부" };
    const selectedProduct = { ...product("product"), name: "제품 원문", translations: { en: "Product", vi: "Sản phẩm" } };
    const site = { ...product("site"), category: "SITE_ENTITY" as const, name: "사업장 원문", translations: { en: "Site", vi: "Địa điểm" } };
    const fallback = { ...product("fallback"), category: "BUSINESS_UNIT" as const, name: "번역 없는 원문", translations: { en: "", vi: "   " } };
    const onChange = vi.fn();
    for (const locale of ["ko", "en", "vi"] as const) {
      language.locale = locale;
      const html = renderToStaticMarkup(createElement(ProjectMasterSelectFields, {
        value: { businessUnitId: unit.id, productId: selectedProduct.id, siteEntityId: site.id },
        onChange, disabled: false,
        catalog: { data: { revision: 1, businessUnits: [unit, otherUnit, fallback], products: [selectedProduct], siteEntities: [site], relations: [
          { businessUnitId: unit.id, productId: selectedProduct.id, siteEntityId: null },
          { businessUnitId: unit.id, productId: selectedProduct.id, siteEntityId: site.id },
        ] } },
      }));
      const names = { ko: ["사업부 원문", "제품 원문", "사업장 원문"], en: ["Shared unit (unit)", "Product", "Site"], vi: ["Đơn vị (unit)", "Sản phẩm", "Địa điểm"] }[locale];
      expect(html).toContain(`<option value="unit" selected="">${names[0]}</option>`);
      expect(html).toContain(`<option value="product" selected="">${names[1]}</option>`);
      expect(html).toContain(`<option value="site" selected="">${names[2]}</option>`);
      expect(html).toContain('<option value="fallback">번역 없는 원문</option>');
      expect(onChange).not.toHaveBeenCalled();
    }
    expect(unit.name).toBe("사업부 원문");
    language.locale = "ko";
  });
});

describe("Issue #538: 종속 기준정보 선택 후보", () => {
  const linked = new Set(["active", "inactive"]);

  it("활성 상위 분류에서는 연결되고 활성인 하위 후보만 표시한다", () => {
    const choices = linkedProjectMasterChoices(
      [product("active"), product("inactive", false), product("unlinked")],
      linked,
      null,
      true,
    );
    expect(choices.map((item) => item.id)).toEqual(["active"]);
  });

  it("비활성 상위 분류의 신규 후보는 차단하지만 기존 legacy 선택은 표시한다", () => {
    const previous = product("legacy", false);
    const choices = linkedProjectMasterChoices(
      [product("active")], linked, previous, false,
    );
    expect(choices).toEqual([previous]);
    expect(linkedProjectMasterChoices([product("active")], linked, null, false)).toEqual([]);
  });

  it("연결된 기존 선택은 중복 표시하지 않는다", () => {
    const current = product("active");
    expect(linkedProjectMasterChoices([current], linked, current, true)).toEqual([current]);
  });
});
