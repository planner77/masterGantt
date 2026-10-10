import { describe, expect, it } from "vitest";
import type { ProjectMasterItemDto } from "../../../src/contracts/project-master";
import { linkedProjectMasterChoices } from "../../../src/features/projects/project-master-select-fields";

const product = (id: string, active = true): ProjectMasterItemDto => ({
  id,
  category: "PRODUCT",
  code: id,
  name: id,
  active,
  sortOrder: 0,
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
