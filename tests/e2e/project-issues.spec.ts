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
  const queriedStatuses: string[] = [];
  const patchAttempts: { status: number; ifMatch: string; issueId: string }[] = [];
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
      queriedStatuses.push(status);
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
        patchAttempts.push({ status: 401, ifMatch: request.headers()["if-match"], issueId: id! });
        await route.fulfill({ status: 401, json: { error: { code: "ISSUE_PASSWORD_INVALID", message: "password" } } }); return;
      }
      patchAttempts.push({ status: 200, ifMatch: request.headers()["if-match"], issueId: id! });
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
  await expect(workspace.locator("#project-issue-status")).toHaveValue("all");
  expect(queriedStatuses[0]).toBe("all");
  await expect(workspace.getByRole("button", { name: "초기화" })).toHaveCount(0);
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
  await expect(workspace.getByText("검색 결과 1건")).toBeVisible();
  await workspace.locator("#project-issue-status").selectOption("open");
  await expect(workspace.getByText("검색 결과 0건")).toBeVisible();
  await workspace.locator("#project-issue-status").selectOption("all");
  await expect(workspace.getByText("검색 결과 1건")).toBeVisible();
  await workspace.locator("#project-issue-status").selectOption("completed");
  await expect(workspace.getByRole("row", { name: /장비 점검 요청/ })).toBeVisible();
  await workspace.getByRole("button", { name: "장비 점검 요청" }).click();
  const detail = workspace.getByRole("dialog", { name: "Issue 상세 및 수정" });
  await expect(detail.getByLabel("등록일")).toHaveValue("2026-10-28");
  await detail.getByLabel("상태", { exact: true }).selectOption("registered");
  await expect(detail.getByLabel("완료일")).toBeDisabled();
  const revisionBeforeRejectedEdit = state.project.revision;
  const recordsBeforeRejectedEdit = JSON.stringify(records);
  const issueBeforeRejectedEdit = { ...records[0] };
  await detail.getByLabel("Issue 비밀번호 (수정·삭제 시 필요)").fill("WrongPassword123");
  await detail.getByRole("button", { name: "수정 저장" }).click();
  const passwordError = detail.getByRole("alert");
  await expect(passwordError).toHaveText("Issue 비밀번호를 확인해 주세요.");
  await expect(passwordError).not.toContainText("password");
  await expect(detail.getByLabel("상태", { exact: true })).toHaveValue("registered");
  expect(patchAttempts).toEqual([{ status: 401,
    ifMatch: '"' + revisionBeforeRejectedEdit + '"', issueId: issueBeforeRejectedEdit.issueId }]);
  expect(state.project.revision).toBe(revisionBeforeRejectedEdit);
  expect(JSON.stringify(records)).toBe(recordsBeforeRejectedEdit);
  // The open Issue editor translates its allowlisted error without resubmitting the rejected edit.
  for (const { locale, dialogName, error } of [
    { locale: "en", dialogName: "Issue details and editing", error: "Check the issue password." },
    { locale: "vi", dialogName: "Chi tiết và chỉnh sửa vấn đề", error: "Kiểm tra mật khẩu vấn đề." },
    { locale: "ko", dialogName: "Issue 상세 및 수정", error: "Issue 비밀번호를 확인해 주세요." },
  ]) {
    await page.getByRole("combobox", { name: /^(표시 언어|Display language|Ngôn ngữ hiển thị)$/ }).first().selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    const localizedDetail = workspace.getByRole("dialog", { name: dialogName, exact: true });
    await expect(localizedDetail.getByRole("alert")).toHaveText(error);
    await expect(localizedDetail.getByRole("alert")).not.toHaveText("password");
    await expect(localizedDetail.locator("#project-issue-lifecycle-status")).toHaveValue("registered");
    expect(patchAttempts).toHaveLength(1);
    expect(state.project.revision).toBe(revisionBeforeRejectedEdit);
    expect(JSON.stringify(records)).toBe(recordsBeforeRejectedEdit);
  }
  await detail.getByLabel("Issue 비밀번호 (수정·삭제 시 필요)").fill(issuePassword);
  await detail.getByRole("button", { name: "수정 저장" }).click();
  await expect(kpis).toContainText("완료0건");
  await expect(kpis).toContainText("등록1건");
  await expect(detail).toBeHidden();
  expect(patchAttempts).toEqual([401, 200].map(status => ({ status,
    ifMatch: '"' + revisionBeforeRejectedEdit + '"', issueId: issueBeforeRejectedEdit.issueId })));
  expect(state.project.revision).toBe(revisionBeforeRejectedEdit + 1);
  expect(records).toEqual([{ ...issueBeforeRejectedEdit, status: "registered", completed: false,
    completedOn: null, updatedAt: "2026-10-28T03:02:00.000Z" }]);
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
  await expect(workspace.locator("#project-issue-status")).toHaveValue("all");
  await expect(workspace.getByRole("button", { name: "초기화" })).toHaveCount(0);
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

