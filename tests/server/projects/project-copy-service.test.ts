import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { LinkService } from "../../../src/server/projects/link-service-core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import type { PasswordHashRecord } from "../../../src/server/security/password-core";
import { hashSessionToken } from "../../../src/server/security/session-core";
const migrationsDirectory=join(process.cwd(),"db","migrations");
function fixedPasswordHash(marker:number):PasswordHashRecord{return{algorithm:"scrypt",salt:Buffer.alloc(16,marker),hash:Buffer.alloc(32,marker+1),n:32768,r:8,p:3,keyLength:32}}
describe("ProjectCopyService",()=>{
it("copies hierarchy, links and holidays into independent IDs with revision 1", async () => {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
  try {
    const clock = () => new Date("2026-09-14T00:00:00.000Z");
    const sourceService = new ProjectService(database, { clock, hashPassword: async () => fixedPasswordHash(1), generateSessionToken: () => ({ rawToken: "source-token", tokenHash: hashSessionToken("source-token") }) });
    const created = await sourceService.create({ name: "Source", description: "source desc", editPassword: "source password" });
    const sourceId = created.response.data.project.publicId;
    const auth = sourceService.authorize(sourceId, "source-token");
    if (auth.kind !== "authorized") throw new Error("auth");
    const authorization = auth.authorization, revision = () => sourceService.getReadonlySnapshot(sourceId)!.data.project.revision;
    database.prepare("INSERT INTO project_holidays(project_id,holiday_date,name,created_at) VALUES(?,?,?,?)").run(authorization.projectId, "2026-09-21", "holiday", clock().toISOString());
    const sourceHolidayCount = database.prepare("SELECT count(*) FROM project_holidays WHERE project_id=?").pluck().get(authorization.projectId);
    const parent = sourceService.createTask(authorization, revision(), { name: "Parent", externalId: "P", type: "summary" }).data.tasks.find((task) => task.externalId === "P")!;
    sourceService.createTask(authorization, revision(), { name: "Child", externalId: "C", type: "task", parentTaskId: parent.taskId, start: "2026-09-14", duration: 2, progress: 50 });
    sourceService.createTask(authorization, revision(), { name: "Predecessor", externalId: "D", type: "task", start: "2026-09-14", duration: 1, progress: 50 });
    new LinkService(database, clock).create(authorization, revision(), { predecessorExternalId: "D", successorExternalId: "C", type: "FS", lag: 0 });
    const before = sourceService.getReadonlySnapshot(sourceId)!;
    const copyService = new ProjectCopyService(database, { clock: () => new Date("2026-09-14T01:00:00.000Z"), hashPassword: async () => fixedPasswordHash(9), generateSessionToken: () => ({ rawToken: "copy-token", tokenHash: hashSessionToken("copy-token") }) });
    const copied = await copyService.copy(authorization, revision(), { name: "Copy", description: "copy desc", editPassword: "new copy password", resetProgress: false });
    expect(copied.response.data.project).toMatchObject({ name: "Copy", description: "copy desc", revision: 1 });
    expect(copied.response.data.operation.counts).toEqual({ tasks: 3, links: 1, holidays: sourceHolidayCount });
    expect(copied.response.data.tasks.find((task) => task.externalId === "C")).toMatchObject({ parentExternalId: "P", start: "2026-09-15", end: "2026-09-16", progress: 50 });
    expect(copied.response.data.tasks.find((task) => task.externalId === "P")).toMatchObject({ type: "summary", start: "2026-09-15", end: "2026-09-16", progress: 50 });
    expect(copied.response.data.links[0]).toMatchObject({ predecessorExternalId: "D", successorExternalId: "C", type: "FS", lag: 0 });
    expect(copied.response.data.links[0].id).not.toBe(before.data.links[0].id);
    const sourceIds = new Set(before.data.tasks.map((task) => task.taskId));
    expect(copied.response.data.tasks.every((task) => !sourceIds.has(task.taskId))).toBe(true);
    expect(sourceService.getReadonlySnapshot(sourceId)).toEqual(before);
    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    database.close();
  }
});
it("resets leaf progress and recalculates summary progress",async()=>{const{database}=openDatabase({filename:":memory:",migrationsDirectory});const sourceService=new ProjectService(database,{hashPassword:async()=>fixedPasswordHash(1),generateSessionToken:()=>({rawToken:"source",tokenHash:hashSessionToken("source")})});const created=await sourceService.create({name:"S",description:"",editPassword:"source password"});const sourceId=created.response.data.project.publicId,project=database.prepare("SELECT id FROM projects WHERE public_id=?").get(sourceId) as{id:number},now=new Date().toISOString();const parent=Number(database.prepare(`INSERT INTO tasks(project_id,external_id,public_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,parent_id,sort_order,created_at,updated_at) VALUES(?,?,?,?,'summary','auto',NULL,'2026-09-14','2026-09-14',1,80,NULL,0,?,?)`).run(project.id,"P",randomUUID(),"P",now,now).lastInsertRowid);database.prepare(`INSERT INTO tasks(project_id,external_id,public_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,parent_id,sort_order,created_at,updated_at) VALUES(?,?,?,?,'task','auto','2026-09-14','2026-09-14','2026-09-14',1,80,?,0,?,?)`).run(project.id,"C",randomUUID(),"C",parent,now,now);const auth=sourceService.authorize(sourceId,"source");if(auth.kind!=="authorized")throw new Error("auth");const copy=new ProjectCopyService(database,{hashPassword:async()=>fixedPasswordHash(2),generateSessionToken:()=>({rawToken:"copy",tokenHash:hashSessionToken("copy")})});const result=await copy.copy(auth.authorization,1,{name:"C",description:"",editPassword:"copy password",resetProgress:true});expect(result.response.data.tasks.find(t=>t.externalId==="C")?.progress).toBe(0);expect(result.response.data.tasks.find(t=>t.externalId==="P")?.progress).toBe(0)})});

it("creates a planned copy even when the source is completed", async () => {
  const { database } = openDatabase({ filename: ":memory:", migrationsDirectory });
  try {
    const sourceToken = "source-status-token";
    const sourceService = new ProjectService(database, {
      hashPassword: async () => fixedPasswordHash(1),
      generateSessionToken: () => ({ rawToken: sourceToken, tokenHash: hashSessionToken(sourceToken) }),
    });
    const source = await sourceService.create({
      name: "Completed source", description: "", editPassword: "source password", status: "completed",
    });
    const sourceId = source.response.data.project.publicId;
    const authorization = sourceService.authorize(sourceId, sourceToken);
    expect(authorization.kind).toBe("authorized");
    if (authorization.kind !== "authorized") return;
    const copyToken = "copy-status-token";
    const copyService = new ProjectCopyService(database, {
      hashPassword: async () => fixedPasswordHash(2),
      generateSessionToken: () => ({ rawToken: copyToken, tokenHash: hashSessionToken(copyToken) }),
    });
    const copied = await copyService.copy(authorization.authorization, 1, {
      name: "Planned copy", description: "", editPassword: "copy password",
    });
    expect(copied.response.data.project).toMatchObject({ status: "planned", revision: 1 });
    expect(sourceService.getReadonlySnapshot(sourceId)?.data.project.status).toBe("completed");
    const listed = new Map(sourceService.listProjects().data.projects.map((project) => [project.publicId, project.status]));
    expect(listed.get(sourceId)).toBe("completed");
    expect(listed.get(copied.response.data.project.publicId)).toBe("planned");
  } finally {
    database.close();
  }
});
