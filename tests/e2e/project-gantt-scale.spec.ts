import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectSameGanttRoot, ganttRoot, installStatefulProjectFixture, publicId as statefulPublicId, rememberGanttRoot, rowNamed } from "../fixtures/stateful-project";

const publicId = "35000000-0000-4000-8000-000000000035";

async function wheelDensity(page: Page, row: Locator, height: number) {
  const frame = ganttRoot(page);
  const before = Number(await frame.getAttribute("data-gantt-cell-height"));
  const direction = height < before ? 120 : -120;
  for (let current = before; current !== height; current += direction > 0 ? -2 : 2) {
    const box = await row.boundingBox();
    if (!box) throw new Error("Density gesture requires a visible native Grid row");
    await page.mouse.move(box.x + Math.min(100, box.width / 2), box.y + box.height / 2);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, direction);
    await page.keyboard.up("Control");
    await expect(frame).toHaveAttribute("data-gantt-cell-height", String(current + (direction > 0 ? -2 : 2)));
  }
  await expect.poll(async () => {
    const receipt = await frame.getAttribute("data-gantt-projection-receipt");
    return receipt ? JSON.parse(receipt).outcome : null;
  }).toBe("SETTLED");
}

test("Issue #822 preserves scoped search membership and Shift selection through density changes", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await installStatefulProjectFixture(page);
  fixture.tasks[1].name = "Density scope child A";
  for (const [ordinal, suffix] of [[5, "B"], [6, "C"]] as const) fixture.tasks.push({
    ...fixture.tasks[1], taskId: `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`,
    externalId: `DENSITY-SCOPE-${suffix}`, name: `Density scope child ${suffix}`, siblingOrder: ordinal,
  });
  await page.goto(`/projects/${statefulPublicId}`);
  const identity = await rememberGanttRoot(page), frame = ganttRoot(page);
  await rowNamed(page, "Stable summary").click({ button: "right" });
  await page.getByRole("menuitem", { name: "최상위로 열기 (작업공간 탭)", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`rootTask=${fixture.tasks[0].taskId}`));
  const scope = page.getByRole("tablist", { name: "WBS 범위 탭" }).getByRole("tab", { name: "Stable summary", exact: true });
  await expect(scope).toHaveAttribute("aria-selected", "true");
  const search = page.getByRole("searchbox", { name: "작업명, 설명, External ID 검색", exact: true });
  await search.fill("Density scope child");
  const children = ["A", "B", "C"].map(suffix => rowNamed(page, `Density scope child ${suffix}`));
  for (const row of children) await expect(row).toBeVisible();
  const checkboxes = children.map(row => row.locator("input[data-copy-selection]"));
  await checkboxes[0].check();
  await checkboxes[2].click({ modifiers: ["Shift"] });
  for (const checkbox of checkboxes) await expect(checkbox).toBeChecked();
  const receipts = [];
  for (const height of [32, 28, 34]) {
    await wheelDensity(page, children[1], height);
    await expect(search).toHaveValue("Density scope child");
    await expect(scope).toHaveAttribute("aria-selected", "true");
    for (const row of children) await expect(row).toBeVisible();
    for (const checkbox of checkboxes) await expect(checkbox).toBeChecked();
    await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
    await expect(rowNamed(page, "Stable milestone")).toHaveCount(0);
    await expectSameGanttRoot(page, identity);
    receipts.push({ height, receipt: JSON.parse((await frame.getAttribute("data-gantt-projection-receipt"))!) });
  }
  // A new query with the same task IDs still owns the filter; density must not
  // resurrect the previous scope's excluded Milestone or outside leaf.
  await search.fill("Density scope child B");
  await expect(children[1]).toBeVisible();
  await expect(children[0]).toHaveCount(0);
  await expect(children[2]).toHaveCount(0);
  await wheelDensity(page, children[1], 28);
  await expect(search).toHaveValue("Density scope child B");
  await expect(children[0]).toHaveCount(0);
  await expect(children[2]).toHaveCount(0);
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  for (const row of children) await expect(row).toBeVisible();
  await expect(frame).toHaveAttribute("data-gantt-cell-height", "28");
  await expect(rowNamed(page, "Stable leaf")).toHaveCount(0);
  await expect(rowNamed(page, "Stable milestone")).toHaveCount(0);
  await expectSameGanttRoot(page, identity);
  expect(fixture.posts).toHaveLength(0);
  expect(fixture.patchRequests).toHaveLength(0);
  expect(fixture.project.revision).toBe(fixture.initialRevision);
  await testInfo.attach("issue-822-scoped-density", { body: JSON.stringify(receipts), contentType: "application/json" });
});

