import { describe, expect, it, vi } from "vitest";

import type { LinkMutationResponse } from "../../../src/contracts/projects";
import {
  handleCreateLink,
  handleUpdateLink,
} from "../../../src/server/projects/link-handlers-core";
import {
  RevisionMismatchError,
  type AuthorizedEditSession,
} from "../../../src/server/projects/project-service-core";

const publicId = "2fd0c93f-cd37-4b68-9f09-412239d99c79";
const linkId = "f6760712-5649-4edc-9781-5df172e27e88";
const rawToken = "A".repeat(43);
const cookie = `__Host-mastergantt_edit=${rawToken}`;
const authorization: AuthorizedEditSession = {
  projectId: 1,
  projectPublicId: publicId,
  projectRevision: 1,
  projectAuthVersion: 1,
  sessionId: 1,
  tokenHash: Buffer.alloc(32, 1),
  expiresAt: "2026-09-12T00:00:00.000Z",
};
const result: LinkMutationResponse = {
  data: {
    project: {
      publicId,
      name: "Project",
      description: "",
      status: "planned",
      revision: 2,
      calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
    },
    tasks: [],
    links: [
      {
        id: linkId,
        predecessorExternalId: "A",
        successorExternalId: "B",
        type: "SS",
        lag: 2,
      },
    ],
    warnings: [],
    operation: {
      kind: "linkUpdate",
      changedTaskExternalIds: ["B"],
      deletedLinkIds: [],
      updatedLinkId: linkId,
    },
  },
};

describe("Link Handlers", () => {
  it("handles handleUpdateLink successfully", async () => {
    const service = {
      authorize: vi.fn().mockReturnValue({ kind: "authorized", authorization }),
      create: vi.fn(),
      update: vi.fn().mockReturnValue(result),
      delete: vi.fn(),
    };

    const request = new Request(`https://example.com/api/projects/${publicId}/links/${linkId}`, {
      method: "PATCH",
      headers: {
        origin: "https://example.com",
        cookie,
        "if-match": '"1"',
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "SS", lag: 2 }),
    });

    const response = await handleUpdateLink(request, publicId, linkId, {
      service,
      applicationBaseUrl: "https://example.com",
      environment: "production",
      requestId: () => "req-1",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"2"');
    expect(await response.json()).toEqual(result);
    expect(service.update).toHaveBeenCalledWith(authorization, 1, linkId, { type: "SS", lag: 2 });
  });

  it("handles handleUpdateLink with 400 on empty input", async () => {
    const service = {
      authorize: vi.fn().mockReturnValue({ kind: "authorized", authorization }),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const request = new Request(`https://example.com/api/projects/${publicId}/links/${linkId}`, {
      method: "PATCH",
      headers: {
        origin: "https://example.com",
        cookie,
        "if-match": '"1"',
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await handleUpdateLink(request, publicId, linkId, {
      service,
      applicationBaseUrl: "https://example.com",
      environment: "production",
      requestId: () => "req-1",
    });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("INVALID_REQUEST");
  });

  it("handles handleUpdateLink with 412 on revision mismatch", async () => {
    const service = {
      authorize: vi.fn().mockReturnValue({ kind: "authorized", authorization }),
      create: vi.fn(),
      update: vi.fn().mockImplementation(() => {
        throw new RevisionMismatchError();
      }),
      delete: vi.fn(),
    };

    const request = new Request(`https://example.com/api/projects/${publicId}/links/${linkId}`, {
      method: "PATCH",
      headers: {
        origin: "https://example.com",
        cookie,
        "if-match": '"1"',
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "FF", lag: 0 }),
    });

    const response = await handleUpdateLink(request, publicId, linkId, {
      service,
      applicationBaseUrl: "https://example.com",
      environment: "production",
      requestId: () => "req-1",
    });

    expect(response.status).toBe(412);
  });

  it("handles handleCreateLink with custom type and lag", async () => {
    const createResult: LinkMutationResponse = {
      ...result,
      data: {
        ...result.data,
        operation: {
          kind: "linkCreate",
          changedTaskExternalIds: ["B"],
          deletedLinkIds: [],
        },
      },
    };

    const service = {
      authorize: vi.fn().mockReturnValue({ kind: "authorized", authorization }),
      create: vi.fn().mockReturnValue(createResult),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const request = new Request(`https://example.com/api/projects/${publicId}/links`, {
      method: "POST",
      headers: {
        origin: "https://example.com",
        cookie,
        "if-match": '"1"',
        "content-type": "application/json",
      },
      body: JSON.stringify({ predecessorExternalId: "A", successorExternalId: "B", type: "FF", lag: 1 }),
    });

    const response = await handleCreateLink(request, publicId, {
      service,
      applicationBaseUrl: "https://example.com",
      environment: "production",
      requestId: () => "req-1",
    });

    expect(response.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(authorization, 1, {
      predecessorExternalId: "A",
      successorExternalId: "B",
      type: "FF",
      lag: 1,
    });
  });
});
