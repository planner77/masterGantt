import { describe, expect, it, vi } from "vitest";

import type { ProjectSnapshotResponse } from "../../../src/contracts/projects";
import type { ProjectGanttImageExportRequest } from "../../../src/contracts/project-gantt-image-export";
import { parseProjectSvgExportInput } from "../../../src/server/exports/project-svg-export-contract";
import { buildProjectGanttSvg, ProjectSvgExportError } from "../../../src/server/exports/project-svg-export-core";
import { handleProjectSvgExport } from "../../../src/server/exports/project-svg-export-handler-core";

const publicId = "2fd0c93f-cd37-4b68-9f09-412239d99c79";
const projectRequest: ProjectGanttImageExportRequest = {
  scope: "project", scale: "day", hierarchyDisplay: "expanded",
};
const rangeRequest: ProjectGanttImageExportRequest = {
  scope: "range", startDate: "2026-09-15", endDate: "2026-09-16", scale: "week", hierarchyDisplay: "expanded",
};

function snapshot(): ProjectSnapshotResponse {
  return {
    data: {
      project: {
        publicId, name: "A <project> & image", description: "", status: "planned", revision: 3,
        calendar: { timezone: "Asia/Seoul", weekendDays: [6, 0], holidays: [] },
      },
      tasks: [
        {
          taskId: "1", externalId: "P", name: "Parent", type: "summary", scheduleMode: "auto",
          requestedStart: null, start: "2026-09-14", end: "2026-09-17", duration: 4, progress: 50,
          parentExternalId: null, siblingOrder: 0,
        },
        {
          taskId: "3", externalId: "C2", name: "Out of range", type: "task", scheduleMode: "auto",
          requestedStart: null, start: "2026-09-17", end: "2026-09-17", duration: 1, progress: 0,
          parentExternalId: "P", siblingOrder: 1,
        },
        {
          taskId: "2", externalId: "C1", name: "Child <script>alert(1)</script> & text", type: "task", scheduleMode: "auto",
          requestedStart: null, start: "2026-09-14", end: "2026-09-16", duration: 3, progress: 40,
          parentExternalId: "P", siblingOrder: 0,
        },
      ],
      links: [], permission: "readonly",
    },
  };
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://gantt.example/api/projects/${publicId}/exports/gantt-svg`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://gantt.example", "If-Match": '"3"', ...headers },
    body: JSON.stringify(body),
  });
}

function dependencies(data = snapshot()) {
  const getReadonlySnapshot = vi.fn(() => data);
  return {
    service: { getReadonlySnapshot }, applicationBaseUrl: "https://gantt.example",
    environment: "production", requestId: () => "svg-test", getReadonlySnapshot,
  };
}