test("#869 Issue list owns vertical scrolling and editor keeps title above the scrolling body", async ({ page }) => {
  test.setTimeout(120_000);
  const state = await installStatefulProjectFixture(page);
  state.sessionEditable = true;
  const records: ProjectIssueDto[] = Array.from({ length: 100 }, (_, index) => ({
    issueId: randomUUID(), title: `현장 확인 ${index + 1} · Long issue title · Nội dung kiểm tra`,
    description: "사용자가 입력한 원문\nhttps://example.com/issue", reporterName: "현장 담당자", reporterResourceId: null,
    assigneeName: "Nguyễn Văn An", assigneeResourceId: null, occurredOn: "2026-11-03",
    status: "registered", completed: false, completedOn: null, relatedTaskId: null, relatedTaskText: "",
    credentialState: "protected", createdAt: "2026-11-03T00:00:00.000Z", updatedAt: "2026-11-03T00:00:00.000Z",
  }));
  await page.route("**" + projectPath + "/issues**", async route => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const current = Number(url.searchParams.get("page") ?? 1);
    await route.fulfill({ json: { data: {
      projectRevision: state.project.revision, summary: { total: 100, completed: 0, inProgress: 0, registered: 100 },
      total: 100, page: current, limit,
      issues: records.slice((current - 1) * limit, current * limit),
    } } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/projects/" + publicId);
  const gantt = page.locator(".project-gantt-frame");
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", /.+/);
  const instance = await gantt.getAttribute("data-project-gantt-api-instance");
  await page.getByRole("tab", { name: "Issue", exact: true }).click();
  const workspace = page.getByTestId("project-issue-workspace");
  await expect(workspace.getByRole("row")).toHaveCount(21);
  if (process.env.CAPTURE_ISSUE_869) {
    await page.screenshot({ path: `output/playwright/issue-869/${process.env.CAPTURE_ISSUE_869}-list.png`, fullPage: true });
  }
  const scroller = workspace.getByRole("region", { name: /Issue 목록/ });
  for (const size of [20, 50, 100, 10]) {
    await workspace.locator("#project-issue-page-size").selectOption(String(size));
    await expect(workspace.getByRole("row")).toHaveCount(size + 1);
    const geometry = await scroller.evaluate(element => ({
      overflow: getComputedStyle(element).overflowY, height: element.clientHeight, content: element.scrollHeight,
      panel: document.getElementById("project-panel-issue")!.scrollHeight - document.getElementById("project-panel-issue")!.clientHeight,
      document: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    await test.info().attach(`issue-list-${size}-geometry`, { body: JSON.stringify(geometry), contentType: "application/json" });
    expect(geometry.overflow).toBe("auto");
    expect(geometry.height).toBeGreaterThan(80);
    if (size >= 20) expect(geometry.content).toBeGreaterThan(geometry.height);
    expect(geometry.panel).toBeLessThanOrEqual(1);
    expect(geometry.document).toBeLessThanOrEqual(1);
    const toolbarBefore = await workspace.locator("#project-issue-query").boundingBox();
    const footerBefore = await workspace.locator("#project-issue-page-size").boundingBox();
    if (geometry.content > geometry.height) {
      await scroller.hover();
      await page.mouse.wheel(0, 300);
      await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    }
    expect((await workspace.locator("#project-issue-query").boundingBox())!.y).toBe(toolbarBefore!.y);
    expect((await workspace.locator("#project-issue-page-size").boundingBox())!.y).toBe(footerBefore!.y);
  }
  await workspace.getByRole("button", { name: "Issue 등록", exact: true }).click();
  const editor = workspace.getByRole("dialog");
  await expect(editor.getByLabel("Issue 명")).toBeFocused();
  const description = editor.locator("#project-issue-description");
  expect((await description.boundingBox())!.height).toBeGreaterThanOrEqual(180);
  const sameRow = async (ids: string[]) => {
    const boxes = await Promise.all(ids.map(id => editor.locator("#" + id).boundingBox()));
    expect(Math.max(...boxes.map(box => box!.y)) - Math.min(...boxes.map(box => box!.y))).toBeLessThanOrEqual(1);
    for (let index = 1; index < boxes.length; index++) expect(boxes[index]!.x).toBeGreaterThanOrEqual(boxes[index - 1]!.x + boxes[index - 1]!.width);
  };
  await sameRow(["project-issue-created", "project-issue-occurred", "project-issue-completed-on"]);
  await sameRow(["project-issue-reporterName", "project-issue-assigneeName", "project-issue-lifecycle-status"]);
  await sameRow(["project-issue-password", "project-issue-password-confirmation"]);
  const titleBefore = await editor.locator("#project-issue-title").boundingBox();
  const closeBefore = await editor.getByRole("button", { name: "Issue 편집 닫기" }).boundingBox();
  await editor.locator("#project-issue-password-confirmation").scrollIntoViewIfNeeded();
  expect((await editor.locator("#project-issue-title").boundingBox())!.y).toBe(titleBefore!.y);
  expect((await editor.getByRole("button", { name: "Issue 편집 닫기" }).boundingBox())!.y).toBe(closeBefore!.y);
  await editor.getByLabel("Issue 명").fill("Draft stays unchanged Nguyễn");
  const originalTitleElement = await editor.locator("#project-issue-title").elementHandle();
  for (const locale of ["ko"]) {
    // #869 standalone layout test; switching locale belongs to Issue #866.
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    for (const width of [390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(editor.locator("#project-issue-title")).toHaveValue("Draft stays unchanged Nguyễn");
      expect(await originalTitleElement!.evaluate(element => element === document.getElementById("project-issue-title"))).toBe(true);
      const geometry = await editor.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const title = document.getElementById("project-issue-title")!.getBoundingClientRect();
        const content = element.querySelector<HTMLElement>('[data-testid="project-issue-editor-body"]')!;
        const controls = Array.from(content.querySelectorAll<HTMLElement>("input,select,textarea,button"));
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
          titleTop: title.top, titleBottom: title.bottom, bodyTop: content.getBoundingClientRect().top,
          bodyXOverflow: content.scrollWidth - content.clientWidth,
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          escapedControls: controls.filter(control => { const b = control.getBoundingClientRect(); return b.left < bounds.left || b.right > bounds.right + 1; }).length };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bottom).toBeLessThanOrEqual(901);
      expect(geometry.titleTop).toBeGreaterThan(geometry.top);
      expect(geometry.titleBottom).toBeLessThanOrEqual(geometry.bodyTop);
      expect(geometry.bodyXOverflow).toBeLessThanOrEqual(1);
      expect(geometry.documentOverflow, `${locale}/${width}`).toBeLessThanOrEqual(1);
      expect(geometry.escapedControls).toBe(0);
      // Keyboard reveal scrolls the body while leaving the title available.
      await editor.locator("#project-issue-title").focus();
      for (let step = 0; step < 20; step++) {
        await page.keyboard.press("Tab");
        if (await editor.locator("#project-issue-password-confirmation").evaluate(element => element === document.activeElement)) break;
      }
      await expect(editor.locator("#project-issue-password-confirmation"), `${locale}/${width} keyboard reveal`).toBeFocused();
      await expect(editor.locator("#project-issue-password-confirmation"), `${locale}/${width} keyboard reveal`).toBeInViewport();
      const ring = await editor.locator("#project-issue-password-confirmation").evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const body = element.closest('[data-testid="project-issue-editor-body"]')!.getBoundingClientRect();
        const style = getComputedStyle(element);
        const outset = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
        return { top: bounds.top - outset, bottom: bounds.bottom + outset, left: bounds.left - outset, right: bounds.right + outset,
          bodyTop: body.top, bodyBottom: body.bottom, bodyLeft: body.left, bodyRight: body.right };
      });
      expect(ring.top).toBeGreaterThanOrEqual(ring.bodyTop);
      expect(ring.bottom).toBeLessThanOrEqual(ring.bodyBottom);
      expect(ring.left).toBeGreaterThanOrEqual(ring.bodyLeft);
      expect(ring.right).toBeLessThanOrEqual(ring.bodyRight);
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(editor.locator("#project-issue-title")).toBeInViewport();
      if (width >= 768) await sameRow(["project-issue-created", "project-issue-occurred", "project-issue-completed-on"]);
      if (process.env.CAPTURE_ISSUE_869 && (width === 390 || width === 1440)) {
        await page.screenshot({ path: `output/playwright/issue-869/${process.env.CAPTURE_ISSUE_869}-${locale}-${width}-editor.png` });
      }
    }
  }
  // Effective CSS viewport at 125% desktop zoom (1440/1.25 × 900/1.25).
  // Native browser-chrome zoom is a separate manual environment check.
  await page.setViewportSize({ width: 1152, height: 720 });
  await expect(editor.locator("#project-issue-title")).toBeInViewport();
  await editor.locator("#project-issue-title").focus();
  await editor.locator("#project-issue-password-confirmation").focus();
  await expect(editor.locator("#project-issue-password-confirmation")).toBeInViewport();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  await page.setViewportSize({ width: 390, height: 900 });
  const coarseHeights = await editor.locator("input,select,button").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
  expect(coarseHeights.every(height => height >= 44)).toBe(true);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await cdp.detach();
  await page.setViewportSize({ width: 1440, height: 900 });
  if (process.env.CAPTURE_ISSUE_869) {
    await page.screenshot({ path: `output/playwright/issue-869/${process.env.CAPTURE_ISSUE_869}-editor.png` });
  }
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(workspace.getByRole("button", { name: "Issue 등록", exact: true })).toBeFocused();
  await workspace.getByRole("button", { name: records[0].title, exact: true }).click();
  const detail = workspace.getByRole("dialog", { name: "Issue 상세 및 수정" });
  await expect(detail.locator("#project-issue-title")).toHaveValue(records[0].title);
  await expect(detail.locator("#project-issue-password-confirmation")).toHaveCount(0);
  const detailTitle = await detail.locator("#project-issue-title").boundingBox();
  await detail.getByRole("button", { name: "Issue 비밀번호 재설정", exact: true }).click();
  await detail.locator("#project-issue-new-password-confirmation").scrollIntoViewIfNeeded();
  await expect(detail.locator("#project-issue-new-password-confirmation")).toBeInViewport();
  expect((await detail.locator("#project-issue-title").boundingBox())!.y).toBe(detailTitle!.y);
  await expect(detail.getByRole("button", { name: "Issue 편집 닫기" })).toBeInViewport();
  await detail.getByRole("button", { name: "Issue 삭제…", exact: true }).click();
  await expect(detail.getByRole("group", { name: "Issue 삭제 확인" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "삭제 취소", exact: true })).toBeFocused();
  await detail.getByRole("button", { name: "삭제 취소", exact: true }).click();
  await expect(detail.getByRole("button", { name: "Issue 삭제…", exact: true })).toBeFocused();
  await detail.getByRole("button", { name: "Issue 삭제…", exact: true }).click();
  await expect(detail.getByRole("button", { name: "삭제 취소", exact: true })).toBeFocused();
  await expect(detail.locator("#project-issue-title")).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await page.getByRole("tab", { name: "일정", exact: true }).click();
  await expect(gantt).toHaveAttribute("data-project-gantt-api-instance", instance!);
});
