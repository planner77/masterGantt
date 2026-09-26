import { describe, expect, it } from "vitest";

import type { ProjectTemplateDetailDto, ProjectTemplateDto } from "../../../src/contracts/project-templates";
import {
  handleCreateTemplateFromProject,
  handleDeleteTemplate,
  handleDuplicateTemplate,
  handleGetTemplate,
  handleInstantiateTemplate,
  handleListTemplates,
  handleUpdateTemplate,
  type ProjectTemplateHandlerDependencies,
} from "../../../src/server/templates/project-template-handlers-core";
import { ProjectTemplateError, type ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { FixedWindowRateLimiter } from "../../../src/server/security/rate-limit-core";
import { createSessionToken } from "../../../src/server/security/session-core";

const validSessionToken = createSessionToken();
const templateId = "tmpl-1111-2222-3333";
const sampleDto: ProjectTemplateDto = {
  id: templateId,
  name: "표준 템플릿",
  description: "설명",
  sourceProjectId: "1",
  sourceProjectName: "원본 프로젝트",
  active: true,
  taskCount: 5,
  milestoneCount: 1,
  processCount: 1,
  equipmentCount: 2,
  systemCount: 1,
  createdAt: "2026-09-27T00:00:00.000Z",
  updatedAt: "2026-09-27T00:00:00.000Z",
};

const sampleDetailDto: ProjectTemplateDetailDto = {
  ...sampleDto,
  previewTasks: [],
  sourceRevision: 1,
};

function createMockService(overrides: Partial<ProjectTemplateService> = {}): ProjectTemplateService {
  return {
    listTemplates: () => [sampleDto],
    getTemplate: (id: string) => {
      if (id === templateId) return sampleDetailDto;
      throw new ProjectTemplateError("TEMPLATE_NOT_FOUND", "Template not found.");
    },
    createTemplateFromProject: () => sampleDetailDto,
    updateTemplate: (_id: string, input: { name?: string; description?: string; active?: boolean }) => ({
      ...sampleDto,
      name: input.name ?? sampleDto.name,
    }),
    deleteTemplate: () => undefined,
    duplicateTemplate: () => ({ ...sampleDetailDto, id: "tmpl-dup" }),
    instantiateProject: async () => ({
      response: {
        data: {
          project: {
            publicId: "77777777-7777-4777-8777-777777777777",
            name: "새 프로젝트",
            description: "",
            status: "planned" as const,
            ownerName: "김팀장",
            revision: 1,
            calendar: {
              timezone: "Asia/Seoul",
              weekendDays: [6, 0],
              holidays: [],
            },
          },
          tasks: [],
          links: [],
          permission: "edit" as const,
          operation: {
            kind: "projectTemplateInstantiation" as const,
            templatePublicId: templateId,
            templateName: "새 프로젝트",
            counts: { tasks: 0, links: 0, holidays: 0 },
          },
          warnings: [],
        },
      },
      rawSessionToken: validSessionToken.rawToken,
    }),
    ...overrides,
  } as unknown as ProjectTemplateService;
}

const defaultDependencies: ProjectTemplateHandlerDependencies = {
  templateService: createMockService(),
  projectService: {
    authorize: (_id: string, token: string | undefined) =>
      token === validSessionToken.rawToken
        ? {
            kind: "authorized",
            authorization: {
              projectId: 1,
              projectPublicId: "11111111-1111-4111-8111-111111111111",
              projectRevision: 1,
              projectAuthVersion: 1,
              sessionId: 1,
              tokenHash: validSessionToken.tokenHash,
              expiresAt: "2026-10-01T00:00:00.000Z",
            },
          }
        : { kind: "unauthorized" },
  },
  applicationBaseUrl: "http://localhost:3000",
  allowInsecureHttp: "true",
  environment: "development",
  rateLimiter: new FixedWindowRateLimiter(10, 60000),
  requestId: () => "req-1",
};

describe("Project Template Handlers", () => {
  it("handles handleListTemplates successfully", async () => {
    const request = new Request("http://localhost:3000/api/project-templates?activeOnly=true");
    const response = await handleListTemplates(request, defaultDependencies);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(templateId);
  });

  it("handles handleGetTemplate successfully and 404 on missing", async () => {
    const request = new Request(`http://localhost:3000/api/project-templates/${templateId}`);
    const response = await handleGetTemplate(request, templateId, defaultDependencies);
    expect(response.status).toBe(200);

    const missingRequest = new Request("http://localhost:3000/api/project-templates/missing");
    const missingResponse = await handleGetTemplate(missingRequest, "missing", defaultDependencies);
    expect(missingResponse.status).toBe(404);
  });

  it("handles handleCreateTemplateFromProject with origin check and session validation", async () => {
    // 1. Origin not allowed
    const badOriginReq = new Request("http://localhost:3000/api/project-templates", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://evil.com" },
      body: JSON.stringify({
        sourceProjectPublicId: "11111111-1111-4111-8111-111111111111",
        name: "새 템플릿",
      }),
    });
    const badOriginRes = await handleCreateTemplateFromProject(badOriginReq, defaultDependencies);
    expect(badOriginRes.status).toBe(403);

    // 2. Unauthorized session
    const unauthReq = new Request("http://localhost:3000/api/project-templates", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", "if-match": '"1"' },
      body: JSON.stringify({
        sourceProjectPublicId: "11111111-1111-4111-8111-111111111111",
        name: "새 템플릿",
      }),
    });
    const unauthRes = await handleCreateTemplateFromProject(unauthReq, defaultDependencies);
    expect(unauthRes.status).toBe(401);

    // 3. Authorized request
    const authReq = new Request("http://localhost:3000/api/project-templates", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        cookie: `mastergantt_edit=${validSessionToken.rawToken}`,
        "if-match": '"1"',
      },
      body: JSON.stringify({
        sourceProjectPublicId: "11111111-1111-4111-8111-111111111111",
        name: "새 템플릿",
      }),
    });
    const authRes = await handleCreateTemplateFromProject(authReq, defaultDependencies);
    expect(authRes.status).toBe(201);
    const body = await authRes.json();
    expect(body.data.id).toBe(templateId);
  });

  it("handles handleUpdateTemplate and handleDeleteTemplate", async () => {
    const updateReq = new Request(`http://localhost:3000/api/project-templates/${templateId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "이름 변경" }),
    });
    const updateRes = await handleUpdateTemplate(updateReq, templateId, defaultDependencies);
    expect(updateRes.status).toBe(200);

    const deleteReq = new Request(`http://localhost:3000/api/project-templates/${templateId}`, {
      method: "DELETE",
      headers: { origin: "http://localhost:3000" },
    });
    const deleteRes = await handleDeleteTemplate(deleteReq, templateId, defaultDependencies);
    expect(deleteRes.status).toBe(200);
  });

  it("handles handleDuplicateTemplate", async () => {
    const dupReq = new Request(`http://localhost:3000/api/project-templates/${templateId}/duplicate`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ name: "복제본" }),
    });
    const dupRes = await handleDuplicateTemplate(dupReq, templateId, defaultDependencies);
    expect(dupRes.status).toBe(201);
  });

  it("handles handleInstantiateTemplate with rate limiting and session cookie emission", async () => {
    const instantiateReq = new Request(`http://localhost:3000/api/project-templates/${templateId}/instantiate`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({
        name: "인스턴스 프로젝트",
        ownerName: "김팀장",
        editPassword: "pass",
        projectStartDate: "2026-11-02",
      }),
    });

    const response = await handleInstantiateTemplate(instantiateReq, templateId, defaultDependencies);
    expect(response.status).toBe(201);
    expect(response.headers.get("Set-Cookie")).toContain("mastergantt_edit=");
    expect(response.headers.get("Location")).toBe("/projects/77777777-7777-4777-8777-777777777777");
  });
});