describe("Gantt SVG export contract", () => {
  it("rejects unknown fields, invalid calendar dates, and reversed ranges", () => {
    expect(parseProjectSvgExportInput({ ...projectRequest, extra: true }).success).toBe(false);
    expect(parseProjectSvgExportInput({ ...rangeRequest, startDate: "2026-02-30" }).success).toBe(false);
    expect(parseProjectSvgExportInput({ ...rangeRequest, startDate: "2026-09-17" }).success).toBe(false);
    expect(parseProjectSvgExportInput({ ...rangeRequest, endDate: "2026-09-16T00:00:00Z" }).success).toBe(false);
  });

  it("renders deterministic, self-contained project grid and timeline in canonical hierarchy order", () => {
    const svg = buildProjectGanttSvg(snapshot(), projectRequest);
    expect(svg).toBe(buildProjectGanttSvg(snapshot(), projectRequest));
    expect(svg).toMatch(/<svg[^>]+width="608" height="212" viewBox="0 0 608 212"/);
    expect(svg).toContain("WBS / 작업명");
    expect(svg.indexOf("1 Parent")).toBeLessThan(svg.indexOf("1.1 Child"));
    expect(svg.indexOf("1.1 Child")).toBeLessThan(svg.indexOf("1.2 Out of range"));
    expect(svg).toContain("A &lt;project&gt; &amp; image");
    expect(svg).toContain("Child &lt;script&gt;alert(1)&lt;/script&gt; &amp; t…");
    expect(svg).not.toContain("<script>");
    expect(svg).not.toMatch(/<a\b|<image\b|@import|<foreignObject/i);
  });

  it("escapes XML special characters and preserves valid Unicode in labels", () => {
    const data = snapshot();
    data.data.project.name = '"Quoted" & \'single\' 🚀';
    data.data.tasks[0].name = 'A\u0000 <B> 🚀';
    const svg = buildProjectGanttSvg(data, projectRequest);
    expect(svg).toContain('&quot;Quoted&quot; &amp; &apos;single&apos; 🚀');
    expect(svg).toContain('A� &lt;B&gt; 🚀');
    expect(svg).not.toContain('A\u0000');
  });

  it("uses chart-only range and retains every canonical row while clipping bars", () => {
    const svg = buildProjectGanttSvg(snapshot(), rangeRequest);
    expect(svg).toMatch(/<svg[^>]+width="20" height="160" viewBox="0 0 20 160"/);
    expect(svg).not.toContain("WBS / 작업명");
    expect(svg).not.toContain('clip-path="url(#title-clip)"');
    expect(svg).not.toContain('· r3</text>');
    expect((svg.match(/<line x1="0" y1="/g) ?? []).length).toBeGreaterThan(2);
    expect(svg).toContain('clip-path="url(#chart-clip)"');
    expect(svg).not.toContain('x="-');
    expect(svg).toContain("Revision 3; 2026-09-15 to 2026-09-16; 3 tasks");
  });

  it("allows a gap inside the project timeline and keeps all chart rows without bars", () => {
    const data = snapshot();
    data.data.tasks = [
      { ...data.data.tasks[1], parentExternalId: null, start: "2026-09-14", end: "2026-09-14", siblingOrder: 0 },
      { ...data.data.tasks[2], parentExternalId: null, start: "2026-09-17", end: "2026-09-17", siblingOrder: 1 },
    ];
    const svg = buildProjectGanttSvg(data, rangeRequest);
    expect(svg).toMatch(/<svg[^>]+width="20" height="132" viewBox="0 0 20 132"/);
    expect(svg).toContain("Revision 3; 2026-09-15 to 2026-09-16; 2 tasks");
    expect(svg).not.toContain('fill="#2563eb"');
  });

  it("fails before creating oversized or structurally invalid SVG", () => {
    const bad = snapshot();
    bad.data.tasks[1].parentExternalId = "missing";
    expect(() => buildProjectGanttSvg(bad, projectRequest)).toThrow(ProjectSvgExportError);
    expect(() => buildProjectGanttSvg(snapshot(), {
      ...rangeRequest, endDate: "2036-09-16",
    })).toThrowError(/limit/);
  });

  it("renders FS links and calendar exceptions, including week scale, from canonical data", () => {
    const data = snapshot();
    data.data.links.push({ id: "L1", predecessorExternalId: "C1", successorExternalId: "C2", type: "FS", lag: 0 });
    data.data.project.calendar.holidays.push({ date: "2026-09-15", name: "Holiday" });
    data.data.project.calendar.exceptions = [{ date: "2026-09-16", name: "Rest", dayType: "NON_WORKING" }];
    const svg = buildProjectGanttSvg(data, { ...projectRequest, scale: "week" });
    expect(svg).toContain('marker-end="url(#link-arrow)"');
    expect((svg.match(/fill="#fff7ed"/g) ?? []).length).toBe(2);
    expect(svg).toContain("2026-W38");
  });

  it("keeps first and last project-day milestones inside week-scale chart boundaries", () => {
    const data = snapshot();
    data.data.tasks = [
      {
        ...data.data.tasks[1], taskId: "first", externalId: "FIRST", name: "First milestone", type: "milestone",
        parentExternalId: null, start: "2026-09-14", end: "2026-09-14", duration: 0, siblingOrder: 0,
      },
      {
        ...data.data.tasks[1], taskId: "last", externalId: "LAST", name: "Last milestone", type: "milestone",
        parentExternalId: null, start: "2026-09-17", end: "2026-09-17", duration: 0, siblingOrder: 1,
      },
    ];

    const svg = buildProjectGanttSvg(data, { ...projectRequest, scale: "week" });
    const polygons = [...svg.matchAll(/<polygon points="([^"]+)" fill="#7c3aed"\/>/g)];
    expect(polygons).toHaveLength(2);

    const xCoordinates = polygons.map((match) =>
      match[1].split(" ").map((point) => Number(point.split(",")[0])),
    );
    expect(Math.min(...xCoordinates[0])).toBe(480);
    expect(Math.max(...xCoordinates[1])).toBe(520);
    expect(xCoordinates.flat().every((x) => x >= 480 && x <= 520)).toBe(true);
  });

  it("rejects a range with no overlapping task", () => {
    expect(() => buildProjectGanttSvg(snapshot(), {
      ...rangeRequest, startDate: "2026-10-01", endDate: "2026-10-02",
    })).toThrowError(expect.objectContaining({ code: "EXPORT_RANGE_NO_OVERLAP" }));
  });
});

describe("Gantt SVG export HTTP", () => {
  it("returns attachment headers, revision, and a readonly snapshot image", async () => {
    const deps = dependencies();
    const response = await handleProjectSvgExport(request(projectRequest), publicId, deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(`mastergantt-${publicId}-r3.svg`);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("ETag")).toBe('"3"');
    expect(await response.text()).toContain("<svg ");
    expect(deps.getReadonlySnapshot).toHaveBeenCalledWith(publicId);
  });

  it("uses dated filename for a range", async () => {
    const response = await handleProjectSvgExport(request(rangeRequest), publicId, dependencies());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("-2026-09-15-2026-09-16.svg");
  });

  it("returns a distinct no-overlap error for range exports", async () => {
    const response = await handleProjectSvgExport(request({
      ...rangeRequest, startDate: "2026-10-01", endDate: "2026-10-02",
    }), publicId, dependencies());
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("EXPORT_RANGE_NO_OVERLAP");
  });

  it("rejects invalid Origin, missing strong revision, stale revision, and malformed bodies", async () => {
    const deps = dependencies();
    const wrongOrigin = await handleProjectSvgExport(request(projectRequest, { Origin: "https://evil.example" }), publicId, deps);
    expect(wrongOrigin.status).toBe(403);
    const noRevision = await handleProjectSvgExport(request(projectRequest, { "If-Match": "" }), publicId, deps);
    expect(noRevision.status).toBe(400);
    const stale = await handleProjectSvgExport(request(projectRequest, { "If-Match": '"2"' }), publicId, deps);
    expect(stale.status).toBe(412);
    const invalid = await handleProjectSvgExport(request({ ...projectRequest, unexpected: "x" }), publicId, deps);
    expect(invalid.status).toBe(400);
    expect(deps.getReadonlySnapshot).toHaveBeenCalledTimes(1);
  });
});
