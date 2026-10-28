import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { installStatefulProjectFixture, projectPath, publicId } from "../fixtures/stateful-project";
import type { ProjectIssueDto, ProjectIssueInput } from "../../src/contracts/project-issues";

test("#838-#840 Issue tab: register, resource/Task lookup, completion date, secure link, filter and Gantt return", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = true;
  const records: ProjectIssueDto[] = [];
  const resourceId = randomUUID();
  let postCount = 0;
  await page.route("**" + projectPath + "/resource-memberships?*", async route => {
    await route.fulfill({ json: { data: {
      projectRevision: state.project.revision, catalogRevision: 1, total: 1,
      offset: 0, limit: 100,
      counts: { registered: 1, assigned: 0, roleOnly: 0, inactive: 0 },
      resources: [{ id: resourceId, name: "김개발", code: "DEV", registered: true }],
      groups: [],
    } } });
  });
  await page.route("**" + projectPath + "/issues**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === "GET") {
      const status = url.searchParams.get("status") ?? "all";
      const query = (url.searchParams.get("q") ?? "").toLocaleLowerCase();
      const size = Number(url.searchParams.get("limit") ?? 20);
      const targetPage = Number(url.searchParams.get("page") ?? 1);
      const matching = records.filter(record =>
        (status === "all" || (status === "completed" ? record.completed : !record.completed)) &&
        [record.title, record.description, record.reporterName, record.assigneeName, record.relatedTaskText]
          .some(text => text.toLocaleLowerCase().includes(query)));
      const total = records.length;
      await route.fulfill({ json: { data: {
        projectRevision: state.project.revision,
        summary: { total, completed: records.filter(record => record.completed).length },
        total: matching.length, page: targetPage, limit: size,
        issues: matching.slice((targetPage - 1) * size, targetPage * size),
      } } });
      return;
    }
    const input = request.postDataJSON() as ProjectIssueInput;
    const expected = '"' + state.project.revision + '"';
    if (request.headers()["if-match"] !== expected) {
      await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH", message: "stale" } } });
      return;
    }
    if (request.method() === "POST" && path === projectPath + "/issues") {
      postCount++;
      const timestamp = "2026-10-28T03:00:00.000Z";
      const created: ProjectIssueDto = { ...input,
        issueId: randomUUID(), createdAt: timestamp, updatedAt: timestamp,
      };
      records.unshift(created);
      state.project.revision++;
      await route.fulfill({ status: 201, json: { data: { projectRevision: state.project.revision, issue: created } } });
      return;
    }
    if (request.method() === "PATCH" && path.startsWith(projectPath + "/issues/")) {
      const id = path.split("/").at(-1);
      const index = records.findIndex(record => record.issueId === id);
      if (index < 0) { await route.fulfill({ status: 404 }); return; }
      const updated = { ...records[index], ...input, updatedAt: "2026-10-28T03:02:00.000Z" };
      records[index] = updated;
      state.project.revision++;
      await route.fulfill({ json: { data: { projectRevision: state.project.revision, issue: updated } } });
      return;
    }
    await route.fulfill({ status: 405 });
  });

  await page.goto("/projects/" + publicId);
  const gantt = page.locator(".project-gantt-frame");
  // DOM existence does not imply the SVAR viewport API has completed init.
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const originalInstance = await gantt.getAttribute("data-project-gantt-api-instance");
  const tabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
  await expect(tabs.getByRole("tab")).toHaveText(["일정", "Issue", "대시보드", "기준정보"]);
  await tabs.getByRole("tab", { name: "Issue", exact: true }).click();
  const workspace = page.getByTestId("project-issue-workspace");
  await expect(workspace).toBeVisible();
  await expect(workspace.getByText("완료 0 / 전체 0")).toBeVisible();
  await workspace.getByRole("button", { name: "Issue 등록", exact: true }).click();
  const editor = workspace.getByRole("dialog", { name: "Issue 등록" });
  await editor.getByLabel("Issue 명").fill("장비 점검 요청");
  await editor.getByLabel("등록자", { exact: true }).fill("현장 PI");
  await editor.getByLabel("담당자", { exact: true }).fill("김");
  await editor.getByRole("button", { name: "리소스 검색" }).last().click();
  await editor.getByRole("button", { name: "김개발 · DEV" }).click();
  await expect(editor.getByText("선택한 리소스: 김개발")).toBeVisible();
  await editor.getByLabel("Issue 내용").fill("로그: https://example.com/issues/123");
  await expect(editor.getByRole("link", { name: "https://example.com/issues/123" })).toHaveAttribute("rel", "noopener noreferrer");
  await editor.getByRole("button", { name: "Task 검색" }).click();
  await editor.locator("#project-issue-task-picker button").first().click();
  await editor.getByLabel("완료", { exact: true }).check();
  await expect(editor.getByLabel("완료일")).not.toHaveValue("");
  await editor.getByRole("button", { name: "등록", exact: true }).click();
  await expect(workspace.getByText("완료 1 / 전체 1")).toBeVisible();
  expect(postCount).toBe(1);
  await expect(workspace.getByRole("row", { name: /장비 점검 요청/ })).toBeVisible();
  await workspace.getByRole("button", { name: "장비 점검 요청" }).click();
  const detail = workspace.getByRole("dialog", { name: "Issue 상세 및 수정" });
  await expect(detail.getByLabel("등록일")).toHaveValue("2026-10-28");
  await detail.getByLabel("완료", { exact: true }).uncheck();
  await expect(detail.getByLabel("완료일")).toBeDisabled();
  await detail.getByRole("button", { name: "수정 저장" }).click();
  await expect(workspace.getByText("완료 0 / 전체 1")).toBeVisible();

  await workspace.getByLabel("검색", { exact: true }).fill("미존재");
  await workspace.getByRole("button", { name: "검색", exact: true }).click();
  await expect(workspace.getByText("검색 결과 0건")).toBeVisible();
  await expect(workspace.getByText("완료 0 / 전체 1")).toBeVisible();
  await workspace.getByLabel("페이지당").selectOption("10");
  await expect(workspace.getByText("1 / 1 페이지")).toBeVisible();
  await workspace.getByRole("button", { name: "초기화" }).click();
  await expect(workspace.getByText("검색 결과 1건")).toBeVisible();
  await tabs.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", originalInstance!);
});
