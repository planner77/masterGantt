import { describe, expect, it } from "vitest";
import { isWbsViewReadQuery } from "../e2e/helpers/read-only-requests";

const projectPath = "/api/projects/12345678-1234-4abc-8def-123456789abc";
const viewPath = `${projectPath}/resource-dashboard/views`;
const request = (method: string, path: string) => ({ method: () => method, url: () => `http://localhost:3100${path}` });

describe("E2E 업무 쓰기 관찰기의 WBS 읽기 분류", () => {
  it.each([viewPath, `${viewPath}?request=report`])("POST 조회 경로만 읽기로 허용한다: %s", path => {
    expect(isWbsViewReadQuery(request("POST", path))).toBe(true);
  });

  it.each(["GET", "HEAD", "PUT", "PATCH", "DELETE", "OPTIONS", "post"])("같은 경로의 %s는 POST 읽기 예외가 아니다", method => {
    expect(isWbsViewReadQuery(request(method, viewPath))).toBe(false);
  });

  it.each([
    `${projectPath}/tasks`, `${projectPath}/task-commands`, `${projectPath}/imports`,
    `${projectPath}/edit-sessions`, `${projectPath}/logistics/equipment`,
    `${projectPath}/tasks/task-1/assignments`, `${projectPath}/resource-dashboard/query`,
    `${viewPath}/`, `${viewPath}/delete`, `${viewPath}-extra`,
    viewPath.replace("12345678-1234-4abc-8def-123456789abc", "not-a-project-uuid"),
    `/prefix${viewPath}`, viewPath.replace("/views", "/%76iews"),
  ])("다른 업무 POST·유사 경로를 면제하지 않는다: %s", path => {
    expect(isWbsViewReadQuery(request("POST", path))).toBe(false);
  });

  it("읽기를 제외해도 실제 Task·Assignment·설비 쓰기는 모두 계수한다", () => {
    const requests = [
      request("GET", projectPath), request("HEAD", projectPath), request("POST", viewPath),
      request("POST", `${projectPath}/tasks`), request("PATCH", `${projectPath}/tasks/task-1`),
      request("PUT", `${projectPath}/tasks/task-1/assignments`),
      request("DELETE", `${projectPath}/logistics/equipment/equipment-1`), request("DELETE", viewPath),
    ];
    const writes = requests.filter(value => !["GET", "HEAD"].includes(value.method()) && !isWbsViewReadQuery(value));
    expect(writes.map(value => `${value.method()} ${new URL(value.url()).pathname}`)).toEqual([
      `POST ${projectPath}/tasks`, `PATCH ${projectPath}/tasks/task-1`,
      `PUT ${projectPath}/tasks/task-1/assignments`, `DELETE ${projectPath}/logistics/equipment/equipment-1`,
      `DELETE ${viewPath}`,
    ]);
  });
});
