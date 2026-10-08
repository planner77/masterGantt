import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  installStatefulProjectFixture,
  publicId,
  projectPath,
  rememberGanttRoot,
  expectSameGanttRoot,
} from "../fixtures/stateful-project";
import {
  planUiFixture,
  planDetailsUiFixture,
  planId,
} from "../fixtures/resource-plan-ui";
import { resourceDashboardUiFixture } from "../fixtures/resource-dashboard-ui";
const root = (page: import("@playwright/test").Page) =>
  page.locator('[data-resource-dashboard="true"]');
const viewport = (page: import("@playwright/test").Page) =>
  page.locator(".project-gantt-frame").evaluate((el) => ({
    public: Reflect.get(el, "__masterganttPublicViewport"),
    dom: {
      left: el.querySelector(".wx-chart")!.scrollLeft,
      top: el.querySelector(".wx-gantt")!.scrollTop,
    },
    columns: Array.from(el.querySelectorAll(".wx-header .wx-cell")).map(
      (c) => c.getBoundingClientRect().width,
    ),
    selection: Array.from(el.querySelectorAll(".wx-row.wx-selected")).map((r) =>
      r.getAttribute("data-id"),
    ),
    tree: Array.from(el.querySelectorAll(".wx-row")).map((r) =>
      r.getAttribute("data-id"),
    ),
  }));
