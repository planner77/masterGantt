import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { ProjectSnapshotResponse, ProjectTaskDto } from "../../../src/contracts/projects";
import { resourceKpiIntegrationFixture } from "../../fixtures/resource-kpi-integration";

export const integrationAdminPassword = "Synthetic530Only!";

/** Real HTTP mutations populate this fixture's disposable SQLite database. */
export async function seedResourceKpiIntegration(request: APIRequestContext, origin: string) {
  const source = resourceKpiIntegrationFixture();
  const headers = { Origin: origin };
  const created = await request.post("/api/projects", { headers, data: {
    name: "Resource KPI integration #530", ownerName: "E2E 자동화",
    description: "Synthetic shared raw ledger", editPassword: "UI530!",
  } });
  expect(created.status(), await created.text()).toBe(201);
  const publicId = (await created.json()).data.project.publicId as string;
  const api = `/api/projects/${publicId}`;
  const getSnapshot = async () => (await (await request.get(api)).json()) as ProjectSnapshotResponse;
  let snapshot = await getSnapshot();
  const mutate = async (path: string, data: unknown, method: "post" | "put" | "patch" = "post", status = 200) => {
    const response = await request[method](`${api}${path}`, { headers: { ...headers, "If-Match": `"${snapshot.data.project.revision}"` }, data });
    expect(response.status(), await response.text()).toBe(status);
    snapshot = await getSnapshot();
    return response;
  };
  // Remove the default country's public holidays: the shared oracle is five
  // explicit Mon–Fri workdays, not an assumption about a country's holidays.
  await mutate("/work-calendar", { countryRules: [], customDates: [] }, "put");
  const tasks: Record<string, ProjectTaskDto> = {};
  for (const task of source.tasks) {
    const response = await mutate("/tasks", { name: task.taskId, type: task.type,
      start: task.start, duration: task.duration, progress: task.progress }, "post", 201);
    tasks[task.taskId] = (await response.json()).data.tasks.find((created: ProjectTaskDto) => created.name === task.taskId);
  }
  await mutate("/milestone-memberships", { changes: source.memberships.map(membership => ({
    taskId: tasks[membership.taskId].taskId, milestoneTaskId: tasks[membership.milestoneTaskId].taskId,
  })) });
  expect((await request.post("/api/resource-catalog/admin-sessions", { headers, data: { password: integrationAdminPassword } })).status()).toBe(201);
  let catalog = (await (await request.get("/api/resources")).json()).data;
  const catalogMutate = async (path: string, data: unknown, method: "post" | "put" = "post", status = 201) => {
    const response = await request[method](path, { headers: { ...headers, "If-Match": `"${catalog.revision}"` }, data });
    expect(response.status(), await response.text()).toBe(status); catalog = (await response.json()).data;
  };
  const resources: Record<string, string> = {}, groups: Record<string, string> = {};
  for (const resource of source.resources) {
    await catalogMutate("/api/resources", { name: resource.name, code: resource.code,
      roles: resource.roles, developerGrade: resource.developerGrade });
    resources[resource.resourceId] = catalog.resources.find((created: { code: string }) => created.code === resource.code).id;
  }
  const groupIds = [...new Set(source.resources.flatMap(resource => resource.groupIds ?? []))];
  for (const code of groupIds) {
    await catalogMutate("/api/resource-groups", { name: code, code });
    groups[code] = catalog.groups.find((group: { code: string }) => group.code === code).id;
    await catalogMutate(`/api/resource-groups/${groups[code]}/members`, {
      resourceIds: source.resources.filter(resource => resource.groupIds?.includes(code)).map(resource => resources[resource.resourceId]),
    }, "put", 200);
  }
  for (const task of source.tasks) {
    const assignments = source.assignments.filter(assignment => assignment.taskId === task.taskId);
    if (!assignments.length) continue;
    await mutate(`/tasks/${tasks[task.taskId].taskId}/assignments`, { catalogRevision: catalog.revision,
      targets: assignments.map(assignment => ({ kind: assignment.kind,
        id: assignment.kind === "resource" ? resources[assignment.targetId] : groups[assignment.targetId],
        ...(assignment.allocationPercent === null ? {} : { allocation: { start: null, end: null, percent: assignment.allocationPercent } }),
      })),
    }, "put");
  }
  for (const task of source.tasks) {
    const actual = snapshot.data.tasks.find(created => created.taskId === tasks[task.taskId].taskId)!;
    expect(actual).toMatchObject({ name: task.taskId, type: task.type, start: task.start,
      end: task.end, duration: task.duration, progress: task.progress });
  }
  return { publicId, api, tasks, resources, groups, snapshot, getSnapshot, mutate };
}

export async function ganttIntegrationState(page: Page) {
  return page.locator(".project-gantt-frame").evaluate(element => ({
    instance: element.getAttribute("data-project-gantt-instance"),
    apiInstance: element.getAttribute("data-project-gantt-api-instance"),
    publicViewport: Reflect.get(element, "__masterganttPublicViewport"),
    left: element.querySelector(".wx-chart")!.scrollLeft,
    top: element.querySelector(".wx-gantt")!.scrollTop,
    columns: Array.from(element.querySelectorAll(".wx-header .wx-cell")).map(cell => cell.getBoundingClientRect().width),
    selection: Array.from(element.querySelectorAll(".wx-row.wx-selected")).map(row => row.getAttribute("data-id")),
    tree: Array.from(element.querySelectorAll(".wx-row")).map(row => row.getAttribute("data-id")),
  }));
}
