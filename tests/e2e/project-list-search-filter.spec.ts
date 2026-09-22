import { randomUUID } from "node:crypto";
import { expect, test, isolatedApplicationOptions } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

async function createProject(page: import("@playwright/test").Page, baseURL: string, name: string, ownerName: string, description: string, password: string) {
  const response = await page.request.post("/api/projects", {
    headers: { Origin: baseURL },
    data: { name, ownerName, description, editPassword: password },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).data.project.publicId as string;
}

test.describe("Issue #84 프로젝트 목록 검색·필터", () => {
  test("Quick Search와 고급 조건을 AND로 조합하고 서버 재조회 없이 초기화한다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    await createProject(page, baseURL!, `AMR Alpha ${suffix}`, "Automation Team", "Vietnam logistics", `Password-A-${suffix}`);
    await createProject(page, baseURL!, `Stocker Beta ${suffix}`, "Storage Team", "Korea stocker", `Password-B-${suffix}`);

    let collectionGets = 0;
    page.on("request", (request) => {
      if (request.method() === "GET" && new URL(request.url()).pathname === "/api/projects") collectionGets += 1;
    });

    await page.goto("/");
    const table = page.getByRole("table", { name: "프로젝트 목록" });
    await expect(table).toBeVisible();
    const initialGets = collectionGets;

    const search = page.getByLabel("프로젝트명, 소유자 또는 설명 검색");
    await search.fill(`  vietnam  `);
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table).toContainText(`AMR Alpha ${suffix}`);
    await expect(page.locator(".project-filter-result")).toContainText("1 / 2개 프로젝트");
    expect(collectionGets).toBe(initialGets);

    const filterButton = page.getByRole("button", { name: /필터 1/ });
    await filterButton.click();
    const panel = page.getByLabel("프로젝트 고급 필터");
    await panel.getByRole("textbox", { name: "프로젝트명", exact: true }).fill("alpha");
    await expect(page.getByRole("button", { name: /필터 2/ })).toBeVisible();
    await panel.getByLabel("소유자 지정 여부").selectOption("assigned");
    await expect(page.getByRole("button", { name: /필터 3/ })).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(1);

    await panel.getByRole("textbox", { name: "프로젝트명", exact: true }).fill("does-not-match");
    await expect(page.getByRole("heading", { name: "조건에 맞는 프로젝트가 없습니다." })).toBeVisible();
    await page.getByRole("button", { name: "검색/필터 초기화" }).click();
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(search).toHaveValue("");
    expect(collectionGets).toBe(initialGets);
  });

  test("browser timezone 날짜 필터, Escape focus 복귀와 검색 상태의 Row Action을 유지한다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    const name = `Timezone Project ${suffix}`;
    await createProject(page, baseURL!, name, "Timezone Team", "calendar-date", `Password-T-${suffix}`);
    const collection = await (await page.request.get("/api/projects")).json();
    const project = collection.data.projects.find((candidate: { name: string }) => candidate.name === name);
    expect(project).toBeTruthy();

    await page.goto("/");
    const search = page.getByLabel("프로젝트명, 소유자 또는 설명 검색");
    await search.fill("timezone");
    const filterButton = page.locator('button[aria-controls="project-list-advanced-filter"]');
    await filterButton.click();
    const panel = page.getByLabel("프로젝트 고급 필터");
    const browserDate = await page.evaluate((value) => {
      const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
      const part = (type: string) => parts.find((item) => item.type === type)!.value;
      return `${part("year")}-${part("month")}-${part("day")}`;
    }, project.createdAt);
    await panel.getByLabel("생성일 조건").selectOption("equals");
    await panel.locator('input[type="date"]').first().fill(browserDate);
    await expect(page.getByRole("table", { name: "프로젝트 목록" }).locator("tbody tr")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(filterButton).toBeFocused();

    const trigger = page.getByRole("button", { name: `${name} 프로젝트 작업`, exact: true });
    await trigger.click();
    await expect(page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(search).toHaveValue("timezone");
  });

  test("검색 상태에서 삭제 성공 후 삭제된 프로젝트가 결과에 남지 않는다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    const name = `Delete Filtered ${suffix}`;
    const password = `Password-D-${suffix}`;
    await createProject(page, baseURL!, name, "Delete Team", "delete filtered row", password);
    await createProject(page, baseURL!, `Keep ${suffix}`, "Keep Team", "other row", `Password-K-${suffix}`);

    await page.goto("/");
    const search = page.getByLabel("프로젝트명, 소유자 또는 설명 검색");
    await search.fill("delete filtered");
    const row = page.getByRole("table", { name: "프로젝트 목록" }).locator("tbody tr");
    await expect(row).toHaveCount(1);

    await row.getByRole("button", { name: `${name} 프로젝트 작업`, exact: true }).click();
    await page.getByRole("menu", { name: `${name} 프로젝트 작업`, exact: true }).getByRole("menuitem", { name: "삭제" }).click();
    const dialog = page.getByRole("dialog", { name: "프로젝트 삭제" });
    await dialog.getByLabel("삭제 확인 비밀번호").fill(password);
    await dialog.getByRole("button", { name: "비밀번호 확인 후 삭제" }).click();

    await expect(page.getByRole("heading", { name: "조건에 맞는 프로젝트가 없습니다." })).toBeVisible();
    await expect(search).toHaveValue("delete filtered");
    await expect(page.locator(".project-filter-result")).toContainText("0 / 1개 프로젝트");
  });

  test("390/768/1024/1440에서 문서 수준 가로 overflow가 없다", async ({ page, baseURL }) => {
    const suffix = randomUUID().slice(0, 8);
    await createProject(page, baseURL!, `Responsive ${suffix}`, "Responsive Team", "responsive search", `Password-R-${suffix}`);
    await page.goto("/");
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByLabel("프로젝트명, 소유자 또는 설명 검색")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    }
  });
});