async function setup(page: import("@playwright/test").Page) {
  const state = await installStatefulProjectFixture(page);
  for (let i = 10; i < 45; i++)
    state.tasks.push({
      ...state.tasks[2],
      taskId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      externalId: `PLAN-${i}`,
      name: `작업면 ${i}`,
      siblingOrder: i,
    });
  await page.route(`**${projectPath}/resource-dashboard?*`, (route) => {
    const q = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        data: q.has("granularity")
          ? planUiFixture(state, q).data
          : resourceDashboardUiFixture(state, q),
      },
    });
  });
  for (const kind of ["daily", "day-resources", "day-assignments"] as const)
    await page.route(
      `**${projectPath}/resource-dashboard/plan/${kind}?*`,
      (route) =>
        route.fulfill({
          json: {
            data: planDetailsUiFixture(
              state,
              new URL(route.request().url()).searchParams,
              kind,
            ),
          },
        }),
    );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/projects/${publicId}`);
  const identity = await rememberGanttRoot(page);
  await page.getByRole("button", { name: "주", exact: true }).click();
  const frame = page.locator(".project-gantt-frame");
  await frame
    .locator('.wx-row[data-id=":00000000-0000-4000-8000-000000000003"]')
    .first()
    .click();
  await expect(frame.locator(".wx-row.wx-selected")).toHaveCount(1);
  // Selection can queue SVAR's show-task scroll after the next paint. Do not
  // capture a transient DOM position while canonical scale/selection sync runs.
  await expect.poll(async () => frame.evaluate((el) => {
    const generation = el.dataset.ganttCanonicalSyncGeneration;
    return Boolean(generation &&
      generation === el.dataset.ganttCanonicalSyncSettledGeneration &&
      el.dataset.ganttCanonicalSyncDepth === "0");
  }), { timeout: 15_000 }).toBe(true);
  // Establish the intended manual viewport after pending task reveal settles.
  // Verify multiple animation frames; a one-frame 120px reading is insufficient.
  await expect.poll(async () => frame.evaluate(async (el) => {
    const chart = el.querySelector<HTMLElement>(".wx-chart");
    const gantt = el.querySelector<HTMLElement>(".wx-gantt");
    if (!chart || !gantt) throw new Error("Gantt scrollers are not mounted");
    gantt.scrollTop = 96;
    chart.scrollLeft = 120;
    const samples: Array<{ left: number; top: number }> = [];
    for (let i = 0; i < 5; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      samples.push({ left: chart.scrollLeft, top: gantt.scrollTop });
    }
    const final = samples[samples.length - 1];
    return samples.every((sample) => sample.left === 120 && sample.top === 96)
      ? { left: 120, top: 96 }
      : final;
  }), { timeout: 15_000, intervals: [100, 250, 500, 1000] }).toEqual({ left: 120, top: 96 });
  const before = await viewport(page);
  await page.getByRole("tab", { name: "리소스", exact: true }).click();
  await expect(root(page)).toHaveAttribute("data-ready", "true");
  await root(page)
    .getByLabel("리소스 보기", { exact: true })
    .selectOption("plan");
  await expect(
    root(page).getByRole("region", { name: "Resource Plan", exact: true }),
  ).toBeVisible();
  return { state, identity, before };
}
test("#527 week/month two hierarchies 20geometry, bound50rows, sticky lastwindow and nativeGantt", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { identity, before } = await setup(page),
    r = root(page),
    plan = r.getByRole("region", { name: "Resource Plan", exact: true }),
    evidence = [];
  mkdirSync("output/playwright/issue-527", { recursive: true });
  for (const granularity of ["week", "month"] as const) {
    await r.getByLabel("기간 단위", { exact: true }).selectOption(granularity);
    await expect(r).toHaveAttribute("data-ready", "true");
    for (const mode of ["group", "resource"] as const) {
      await r
        .getByRole("button", {
          name: mode === "group" ? "그룹" : "개인",
          exact: true,
        })
        .click();
      const region = plan.getByRole("region", {
          name: `${mode === "group" ? "그룹" : "개인"} 기간 계획표`,
          exact: true,
        }),
        table = region.locator("table");
      if (mode === "group") {
        const disclosure = table
          .locator('tr[data-plan-row="group"]')
          .first()
          .locator("th button");
        if ((await disclosure.getAttribute("aria-expanded")) === "false")
          await disclosure.click();
      }
      const person = table
        .locator('tr[data-plan-row="resource"]')
        .first()
        .getByRole("button")
        .first();
      if ((await person.getAttribute("aria-expanded")) === "false")
        await person.click();
      await expect(
        table.locator('tr[data-plan-row="resourceMilestone"]'),
      ).toHaveCount(2);
      for (const width of [390, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await region.scrollIntoViewIfNeeded();
        const value = await table.evaluate((el) => {
          const headers = Array.from(el.querySelectorAll("thead th")).map((c) =>
              c.getBoundingClientRect(),
            ),
            rows = Array.from(el.querySelectorAll("tbody tr")),
            owner = el.closest(".resource-dashboard-table-scroll")!;
          return {
            viewport: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            rows: rows.length,
            resourceRows: el.querySelectorAll('[data-plan-row="resource"]')
              .length,
            milestoneRows: el.querySelectorAll(
              '[data-plan-row="resourceMilestone"]',
            ).length,
            columns: headers.length,
            headerWidths: headers.map((h) => h.width),
            maxRowHeight: Math.max(
              ...rows.map((row) => row.getBoundingClientRect().height),
            ),
            aligned: rows.every((row) =>
              Array.from(row.children).every(
                (c, i) =>
                  Math.abs(c.getBoundingClientRect().width - headers[i].width) <
                    1 &&
                  Math.abs(c.getBoundingClientRect().left - headers[i].left) <
                    1,
              ),
            ),
            contained: Array.from(el.querySelectorAll("button")).every((b) => {
              const c = b.closest("th,td")!.getBoundingClientRect(),
                r = b.getBoundingClientRect();
              return r.left >= c.left - 1 && r.right <= c.right + 1;
            }),
            ownerClient: owner.clientWidth,
            ownerScroll: owner.scrollWidth,
            sticky: getComputedStyle(el.querySelector("tbody th")!).position,
            maxName: Math.max(
              ...rows.map((row) => row.children[0].textContent!.length),
            ),
          };
        });
        expect(value.documentWidth).toBe(width);
        expect(value.rows).toBeLessThanOrEqual(50);
        expect(value.resourceRows).toBeGreaterThan(0);
        expect(value.milestoneRows).toBe(2);
        expect(value.aligned && value.contained).toBe(true);
        expect(value.headerWidths[0]).toBe(width <= 600 ? 144 : 280);
        expect(value.headerWidths.slice(1).every((w) => w >= 176)).toBe(true);
        expect(value.sticky).toBe("sticky");
        if (width === 390)
          expect(value.ownerScroll).toBeGreaterThan(value.ownerClient);
        if (width === 390) {
          await region.evaluate((owner) => {
            owner.scrollLeft = 180;
            owner.scrollTop = 100;
          });
          const sticky = await table.evaluate((el) => {
            const owner = el.parentElement!,
              o = owner.getBoundingClientRect(),
              corner = el.querySelector("thead th")!,
              c = corner.getBoundingClientRect(),
              identity = el.querySelector("tbody th")!.getBoundingClientRect();
            return {
              left: owner.scrollLeft,
              top: owner.scrollTop,
              identityDelta: identity.left - o.left,
              headerDelta: c.top - o.top,
              cornerTopmost:
                document
                  .elementFromPoint(c.left + 20, c.top + 20)
                  ?.closest("th") === corner,
            };
          });
          expect(sticky.left).toBeGreaterThan(0);
          expect(sticky.top).toBeGreaterThan(0);
          expect(Math.abs(sticky.identityDelta)).toBeLessThanOrEqual(8);
          expect(Math.abs(sticky.headerDelta)).toBeLessThanOrEqual(8);
          expect(sticky.cornerTopmost).toBe(true);
          await region.focus();
          await page.keyboard.press("Tab");
          const focus = await region.evaluate((owner) => {
            const active = document.activeElement as HTMLElement,
              a = active.getBoundingClientRect(),
              o = owner.getBoundingClientRect(),
              identity = owner
                .querySelector("tbody th")!
                .getBoundingClientRect(),
              header = owner.querySelector("thead th")!.getBoundingClientRect(),
              style = getComputedStyle(active),
              ring =
                parseFloat(style.outlineWidth) +
                parseFloat(style.outlineOffset);
            return {
              button: active.tagName,
              ring,
              left: a.left - ring,
              right: a.right + ring,
              top: a.top - ring,
              bottom: a.bottom + ring,
              visibleLeft: identity.right,
              visibleTop: header.bottom,
              ownerRight: o.right,
              ownerBottom: o.bottom,
            };
          });
          expect(focus.button).toBe("BUTTON");
          expect(focus.ring).toBeGreaterThan(0);
          expect(focus.left).toBeGreaterThanOrEqual(focus.visibleLeft);
          expect(focus.right).toBeLessThanOrEqual(focus.ownerRight);
          expect(focus.top).toBeGreaterThanOrEqual(focus.visibleTop);
          expect(focus.bottom).toBeLessThanOrEqual(focus.ownerBottom);
          Object.assign(value, { stickyScroll: sticky, nativeFocus: focus });
          await region.evaluate((owner) => {
            owner.scrollLeft = 0;
            owner.scrollTop = 0;
          });
        }
        evidence.push({ granularity, mode, ...value });
        await page.screenshot({
          path: `output/playwright/issue-527/${granularity}-${mode}-${width}.png`,
        });
      }
      await page.setViewportSize({ width: 390, height: 900 });
      const next = plan.getByRole("button", { name: "기간 다음", exact: true });
      while (await next.isEnabled()) await next.click();
      const last = await table.locator("thead th").first().boundingBox();
      expect(last!.width).toBe(144);
      await table.locator("tbody td button").first().focus();
      await table.locator("tbody td button").first().press("Enter");
      await expect(plan.locator(".resource-plan-detail h3")).toBeFocused();
      await plan.locator(".resource-plan-detail h3").press("Escape");
      await expect(table.locator("tbody td button").first()).toBeFocused();
      while (
        await plan
          .getByRole("button", { name: "기간 이전", exact: true })
          .isEnabled()
      )
        await plan
          .getByRole("button", { name: "기간 이전", exact: true })
          .click();
    }
  }
  writeFileSync(
    "output/playwright/issue-527/geometry.json",
    JSON.stringify(evidence, null, 2),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expectSameGanttRoot(page, identity);
  await expect.poll(() => viewport(page)).toEqual(before);
});

test("#527 selected80/project140 parent warning, detail stack and paging focus", async ({
  page,
}) => {
  await setup(page);
  const r = root(page),
    plan = r.getByRole("region", { name: "Resource Plan", exact: true });
  await r.getByLabel("Milestone", { exact: true }).selectOption(planId(4, 0));
  await expect(r).toHaveAttribute("data-ready", "true");
  await r.getByRole("button", { name: "개인", exact: true }).click();
  await plan.getByLabel("기간 셀 지표").selectOption("load");
  const first = plan.locator('tr[data-plan-row="resource"]').first();
  await expect(first.locator("td").nth(1)).toContainText("80.00 %");
  await expect(first.locator("td").nth(1)).toContainText("Project 전체");
  const warning = first
    .locator("td")
    .nth(1)
    .getByRole("button", { name: /Project 전체/ });
  await warning.click();
  const detail = plan.getByRole("region", {
    name: "기간 부하 상세",
    exact: true,
  });
  await expect(detail).toContainText("현재 Project 전체 참고");
  await expect(detail.locator("tbody tr")).toHaveCount(7);
  await detail.getByRole("button", { name: "2024-01-01", exact: true }).click();
  await expect(detail).toContainText("선택 단계");
  await expect(detail).toContainText("다른 단계");
  await detail.locator("h3").press("Escape");
  await detail.locator("h3").press("Escape");
  await expect(warning).toBeFocused();
  await first.getByRole("button").first().click();
  await expect(first).toContainText("활성");
  await expect(
    plan.locator('tr[data-plan-row="resourceMilestone"]').first(),
  ).toContainText("단계 기여(선택)");
  await plan.getByLabel("부하 범위").selectOption("project");
  await expect(
    plan.locator('tr[data-plan-row="resourceMilestone"]').first(),
  ).toContainText("80.00 %");
  await expect(
    plan.locator('tr[data-plan-row="resourceMilestone"]').first(),
  ).toContainText("개인 전체 참고 140.00 %");
  await r.getByLabel("리소스 보기", { exact: true }).selectOption("summary");
  await r.getByLabel("리소스 보기", { exact: true }).selectOption("plan");
  await expect(r).toHaveAttribute("data-ready", "true");
  await expect(plan.getByLabel("부하 범위")).toHaveValue("project");
  await expect(
    plan.locator('tr[data-plan-row="resourceMilestone"]'),
  ).toHaveCount(1);
});

test("#527 50visible hierarchy page context and daily pager focus survive view return", async ({
  page,
}) => {
  await setup(page);
  const r = root(page);
  await r.getByLabel("기간 단위", { exact: true }).selectOption("month");
  await expect(r).toHaveAttribute("data-ready", "true");
  const plan = r.getByRole("region", { name: "Resource Plan", exact: true }),
    table = plan
      .getByRole("region", { name: "그룹 기간 계획표", exact: true })
      .locator("table");
  await table
    .locator('tr[data-plan-row="group"]')
    .first()
    .locator("th button")
    .click();
  for (let i = 0; i < 24; i++) {
    const disclosure = table
      .locator('tr[data-plan-row="resource"]')
      .filter({ hasText: new RegExp(`^개인 ${i} `) })
      .getByRole("button")
      .first();
    if (
      !(await disclosure.count()) &&
      (await plan
        .getByRole("button", { name: "행 다음", exact: true })
        .isEnabled())
    )
      await plan.getByRole("button", { name: "행 다음", exact: true }).click();
    if (await disclosure.count()) await disclosure.click();
  }
  await plan.getByRole("button", { name: "행 이전", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(50);
  await plan.getByRole("button", { name: "행 다음", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(34);
  const child = table.locator('tr[data-plan-row="resourceMilestone"]').first();
  await expect(child).toContainText("그룹 0");
  await expect(child).toContainText("개인");
  await r.getByLabel("리소스 보기", { exact: true }).selectOption("summary");
  await r.getByLabel("리소스 보기", { exact: true }).selectOption("plan");
  await expect(r).toHaveAttribute("data-ready", "true");
  await expect(table.locator("tbody tr")).toHaveCount(34);
  await plan
    .locator('tr[data-plan-row="total"] td')
    .last()
    .getByRole("button")
    .first()
    .click();
  const detail = plan.getByRole("region", {
    name: "기간 부하 상세",
    exact: true,
  });
  await expect(detail.locator("tbody tr")).toHaveCount(50);
  const next = detail.getByRole("button", { name: "다음", exact: true });
  await next.focus();
  await next.press("Enter");
  await expect(next).toBeFocused();
  await expect(detail).toContainText("51–100 / 366");
  await detail
    .getByRole("button", { name: "상세 다시 시도", exact: true })
    .focus();
  await detail
    .getByRole("button", { name: "상세 다시 시도", exact: true })
    .press("Enter");
  await expect(
    detail.getByRole("button", { name: "상세 다시 시도", exact: true }),
  ).toBeFocused();
});

test("#527 canceled detail409 is ignored after leaving Plan and stale blocks all drill", async ({
  page,
}) => {
  await setup(page);
  const r = root(page),
    plan = r.getByRole("region", { name: "Resource Plan", exact: true });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered!: () => void;
  const requested = new Promise<void>((resolve) => {
    entered = resolve;
  });
  await page.route(
    `**${projectPath}/resource-dashboard/plan/daily?*`,
    async (route) => {
      entered();
      await held;
      await route
        .fulfill({ status: 409, json: { error: { code: "REPORT_STALE" } } })
        .catch(() => undefined);
    },
  );
  await plan
    .locator('tr[data-plan-row="total"] td')
    .last()
    .getByRole("button")
    .first()
    .click();
  await requested;
  await r.getByLabel("리소스 보기", { exact: true }).selectOption("summary");
  release();
  await expect(r).toHaveAttribute("data-ready", "true");
  await r.getByLabel("리소스 보기", { exact: true }).selectOption("plan");
  await expect(plan.getByRole("alert")).toContainText("데이터가 변경");
  await expect(
    plan.locator('tr[data-plan-row="total"] td button').first(),
  ).toBeDisabled();
});

test("#527 unknown and nonworking do not become available, R0 is target absence", async ({
  page,
}) => {
  await setup(page);
  const r = root(page),
    plan = r.getByRole("region", { name: "Resource Plan", exact: true });
  await r.getByRole("button", { name: "개인", exact: true }).click();
  const unknown = plan
    .locator('tr[data-plan-row="resource"]')
    .filter({ hasText: /^개인 3 / });
  await expect(unknown).toContainText("미산정");
  await expect(unknown).toContainText("미설정");
  await expect(unknown).toContainText("비근무기간");
  const zero = plan
    .locator('tr[data-plan-row="resource"]')
    .filter({ hasText: /^개인 7 / });
  await expect(zero).toContainText("0부하");
  await zero.locator("td").last().getByRole("button").first().click();
  const emptyDetail = plan.getByRole("region", {
    name: "기간 부하 상세",
    exact: true,
  });
  await emptyDetail.locator("tbody th button").first().click();
  await expect(emptyDetail).toContainText("0–0 / 0");
  await expect(
    emptyDetail.getByRole("button", { name: "다음", exact: true }),
  ).toBeDisabled();
  await emptyDetail.locator("h3").press("Escape");
  await emptyDetail.locator("h3").press("Escape");

  await r.getByRole("button", { name: /^필터/ }).click();
  await r
    .getByLabel("Global Role", { exact: true })
    .selectOption("EQUIPMENT_OWNER");
  await expect(r).toHaveAttribute("data-ready", "true");
  await expect(plan).toContainText(
    "조회 조건에 맞는 Project 개인 할당 이력이 없습니다",
  );
  await expect(plan.locator("table")).toHaveCount(0);
});
