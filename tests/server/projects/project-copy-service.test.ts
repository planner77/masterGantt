import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import type { PasswordHashRecord } from "../../../src/server/security/password-core";
import { hashSessionToken } from "../../../src/server/security/session-core";
const migrationsDirectory=join(process.cwd(),"db","migrations");
function fixedPasswordHash(marker:number):PasswordHashRecord{return{algorithm:"scrypt",salt:Buffer.alloc(16,marker),hash:Buffer.alloc(32,marker+1),n:32768,r:8,p:3,keyLength:32}}
describe("ProjectCopyService",()=>{
it("copies hierarchy, links and holidays into independent IDs with revision 1",async()=>{const{database}=openDatabase({filename:":memory:",migrationsDirectory});const sourceService=new ProjectService(database,{clock:()=>new Date("2026-09-14T00:00:00.000Z"),hashPassword:async()=>fixedPasswordHash(1),generateSessionToken:()=>({rawToken:"source-token",tokenHash:hashSessionToken("source-token")})});const created=await sourceService.create({name:"Source",description:"source desc",editPassword:"source password"});const sourceId=created.response.data.project.publicId;const project=database.prepare("SELECT id FROM projects WHERE public_id=?").get(sourceId) as{id:number};const now="2026-09-14T00:00:00.000Z";database.prepare("INSERT INTO project_holidays(project_id,holiday_date,name,created_at) VALUES(?,?,?,?)").run(project.id,"2026-09-21","holiday",now);const sourceHolidayCount=(database.prepare("SELECT count(*) AS count FROM project_holidays WHERE project_id=?").get(project.id) as {count:number}).count;const parentId=Number(database.prepare(`INSERT INTO tasks(project_id,external_id,public_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,parent_id,sort_order,created_at,updated_at) VALUES(?,?,?,?,'summary','auto',NULL,'2026-09-14','2026-09-15',2,50,NULL,0,?,?)`).run(project.id,"P",randomUUID(),"Parent",now,now).lastInsertRowid);const childId=Number(database.prepare(`INSERT INTO tasks(project_id,external_id,public_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,parent_id,sort_order,created_at,updated_at) VALUES(?,?,?,?,'task','auto','2026-09-14','2026-09-14','2026-09-15',2,50,?,0,?,?)`).run(project.id,"C",randomUUID(),"Child",parentId,now,now).lastInsertRowid);database.prepare(`INSERT INTO links(public_id,project_id,predecessor_task_id,successor_task_id,type,lag,created_at,updated_at) VALUES(?,?,?,?,'FS',0,?,?)`).run(randomUUID(),project.id,parentId,childId,now,now);const auth=sourceService.authorize(sourceId,"source-token");expect(auth.kind).toBe("authorized");if(auth.kind!=="authorized")return;const copyService=new ProjectCopyService(database,{clock:()=>new Date("2026-09-14T01:00:00.000Z"),hashPassword:async()=>fixedPasswordHash(9),generateSessionToken:()=>({rawToken:"copy-token",tokenHash:hashSessionToken("copy-token")})});const copied=await copyService.copy(auth.authorization,1,{name:"Copy",description:"copy desc",editPassword:"new copy password",resetProgress:false});expect(copied.response.data.project).toMatchObject({name:"Copy",description:"copy desc",revision:1});expect(copied.response.data.operation.counts).toEqual({tasks:2,links:1,holidays:sourceHolidayCount});expect(copied.response.data.tasks.find(t=>t.externalId==="C")).toMatchObject({parentExternalId:"P",progress:50});const sourceIds=database.prepare("SELECT public_id FROM tasks WHERE project_id=?").pluck().all(project.id) as string[];expect(copied.response.data.tasks.every(t=>!sourceIds.includes(t.taskId))).toBe(true);expect(sourceService.getReadonlySnapshot(sourceId)?.data.project.revision).toBe(1)});
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
