import { expect, test } from "@playwright/test";
import { expectSameGanttRoot, installStatefulProjectFixture, publicId, rememberGanttRoot, rowNamed } from "../fixtures/stateful-project";

test.describe("Issue #552 replaces #196 quick views with independent Milestone visibility", () => {
  test("일정 Toolbar의 단일 토글은 기본 ON이며 WBS는 Summary/Task만 표시한다", async ({ page }) => {
    await installStatefulProjectFixture(page); await page.goto(`/projects/${publicId}`);
    const toggle = page.getByRole("button", { name: "◆ Milestone 표시", exact: true });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "작업 유형 빠른 보기" })).toHaveCount(0);
    await expect(rowNamed(page, "Stable summary")).toBeVisible(); await expect(rowNamed(page, "Stable leaf")).toBeVisible();
    await expect(page.locator('.wx-table-container .wx-row[data-id$="00000000-0000-4000-8000-000000000004"]')).toHaveCount(0);
    await expect(page.getByLabel("Milestone Timeline", { exact: true })).toBeVisible();
  });
  test("Task 유형과 표시 전환은 ancestor context·canonical data·instance를 보존하고 mutation이 없다", async ({ page }) => {
    const state = await installStatefulProjectFixture(page); const before = JSON.stringify([state.tasks,state.links]);
    const documents: string[] = [], mutations: string[] = [];
    page.on("request", request => { if (request.resourceType() === "document") documents.push(request.url()); if (!["GET","HEAD"].includes(request.method())) mutations.push(request.method()); });
    await page.goto(`/projects/${publicId}`); const identity = await rememberGanttRoot(page); documents.length=0; mutations.length=0;
    await page.getByRole("button", { name: "필터", exact: true }).click();
    await page.getByRole("group", { name: "Task type", exact: true }).getByRole("checkbox", { name: "task", exact: true }).check();
    await page.keyboard.press("Escape");
    await expect(rowNamed(page,"Stable leaf")).toBeVisible(); await expect(rowNamed(page,"Existing summary child")).toBeVisible(); await expect(rowNamed(page,"Stable summary")).toBeVisible();
    const toggle=page.getByRole("button",{name:"◆ Milestone 표시",exact:true});
    for(const on of [false,true]) { await toggle.click(); await expect(toggle).toHaveAttribute("aria-pressed",String(on)); await expect(rowNamed(page,"Existing summary child")).toBeVisible(); await expectSameGanttRoot(page,identity); }
    await page.getByRole("button",{name:"초기화",exact:true}).click(); await expect(toggle).toHaveAttribute("aria-pressed","true");
    expect(JSON.stringify([state.tasks,state.links])).toBe(before); expect(documents).toEqual([]); expect(mutations).toEqual([]);
  });
  test("검색어와 Task 유형은 AND이며 Timeline 토글로 검색 조건과 전체 M 모집단을 바꾸지 않는다",async({page})=>{
    await installStatefulProjectFixture(page);await page.goto(`/projects/${publicId}`);
    const search=page.getByRole("searchbox",{name:"작업명, 설명, External ID 검색"});await search.fill("Existing");
    await page.getByRole("button",{name:/^필터/}).click();await page.getByRole("group",{name:"Task type",exact:true}).getByRole("checkbox",{name:"task",exact:true}).check();await page.keyboard.press("Escape");
    await expect(rowNamed(page,"Existing summary child")).toBeVisible();await expect(rowNamed(page,"Stable leaf")).toHaveCount(0);
    const toggle=page.getByRole("button",{name:"◆ Milestone 표시",exact:true});await toggle.click();await toggle.click();
    await expect(search).toHaveValue("Existing");await expect(rowNamed(page,"Existing summary child")).toBeVisible();await expect(rowNamed(page,"Stable leaf")).toHaveCount(0);
    await expect(page.getByRole("button",{name:/프로젝트 전체 Milestone 목록 1개/})).toBeVisible();
  });
});
