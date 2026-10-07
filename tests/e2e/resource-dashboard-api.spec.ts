import type { ResourceDashboardDto } from "../../src/contracts/resource-dashboard";
import { expect, test, isolatedApplicationOptions, submitProjectAndExpectCreated } from "./fixtures/isolated-application";

test.use(isolatedApplicationOptions);

test("Issue #524 실제 브라우저 public readonly report/detail과 재시작 snapshot을 보존한다", async ({ page, browser, isolatedApplication, restartIsolatedApplication }) => {
  test.setTimeout(120_000);
  await page.goto("/projects/new");
  await page.getByLabel("프로젝트 이름").fill("Resource Dashboard API E2E");
  await page.getByLabel("편집 비밀번호").fill("Dash123!");
  await submitProjectAndExpectCreated(page);
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  const publicId = new URL(page.url()).pathname.split("/").at(-1)!;
  const path = `/api/projects/${publicId}/resource-dashboard?mdPerMm=null`;
  const readonly = await browser.newContext({ baseURL: isolatedApplication });
  try {
    const publicPage = await readonly.newPage();
    await publicPage.goto("/");
    const fetched = await publicPage.evaluate(async (path) => {
      const response = await fetch(path);
      return { status: response.status, cache: response.headers.get("cache-control"), nosniff: response.headers.get("x-content-type-options"), body: await response.json() };
    }, path);
    expect(fetched.status).toBe(200); expect(fetched.cache).toBe("private, no-store"); expect(fetched.nosniff).toBe("nosniff");
    const report = fetched.body.data as ResourceDashboardDto;
    expect(report.schema).toBe("resource-dashboard/1"); expect(report.summary.taskCount).toBe(0); expect(report.catalog.resources).toEqual([]);
    expect(report.mdPerMm).toBeNull(); expect(report.mdPerMmSource).toBe("query");
    const detail = await readonly.request.get(`/api/projects/${publicId}/resource-dashboard/details?mdPerMm=null&snapshotId=${report.snapshotId}&dimension=all`);
    expect(detail.status()).toBe(200); expect((await detail.json()).data.totalCount).toBe(0);
    expect(await readonly.cookies()).toEqual([]);
    const unsupported = await readonly.request.post(path); expect(unsupported.status()).toBe(405);
    const rejected = await readonly.request.get(`${path}&resourceIds=00000000-0000-4000-8000-000000000001`); expect(rejected.status()).toBe(400);
    const unchanged = await readonly.request.get(`/api/projects/${publicId}`); expect((await unchanged.json()).data.project.revision).toBe(report.projectRevision);
    await restartIsolatedApplication();
    const persisted = await readonly.request.get(path); expect(persisted.status()).toBe(200); expect((await persisted.json()).data.snapshotId).toBe(report.snapshotId);
    const stale = await readonly.request.get(`/api/projects/${publicId}/resource-dashboard/details?mdPerMm=19&snapshotId=${report.snapshotId}&dimension=all`); expect(stale.status()).toBe(409);
  } finally { await readonly.close(); }
});