test("switches the Gantt timeline between day and ISO week headers without remounting", async ({ page }) => {
  await page.route(`**/api/projects/${publicId}`, (route) => route.fulfill({ json: {
    data: {
      project: {
        publicId,
        name: "Issue 51 ISO week scale fixture",
        description: "Day/ISO-week timeline scale verification",
        status: "planned",
        revision: 1,
        calendar: {
          timezone: "Asia/Seoul",
          weekendDays: [6, 0],
          holidays: [
            { date: "2026-09-22", name: "Fixture holiday" },
            { date: "2026-09-24", name: "Week-only holiday" },
            { date: "2026-09-26", name: "Weekend named holiday" },
          ],
          exceptions: [
            {
              date: "2026-09-22",
              dayType: "NON_WORKING",
              name: "Fixture holiday",
              names: ["Fixture holiday", "Company anniversary"],
            },
            {
              date: "2026-09-24",
              dayType: "NON_WORKING",
              name: "Week-only holiday",
              names: ["Week-only holiday", "Plant shutdown"],
            },
            {
              date: "2026-09-26",
              dayType: "NON_WORKING",
              name: "Weekend named holiday",
              names: ["Weekend named holiday"],
            },
            {
              date: "2026-09-27",
              dayType: "WORKING",
              name: "Sunday working override",
              names: ["Sunday working override"],
            },
          ],
        },
      },
      tasks: [{
        taskId: "35000000-0000-4000-8000-000000000001",
        externalId: "ISSUE-51-1",
        name: "Scale verification task",
        type: "task",
        scheduleMode: "auto",
        requestedStart: "2026-09-14",
        start: "2026-09-14",
        end: "2026-09-30",
        duration: 13,
        progress: 25,
        parentExternalId: null,
        siblingOrder: 0,
      }],
      links: [],
      permission: "readonly",
    },
  } }));
  await page.route(`**/api/projects/${publicId}/edit-sessions/current`, (route) => route.fulfill({ json: {
    data: { permission: "readonly" },
  } }));

  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) mutationRequests.push(`${request.method()} ${request.url()}`);
  });

  await page.goto(`/projects/${publicId}`);
  const frame = page.locator(".project-gantt-frame");
  const gantt = page.locator(".project-gantt-widget");
  const chart = page.locator(".project-gantt-widget .wx-chart").first();
  const controls = page.getByRole("group", { name: "Gantt 표시 단위" });
  const day = controls.getByRole("button", { name: "일", exact: true });
  const week = controls.getByRole("button", { name: "주", exact: true });

  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "day");
  await expect(day).toHaveAttribute("aria-pressed", "true");
  await expect(week).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".project-gantt-widget .wx-weekend").first()).toBeVisible();
  const dayScale = page.locator(".project-gantt-widget .wx-scale > .wx-row").nth(1);
  await expect(dayScale.getByText("14", { exact: true })).toBeVisible();
  await expect(dayScale.getByText("22", { exact: true })).toBeVisible();
  await expect(dayScale.getByText(/일|[()]/)).toHaveCount(0);

  const ordinaryDay = page.locator(".project-gantt-day-date-20260921");
  const namedHoliday = page.locator(".project-gantt-day-date-20260922");
  const namedWeekend = page.locator(".project-gantt-day-date-20260926");
  const workingOverride = page.locator(".project-gantt-day-date-20260927");
  const tooltip = page.getByRole("tooltip");

  await ordinaryDay.hover();
  await expect(tooltip).toBeVisible();
  await expect(ordinaryDay).toHaveAttribute("aria-label", /2026-09-21/);
  await expect(tooltip).not.toContainText("Fixture holiday");
  await expect(tooltip).not.toContainText("Sunday working override");

  await namedHoliday.hover();
  await expect(tooltip).toContainText("Fixture holiday");
  await expect(tooltip).toContainText("Company anniversary");
  await expect(namedHoliday).toHaveAttribute("aria-describedby", /day-header-tooltip/);

  await page.mouse.move(1, 1);
  await namedWeekend.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Weekend named holiday");

  await namedHoliday.hover();
  await expect(tooltip).toContainText("Company anniversary");
  await page.mouse.move(1, 1);
  await expect(tooltip).toContainText("Weekend named holiday");
  await expect(namedWeekend).toHaveAttribute("aria-describedby", /day-header-tooltip/);

  await page.setViewportSize({ width: 1024, height: 900 });
  // SVAR virtualizes the scale after a viewport resize, so a previously
  // referenced calendar date may leave the DOM. Validate edge clamping against
  // the live right-most Day cell instead of assuming that date stays mounted.
  const edgeDay = page.locator(".project-gantt-day-scale").last();
  await expect(edgeDay).toBeVisible();
  // Focus accessibility is verified above on namedWeekend. After a viewport
  // resize SVAR may replace virtualized scale cells during focus dispatch, so
  // use the pointer path here to isolate viewport-edge positioning from the
  // already-covered keyboard/focus contract.
  await edgeDay.hover();
  await expect(tooltip).toBeVisible();
  // Accessibility linkage is asserted above on stable date cells. The right-most
  // virtualized cell can be replaced while SVAR settles after resize, so this
  // block intentionally verifies viewport clamping only.
  await expect.poll(async () => {
    const box = await tooltip.boundingBox();
    return Boolean(box && box.x + box.width <= 1016);
  }).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });

  await workingOverride.hover();
  await expect(tooltip).toBeVisible();
  await expect(workingOverride).toHaveAttribute("aria-label", /2026-09-27/);
  await expect(tooltip).not.toContainText("Sunday working override");

  await expect(gantt.getByText("W38", { exact: true })).toHaveCount(0);
  const instanceId = await frame.getAttribute("data-project-gantt-instance");
  const apiInstanceId = await frame.getAttribute("data-project-gantt-api-instance");
  expect(instanceId).toBeTruthy();
  expect(apiInstanceId).toBeTruthy();

  // The toolbar can show the new scale before Core and the registered
  // projection have completed their geometry handoff.
  const expectScaleSettled = async (mode: "day" | "week") => {
    await expect.poll(async () => {
      const raw = await frame.getAttribute("data-gantt-projection-receipt");
      if (!raw) return null;
      const receipt = JSON.parse(raw) as {
        apiInstance?: string;
        scale?: "day" | "week";
        outcome?: string;
      };
      return receipt.apiInstance === apiInstanceId && receipt.scale === mode
        ? receipt.outcome
        : null;
    }).toBe("SETTLED");
  };

  await week.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  await expectScaleSettled("week");
  await expect(frame).toHaveAttribute("data-gantt-cell-width", "68");
  await expect(day).toHaveAttribute("aria-pressed", "false");
  await expect(week).toHaveAttribute("aria-pressed", "true");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
  await expect(page.locator(".project-gantt-widget .wx-weekend")).toHaveCount(0);
  await expect(page.locator(".project-gantt-day-scale")).toHaveCount(0);
  await expect(tooltip).toHaveCount(0);
  await expect(gantt.getByText(/9\/14.*9\/20/)).toHaveCount(0);

  const week38 = page.locator(".project-gantt-week-date-20260914");
  const week39 = page.locator(".project-gantt-week-date-20260921");
  const week38WorkingDays = week38.locator(".project-gantt-week-working-days");
  const week39WorkingDays = week39.locator(".project-gantt-week-working-days");
  const weekTooltip = page.getByRole("tooltip");
  await expect(week38).toBeVisible();
  await expect(week39).toBeVisible();
  await expect(week38).toContainText("W38");
  await expect(week39).toContainText("W39");
  await expect(week38WorkingDays).toHaveText("5일");
  await expect(week39WorkingDays).toHaveText("4일");
  await expect(week38).toHaveAttribute("data-working-days", "5");
  await expect(week39).toHaveAttribute("data-working-days", "4");

  await week38.hover();
  await expect(weekTooltip).toBeVisible();
  await expect(weekTooltip).toContainText("근무일: 5일");
  await expect(week38).toHaveAttribute("aria-describedby", /week-header-tooltip/);
  await expect(weekTooltip).not.toContainText("공휴일:");

  await page.mouse.move(1, 1);
  await week39.focus();
  await expect(weekTooltip).toBeVisible();
  await expect(weekTooltip).toContainText("근무일: 4일");
  await expect(weekTooltip).toContainText("Fixture holiday");
  await expect(weekTooltip).toContainText("Company anniversary");
  await expect(weekTooltip).toContainText("Week-only holiday");
  await expect(weekTooltip).toContainText("Plant shutdown");
  await expect(weekTooltip).toContainText("Weekend named holiday");
  await expect(weekTooltip).not.toContainText("Sunday working override");
  await expect(week39).toHaveAttribute("aria-label", /근무일 4일/);

  await page.keyboard.press("Escape");
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(frame).toHaveAttribute("data-gantt-cell-width", "68");
    await expect.poll(async () => {
      const liveWeek = page.locator(".project-gantt-week-scale").first();
      if (await liveWeek.count() === 0) return false;
      return liveWeek.evaluate((cell) => {
        const label = cell.querySelector<HTMLElement>(".project-gantt-week-working-days");
        if (!label) return false;
        const cellBox = cell.getBoundingClientRect();
        const labelBox = label.getBoundingClientRect();
        const tolerance = 0.75;
        return label.textContent?.endsWith("일") === true
          && labelBox.left >= cellBox.left - tolerance
          && labelBox.right <= cellBox.right + tolerance
          && labelBox.top >= cellBox.top - tolerance
          && labelBox.bottom <= cellBox.bottom + tolerance;
      });
    }).toBe(true);
  }

  await page.setViewportSize({ width: 1024, height: 900 });

  await chart.evaluate((element) => {
    element.scrollTo({ left: element.scrollWidth, behavior: "instant" });
  });
  await expect.poll(async () => chart.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const recycledWeek = page.locator(".project-gantt-week-scale").last();
  await expect(recycledWeek).toBeVisible();
  await expect.poll(async () => recycledWeek.evaluate((cell) => {
    const workingDays = cell.getAttribute("data-working-days");
    const label = cell.querySelector<HTMLElement>(".project-gantt-week-working-days")?.textContent ?? "";
    const ariaLabel = cell.getAttribute("aria-label") ?? "";
    return Boolean(
      workingDays &&
      label === `${workingDays}일` &&
      ariaLabel.includes(`근무일 ${workingDays}일`)
    );
  })).toBe(true);
  const recycledWorkingDays = await recycledWeek.getAttribute("data-working-days");
  expect(recycledWorkingDays).toMatch(/^[0-7]$/);
  await recycledWeek.hover();
  await expect(weekTooltip).toContainText(`근무일: ${recycledWorkingDays}일`);

  const edgeWeek = page.locator(".project-gantt-week-scale").last();
  await expect(edgeWeek).toBeVisible();
  await edgeWeek.hover();
  await expect(weekTooltip).toBeVisible();
  await expect.poll(async () => {
    const box = await weekTooltip.boundingBox();
    return Boolean(box && box.x + box.width <= 1016);
  }).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });

  await day.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "day");
  await expectScaleSettled("day");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
  await expect(page.locator(".project-gantt-widget .wx-weekend").first()).toBeVisible();
  // SVAR virtualizes the horizontal scale and may choose a different concrete
  // Day cell after Week focus/viewport resize. The round-trip contract here is
  // that Day rendering is restored on the same mounted instance without
  // reverting to Week formatting; exact visible calendar dates are not fixed.
  const restoredDayCells = page.locator(".project-gantt-day-scale");
  await expect(restoredDayCells.first()).toBeVisible();
  await expect(restoredDayCells.first().locator(".project-gantt-week-working-days")).toHaveCount(0);
  await expect(restoredDayCells.first()).not.toHaveAttribute("data-working-days", /.+/);
  await expect(restoredDayCells.first()).toHaveText(/^\d{1,2}$/);
  await expect(dayScale.getByText(/일|[()]/)).toHaveCount(0);
  await expect(page.locator(".project-gantt-week-scale")).toHaveCount(0);
  await expect(gantt.getByText("W38", { exact: true })).toHaveCount(0);

  await week.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "week");
  await expectScaleSettled("week");
  await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
  await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
  // The concrete visible ISO week number depends on the current virtualized
  // horizontal window. Verify the Week representation itself instead of
  // assuming the viewport returns to fixture week W38.
  const restoredWeekCells = page.locator(".project-gantt-week-scale");
  await expect(restoredWeekCells.first()).toBeVisible();
  await expect(restoredWeekCells.first()).toContainText(/^W\d{2}/);
  await expect(restoredWeekCells.first().locator(".project-gantt-week-working-days")).toHaveText(/^\d일$/);
  await expect(restoredWeekCells.first()).toHaveAttribute("data-working-days", /^[0-7]$/);
  await expect(frame).toHaveAttribute("data-gantt-cell-width", "68");
  await expect(page.locator(".project-gantt-day-scale")).toHaveCount(0);

  await day.click();
  await expect(frame).toHaveAttribute("data-gantt-scale-mode", "day");
  await expectScaleSettled("day");
  await expect(frame).toHaveAttribute("data-gantt-cell-width", "36");

  for (let extension = 0; extension < 3; extension += 1) {
    const previousEnd = Number(await frame.getAttribute("data-gantt-timeline-end"));
    expect(previousEnd).toBeGreaterThan(0);

    await chart.evaluate((element) => {
      element.scrollTo({ left: element.scrollWidth, behavior: "instant" });
    });
    await expect.poll(async () => chart.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

    await expect.poll(async () => Number(await frame.getAttribute("data-gantt-timeline-end"))).toBeGreaterThan(previousEnd);
    // The React end date can change before the registered Core/native range
    // transaction settles; do not start another edge gesture until it does.
    await expect.poll(async () => {
      const raw = await frame.getAttribute("data-gantt-viewport-coordinator");
      if (!raw) return null;
      const receipt = JSON.parse(raw) as { kind?: string; outcome?: string };
      return receipt.kind === "RANGE_EXTENSION" ? receipt.outcome ?? null : null;
    }).toBe("SETTLED");
    await expectScaleSettled("day");
    await expect(frame).toHaveAttribute("data-project-gantt-instance", instanceId!);
    await expect(frame).toHaveAttribute("data-project-gantt-api-instance", apiInstanceId!);
    expect(await chart.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  }

  expect(mutationRequests).toEqual([]);
});
