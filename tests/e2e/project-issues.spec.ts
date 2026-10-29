import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { installStatefulProjectFixture, projectPath, publicId } from "../fixtures/stateful-project";
import { chooseTaskInformation } from "./helpers/task-context-menu";
import type { ProjectIssueDto, ProjectIssueInput } from "../../src/contracts/project-issues";

test("#838-#840 Issue tab: register, resource/Task lookup, completion date, secure link, filter and Gantt return", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = true;
  const records: ProjectIssueDto[] = [];
  const passwords = new Map<string, string>();
  const issuePassword = "IssuePassword#123";
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
        (status === "all" || (status === "open" ? record.status !== "completed" : record.status === status)) &&
        [record.title, record.description, record.reporterName, record.assigneeName, record.relatedTaskText]
          .some(text => text.toLocaleLowerCase().includes(query)));
      const total = records.length;
      await route.fulfill({ json: { data: {
        projectRevision: state.project.revision,
        summary: { total, completed: records.filter(record => record.status === "completed").length,
          inProgress: records.filter(record => record.status === "in_progress").length,
          registered: records.filter(record => record.status === "registered").length },
        total: matching.length, page: targetPage, limit: size,
        issues: matching.slice((targetPage - 1) * size, targetPage * size),
      } } });
      return;
    }
    const body = request.postDataJSON() as ProjectIssueInput & {
      issuePassword?: string; confirmIssuePassword?: string;
    };
    const { issuePassword: candidate, confirmIssuePassword: ignoredConfirmation, ...input } = body;
    void ignoredConfirmation;
    const expected = '"' + state.project.revision + '"';
    if (request.headers()["if-match"] !== expected) {
      await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH", message: "stale" } } });
      return;
    }
    if (request.method() === "POST" && path === projectPath + "/issues") {
      postCount++;
      const timestamp = "2026-10-28T03:00:00.000Z";
      if (candidate !== issuePassword || body.confirmIssuePassword !== issuePassword) {
        await route.fulfill({ status: 400, json: { error: { code: "INVALID_ISSUE" } } }); return;
      }
      const created: ProjectIssueDto = { ...input,
        status: input.status ?? (input.completed ? "completed" : "registered"), credentialState: "protected",
        issueId: randomUUID(), createdAt: timestamp, updatedAt: timestamp,
      };
      passwords.set(created.issueId, candidate);
      records.unshift(created);
      state.project.revision++;
      await route.fulfill({ status: 201, json: { data: { projectRevision: state.project.revision, issue: created } } });
      return;
    }
    if (request.method() === "PATCH" && path.startsWith(projectPath + "/issues/")) {
      const id = path.split("/").at(-1);
      const index = records.findIndex(record => record.issueId === id);
      if (index < 0) { await route.fulfill({ status: 404 }); return; }
      if (candidate !== passwords.get(id!)) {
        await route.fulfill({ status: 401, json: { error: { code: "ISSUE_PASSWORD_INVALID", message: "password" } } }); return;
      }
      const updated = { ...records[index], ...input, updatedAt: "2026-10-28T03:02:00.000Z" };
      records[index] = updated;
      state.project.revision++;
      await route.fulfill({ json: { data: { projectRevision: state.project.revision, issue: updated } } });
      return;
    }
    if (request.method() === "DELETE" && path.startsWith(projectPath + "/issues/")) {
      const id = path.split("/").at(-1) ?? "";
      const index = records.findIndex(record => record.issueId === id);
      if (index < 0) { await route.fulfill({ status: 404 }); return; }
      if (candidate !== passwords.get(id)) {
        await route.fulfill({ status: 401, json: { error: { code: "ISSUE_PASSWORD_INVALID", message: "password" } } }); return;
      }
      records.splice(index, 1); state.project.revision++;
      await route.fulfill({ json: { data: { deleted: true, projectRevision: state.project.revision } } });
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
  const kpis = workspace.getByRole("status", { name: "전체 Issue 상태별 현황" });
  await expect(kpis).toContainText("전체0건");
  await expect(kpis).toContainText("등록0건");
  await expect(workspace.locator("#project-issue-status")).toHaveValue("open");
  await workspace.getByRole("button", { name: "Issue 등록", exact: true }).click();
  const editor = workspace.getByRole("dialog", { name: "Issue 등록" });
  await editor.getByLabel("Issue 명").fill("장비 점검 요청");
  await editor.getByLabel("등록자", { exact: true }).fill("현장 PI");
  await editor.getByLabel("담당자", { exact: true }).fill("김");
  await editor.getByRole("button", { name: "리소스 검색" }).last().click();
  await editor.getByRole("button", { name: "김개발 · DEV" }).click();
  await expect(editor.getByText("선택한 리소스: 김개발")).toBeVisible();
  await editor.getByLabel("Issue 내용").fill("로그: https://example.com/issues/123\n추적 완료");
  await expect(editor.getByText("링크 미리보기")).toHaveCount(0);
  expect(await editor.locator("#project-issue-task").evaluate(element =>
    element.compareDocumentPosition(document.getElementById("project-issue-description")!) &
    Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await editor.getByRole("button", { name: "Task 검색" }).click();
  await editor.locator("#project-issue-task-picker button").first().click();
  await expect(editor.getByLabel("상태", { exact: true })).toHaveValue("registered");
  await editor.getByLabel("상태", { exact: true }).selectOption("completed");
  await expect(editor.getByLabel("완료일")).not.toHaveValue("");
  await editor.getByLabel("Issue 비밀번호 *").fill(issuePassword);
  await editor.getByLabel("Issue 비밀번호 확인 *").fill(issuePassword);
  await editor.getByRole("button", { name: "등록", exact: true }).click();
  await expect(kpis).toContainText("완료1건");
  await expect(kpis).toContainText("전체1건");
  expect(postCount).toBe(1);
  await expect(workspace.getByText("검색 결과 0건")).toBeVisible();
  await workspace.locator("#project-issue-status").selectOption("completed");
  await expect(workspace.getByRole("row", { name: /장비 점검 요청/ })).toBeVisible();
  await workspace.getByRole("button", { name: "장비 점검 요청" }).click();
  const detail = workspace.getByRole("dialog", { name: "Issue 상세 및 수정" });
  await expect(detail.getByLabel("등록일")).toHaveValue("2026-10-28");
  await detail.getByLabel("상태", { exact: true }).selectOption("registered");
  await expect(detail.getByLabel("완료일")).toBeDisabled();
  await detail.getByLabel("Issue 비밀번호 (수정·삭제 시 필요)").fill("WrongPassword123");
  await detail.getByRole("button", { name: "수정 저장" }).click();
  await expect(detail.getByRole("alert")).toContainText("password");
  await detail.getByLabel("Issue 비밀번호 (수정·삭제 시 필요)").fill(issuePassword);
  await detail.getByRole("button", { name: "수정 저장" }).click();
  await expect(kpis).toContainText("완료0건");
  await expect(kpis).toContainText("등록1건");
  await workspace.locator("#project-issue-status").selectOption("open");
  await expect(workspace.getByText("검색 결과 1건")).toBeVisible();

  await workspace.getByLabel("검색", { exact: true }).fill("미존재");
  await workspace.getByRole("button", { name: "검색", exact: true }).click();
  await expect(workspace.getByText("검색 결과 0건")).toBeVisible();
  await expect(kpis).toContainText("완료0건");
  await expect(kpis).toContainText("전체1건");
  await workspace.getByLabel("페이지당").selectOption("10");
  await expect(workspace.getByText("1 / 1 페이지")).toBeVisible();
  await workspace.getByRole("button", { name: "초기화" }).click();
  await expect(workspace.getByText("검색 결과 1건")).toBeVisible();
  await expect(workspace.locator("#project-issue-status")).toHaveValue("open");
  await workspace.getByRole("button", { name: "장비 점검 요청" }).click();
  const progressing = workspace.getByRole("dialog", { name: "Issue 상세 및 수정" });
  await progressing.getByLabel("상태", { exact: true }).selectOption("in_progress");
  await progressing.getByLabel("Issue 비밀번호 (수정·삭제 시 필요)").fill(issuePassword);
  await progressing.getByRole("button", { name: "수정 저장" }).click();
  await expect(kpis).toContainText("진행 중1건");
  await expect(kpis).toContainText("등록0건");
  await expect(workspace.getByRole("row", { name: /장비 점검 요청/ })).toContainText("진행 중");
  await workspace.getByRole("button", { name: "장비 점검 요청" }).click();
  const deletion = workspace.getByRole("dialog", { name: "Issue 상세 및 수정" });
  await deletion.getByLabel("Issue 비밀번호 (수정·삭제 시 필요)").fill(issuePassword);
  await deletion.getByRole("button", { name: "Issue 삭제…" }).click();
  await deletion.getByRole("button", { name: "삭제 확인" }).click();
  await expect(kpis).toContainText("전체0건");
  await expect(workspace.getByRole("button", { name: "장비 점검 요청" })).toHaveCount(0);
  // #846: real viewport geometry (including 390px content-box overflow regression),
  // keyboard accessibility and focus restoration on close.
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await workspace.getByRole("button", { name: "Issue 등록", exact: true }).click();
    const responsiveDialog = workspace.getByRole("dialog", { name: "Issue 등록" });
    await expect(responsiveDialog).toBeVisible();
    const box = await responsiveDialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    await expect(responsiveDialog.getByLabel("Issue 명")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(responsiveDialog).toHaveCount(0);
    await expect(workspace.getByRole("button", { name: "Issue 등록", exact: true })).toBeFocused();
  }
  await tabs.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", originalInstance!);
});


test("#854 public readonly Issue registration and Task Editor prefill/clear/reselect", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = false;
  const records: ProjectIssueDto[] = [];
  const posted: Array<ProjectIssueInput> = [];
  await page.route("**" + projectPath + "/issues**", async route => {
    const request = route.request();
    if (request.method() === "GET") {
      const status = new URL(request.url()).searchParams.get("status") ?? "all";
      const visible = records.filter(i => status === "all" ||
        (status === "open" ? i.status !== "completed" : i.status === status));
      await route.fulfill({ json: { data: {
        projectRevision: state.project.revision,
        summary: { total: records.length,
          registered: records.filter(i => i.status === "registered").length,
          inProgress: records.filter(i => i.status === "in_progress").length,
          completed: records.filter(i => i.status === "completed").length },
        total: visible.length, page: 1, limit: 20, issues: visible,
      } } }); return;
    }
    if (request.method() !== "POST") { await route.fulfill({ status: 405 }); return; }
    if (request.headers()["if-match"] !== '"' + state.project.revision + '"') {
      await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH", message: "stale" } } }); return;
    }
    const body = request.postDataJSON() as ProjectIssueInput & { issuePassword: string; confirmIssuePassword: string };
    const { issuePassword, confirmIssuePassword, ...fields } = body;
    if (!issuePassword || issuePassword !== confirmIssuePassword) {
      await route.fulfill({ status: 400 }); return;
    }
    posted.push(fields);
    const timestamp = "2026-10-29T01:00:00.000Z";
    const issue: ProjectIssueDto = { ...fields, status: fields.status ?? "registered",
      issueId: randomUUID(), credentialState: "protected", createdAt: timestamp, updatedAt: timestamp };
    records.unshift(issue);
    state.project.revision += 1;
    await route.fulfill({ status: 201, json: { data: { issue, projectRevision: state.project.revision } } });
  });

  await page.goto("/projects/" + publicId);
  const gantt = page.locator(".project-gantt-frame");
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const instance = await gantt.getAttribute("data-project-gantt-api-instance");
  const tabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
  await tabs.getByRole("tab", { name: "Issue", exact: true }).click();
  const workspace = page.getByTestId("project-issue-workspace");
  const issueButton = workspace.getByRole("button", { name: "Issue 등록", exact: true });
  await expect(issueButton).toBeEnabled();
  await issueButton.click();
  let form = workspace.getByRole("dialog", { name: "Issue 등록" });
  await expect(form.getByLabel("관련 Task")).toHaveValue("");
  await form.getByRole("button", { name: "취소" }).click();
  await tabs.getByRole("tab", { name: "일정", exact: true }).click();
  const row = page.locator(".project-gantt-widget .wx-row", { hasText: "Stable leaf" }).first();
  await expect(row).toBeVisible();
  await row.getByText("Stable leaf", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const taskEditor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await expect(taskEditor.getByRole("button", { name: "Issue 등록" })).toBeEnabled();
  await taskEditor.getByRole("button", { name: "Issue 등록" }).click();
  form = workspace.getByRole("dialog", { name: "Issue 등록" });
  await expect(form).toBeVisible();
  await expect(form.getByLabel("관련 Task")).toHaveValue("Stable leaf");
  await expect(form.getByText("연결된 Task: Stable leaf")).toBeVisible();
  await form.getByLabel("Issue 명").fill("자동 연결 등록");
  await form.getByLabel("Issue 비밀번호 *").fill("IssuePassword#123");
  await form.getByLabel("Issue 비밀번호 확인 *").fill("IssuePassword#123");
  await form.getByRole("button", { name: "등록", exact: true }).click();
  await expect(taskEditor).toBeVisible();
  expect(posted.at(-1)).toMatchObject({
    title: "자동 연결 등록", relatedTaskId: state.tasks[2].taskId, relatedTaskText: "Stable leaf",
  });
  await taskEditor.getByRole("button", { name: "Issue 등록" }).click();
  form = workspace.getByRole("dialog", { name: "Issue 등록" });
  await form.getByRole("button", { name: "연결 해제" }).click();
  await expect(form.getByLabel("관련 Task")).toHaveValue("");
  await form.getByRole("button", { name: "Task 검색" }).click();
  await form.locator("#project-issue-task-picker").getByRole("button", { name: /Existing summary child/ }).click();
  await expect(form.getByLabel("관련 Task")).toHaveValue("Existing summary child");
  await form.getByLabel("Issue 명").fill("수동 변경 등록");
  await form.getByLabel("Issue 비밀번호 *").fill("IssuePassword#123");
  await form.getByLabel("Issue 비밀번호 확인 *").fill("IssuePassword#123");
  await form.getByRole("button", { name: "등록", exact: true }).click();
  await expect(taskEditor).toBeVisible();
  expect(posted.at(-1)).toMatchObject({
    relatedTaskId: state.tasks[1].taskId, relatedTaskText: "Existing summary child",
  });
  await taskEditor.getByRole("button", { name: "Issue 등록" }).click();
  form = workspace.getByRole("dialog", { name: "Issue 등록" });
  await form.getByLabel("관련 Task").fill("문자로 입력한 작업");
  await form.getByLabel("Issue 명").fill("자유 입력 등록");
  await form.getByLabel("Issue 비밀번호 *").fill("IssuePassword#123");
  await form.getByLabel("Issue 비밀번호 확인 *").fill("IssuePassword#123");
  await form.getByRole("button", { name: "등록", exact: true }).click();
  await expect(taskEditor).toBeVisible();
  expect(posted.at(-1)).toMatchObject({ relatedTaskId: null, relatedTaskText: "문자로 입력한 작업" });
  expect(state.patchRequests).toHaveLength(0);
  expect(state.posts).toHaveLength(0);
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", instance!);
});

test("#854 dirty Task draft cannot be discarded by Issue registration", async ({ page }) => {
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = true;
  await page.goto("/projects/" + publicId);
  const row = page.locator(".project-gantt-widget .wx-row", { hasText: "Stable leaf" }).first();
  await expect(row).toBeVisible();
  await row.getByText("Stable leaf", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);
  const dialog = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await dialog.getByLabel("작업명", { exact: true }).fill("미저장 작업 초안");
  await expect(dialog.getByRole("button", { name: "Issue 등록" })).toBeDisabled();
  await expect(dialog.getByLabel("작업명", { exact: true })).toHaveValue("미저장 작업 초안");
  expect(state.patchRequests).toHaveLength(0);
});


test("#854 P1 slow canonical restore keeps Task Editor ownership until latest GET completes", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = false;
  const records: ProjectIssueDto[] = [];
  let holdCanonicalRead = false;
  let notifyReadStarted!: () => void;
  const readStarted = new Promise<void>(resolve => { notifyReadStarted = resolve; });
  let releaseCanonicalRead!: () => void;
  const readGate = new Promise<void>(resolve => { releaseCanonicalRead = resolve; });

  // Register after the stateful fixture so the pending project GET is
  // interceptable without replacing its canonical read/snapshot contract.
  await page.route("**" + projectPath, async route => {
    if (route.request().method() === "GET" && holdCanonicalRead) {
      notifyReadStarted();
      await readGate;
    }
    await route.fallback();
  });
  await page.route("**" + projectPath + "/issues**", async route => {
    const req = route.request();
    if (req.method() === "GET") {
      await route.fulfill({ json: { data: {
        projectRevision: state.project.revision,
        summary: { total: records.length, registered: records.length, inProgress: 0, completed: 0 },
        total: records.length, page: 1, limit: 20, issues: records,
      } } });
      return;
    }
    if (req.method() !== "POST" ||
        req.headers()["if-match"] !== '"' + state.project.revision + '"') {
      await route.fulfill({ status: 412, json: { error: { code: "REVISION_MISMATCH" } } });
      return;
    }
    const body = req.postDataJSON() as ProjectIssueInput & { issuePassword: string; confirmIssuePassword: string };
    const { issuePassword, confirmIssuePassword, ...fields } = body;
    if (!issuePassword || issuePassword !== confirmIssuePassword) {
      await route.fulfill({ status: 400, json: { error: { code: "INVALID_ISSUE" } } });
      return;
    }
    const issue: ProjectIssueDto = {
      ...fields, status: fields.status ?? "registered", issueId: randomUUID(),
      credentialState: "protected", createdAt: "2026-10-29T02:00:00.000Z",
      updatedAt: "2026-10-29T02:00:00.000Z",
    };
    records.push(issue);
    state.project.revision++;
    await route.fulfill({ status: 201, json: { data: {
      issue, projectRevision: state.project.revision,
    } } });
  });

  await page.goto("/projects/" + publicId);
  const gantt = page.locator(".project-gantt-frame");
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const initialInstance = await gantt.getAttribute("data-project-gantt-api-instance");
  const row = page.locator(".project-gantt-widget .wx-row", { hasText: "Stable leaf" }).first();
  await expect(row).toBeVisible();
  await row.getByText("Stable leaf", { exact: true }).click({ button: "right" });
  await chooseTaskInformation(page);

  const taskEditor = page.getByRole("dialog", { name: "작업 정보", exact: true });
  await taskEditor.getByRole("button", { name: "Issue 등록" }).click();
  const issueForm = page.getByRole("dialog", { name: "Issue 등록" });
  await expect(issueForm.getByLabel("관련 Task")).toHaveValue("Stable leaf");
  await issueForm.getByLabel("Issue 명").fill("지연 재조회 보호");
  await issueForm.getByLabel("Issue 비밀번호 *").fill("IssuePassword#123");
  await issueForm.getByLabel("Issue 비밀번호 확인 *").fill("IssuePassword#123");

  holdCanonicalRead = true;
  await issueForm.getByRole("button", { name: "등록", exact: true }).click();
  await readStarted;
  await expect(page.getByText("Issue 등록 후 작업 정보 복귀 중…", { exact: true })).toBeVisible();
  const primaryTabs = page.getByRole("tablist", { name: "프로젝트 작업공간" });
  await expect(primaryTabs.getByRole("tab", { name: "일정" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "편집 잠금 해제" })).toBeDisabled();
  await expect(taskEditor).toHaveCount(0);
  await expect(page.getByTestId("project-issue-workspace")
    .getByRole("button", { name: "Issue 등록", exact: true })).toBeDisabled();

  releaseCanonicalRead();
  await expect(taskEditor).toBeVisible();
  await expect(taskEditor.getByLabel("작업명", { exact: true })).toHaveValue("Stable leaf");
  await expect(taskEditor).toContainText("Revision " + state.project.revision);
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", initialInstance!);
  expect(state.patchRequests).toHaveLength(0);
  expect(state.posts).toHaveLength(0);
});
