import { createServer } from "node:http";
import { handleGetTaskLogisticsLinks } from "../../../src/server/logistics/logistics-handlers-core";
import { handleRetiredLogisticsRoute } from "../../../src/server/logistics/logistics-retirement-handlers-core";
import { handleGetLogisticsPhysicalUsage, readLogisticsPhysicalUsage } from "../../../src/server/logistics/logistics-physical-usage-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { editSessionCookieName } from "../../../src/server/security/cookie-core";
import { randomUUID } from "node:crypto";
import { copyFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { TaskTargetBindingService, loadTaskTargetBindingSnapshot } from "../../../src/server/logistics/task-target-bindings-service-core";
import { LogisticsTargetService } from "../../../src/server/logistics/logistics-targets-service-core";
import { LogisticsService } from "../../../src/server/logistics/logistics-service-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { ProjectRepository, EditSessionRepository } from "../../../src/server/repositories/project-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { ProjectMasterRepository } from "../../../src/server/repositories/project-master-repository-core";
import { ProcessCatalogRepository } from "../../../src/server/repositories/process-catalog-repository-core";
import { createSessionToken, sessionExpiry } from "../../../src/server/security/session-core";

const now = new Date("2026-10-14T01:00:00Z"), stamp=now.toISOString(), migrationsDirectory=join(process.cwd(),"db/migrations");
function setup(filename=":memory:",migrations=migrationsDirectory) {
  const {database:db}=openDatabase({filename,migrationsDirectory:migrations});
  const project=new ProjectRepository(db).insert({publicId:randomUUID(),name:"F3",description:"",status:"planned",passwordKdf:"scrypt",passwordSalt:Buffer.alloc(16,1),passwordHash:Buffer.alloc(32,2),scryptN:32768,scryptR:8,scryptP:3,scryptKeyLength:32,calendarTimezone:"Asia/Seoul",createdAt:stamp,updatedAt:stamp});
  const token=createSessionToken(), expiresAt=sessionExpiry(now).toISOString();
  const sessionId=new EditSessionRepository(db).insert({projectId:project.id,tokenHash:token.tokenHash,authVersion:project.authVersion,createdAt:stamp,expiresAt});
  const auth={projectId:project.id,projectPublicId:project.publicId,projectRevision:1,projectAuthVersion:project.authVersion,sessionId,tokenHash:token.tokenHash,expiresAt};
  const logistics=new LogisticsRepository(db), schedule=new ScheduleRepository(db);
  const systems=["MCS","ACS"].map(code=>logistics.insertSystem({publicId:randomUUID(),projectId:project.id,code,name:code,systemType:"mcs",layer:"coordinator",scope:"project",now:stamp}));
  const task=(name:string,type:"task"|"summary"="task",parentId:number|null=null)=>schedule.insertTask({projectId:project.id,publicId:randomUUID(),externalId:name,name,type,scheduleMode:"auto",requestedStart:null,startDate:type==="summary"?null:"2026-10-14",endDate:type==="summary"?null:"2026-10-14",duration:type==="summary"?null:1,progress:type==="summary"?null:0,parentId,sortOrder:0,createdAt:stamp,updatedAt:stamp});
  const summary=task("Summary","summary"), child=task("Child","task",summary.id), leaf=task("Leaf");
  const targets=new LogisticsTargetService(db,{clock:()=>now}), bindings=new TaskTargetBindingService(db,{clock:()=>now});
  const revision=()=>new ProjectRepository(db).findByPublicId(project.publicId)!.revision;
  const target=(code:string)=>targets.create(auth,revision(),{code,name:code,scope:"project_common",members:[{kind:"system",entityId:systems[0].publicId}]}).data.target!;
  return {db,project,auth,token,logistics,systems,summary,child,leaf,targets,bindings,revision,target};
}
type Fixture=ReturnType<typeof setup>;
const whole=(targetId:string,scope:"self"|"subtree"="self")=>({targetId,selection:"whole",scope,memberIds:[]});
function equipmentTarget(f:Fixture) {
  const masters=new ProjectMasterRepository(f.db);
  const item=(category:"BUSINESS_UNIT"|"PRODUCT"|"SITE_ENTITY",code:string)=>masters.insertItem({publicId:randomUUID(),category,code,name:code,active:true,sortOrder:0,now:stamp});
  const bu=item("BUSINESS_UNIT","BU"),product=item("PRODUCT","P"),site=item("SITE_ENTITY","S");
  f.db.prepare("INSERT INTO business_unit_products(business_unit_id,product_id) VALUES(?,?)").run(bu.id,product.id);
  f.db.prepare("INSERT INTO business_unit_product_sites(business_unit_id,product_id,site_entity_id) VALUES(?,?,?)").run(bu.id,product.id,site.id);
  f.db.prepare("UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?").run(bu.id,product.id,site.id,f.project.id);
  const type=Number(f.db.prepare("INSERT INTO process_types(public_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?)").run(randomUUID(),"ASSEMBLY","Assembly",stamp,stamp).lastInsertRowid);
  const occurrenceId=randomUUID();
  f.db.prepare("INSERT INTO site_product_processes(public_id,business_unit_id,product_id,site_entity_id,process_type_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(occurrenceId,bu.id,product.id,site.id,type,"A","A",stamp,stamp);
  const process=f.logistics.insertProcess({publicId:randomUUID(),projectId:f.project.id,code:"A",name:"A",parentId:null,active:1,now:stamp});
  const catalog=new ProcessCatalogRepository(f.db);catalog.setMapping(f.project.id,process.id,catalog.find("occurrences",occurrenceId)!,null,stamp);
  const equipment=f.logistics.insertEquipment({publicId:randomUUID(),projectId:f.project.id,processId:process.id,code:"AMR",name:"AMR",equipmentType:"amr",managementUnit:"fleet",quantity:10,now:stamp});
  const target=f.targets.create(f.auth,f.revision(),{code:"E",name:"E",scope:"process",projectProcessId:process.publicId,members:[{kind:"equipment",entityId:equipment.publicId}]}).data.target!;
  return {equipment,target};
}
describe("Issue #617 binding persistence and membership guards",()=>{
  it("persists direct/subtree union with stable binding identity and actual regular/Summary counts, never inferred legacy Targets",()=>{
    const f=setup();try {
      const a=f.target("A"),b=f.target("B");
      expect(f.targets.usage(f.project.publicId,a.id).referencedByTaskCount).toBe(0);
      f.logistics.replaceTaskSystemLinks(f.project.id,f.leaf.id,[{systemId:f.systems[0].id,scope:"self"}],stamp);
      expect(f.bindings.get(f.project.publicId,f.leaf.publicId).effective.effectiveTargetIds).toEqual([]);
      f.bindings.replace(f.auth,f.revision(),f.summary.publicId,{bindings:[whole(a.id,"subtree")]});
      const direct=f.bindings.replace(f.auth,f.revision(),f.child.publicId,{bindings:[whole(a.id),whole(b.id)]}).data;
      expect(direct.effective.effectiveSystemIds).toEqual([f.systems[0].publicId]);
      expect(direct.effective.effectiveMembers[0].provenance).toHaveLength(3);
      expect(f.targets.usage(f.project.publicId,a.id)).toMatchObject({referencedByTaskCount:1,referencedBySummaryCount:1});
      // Target details open these exact canonical tasks, with no per-task GET fan-out.
      const usageRevision=f.revision();
      const usage=f.targets.usage(f.project.publicId,a.id);
      expect(usage.projectRevision).toBe(usageRevision);
      expect(usage.relatedTasks).toEqual([
        {taskId:f.summary.publicId,type:"summary"},
        {taskId:f.child.publicId,type:"task"},
      ].sort((a,b)=>a.taskId.localeCompare(b.taskId)));
      expect(usage.relatedTasks.some(t=>t.taskId===f.leaf.publicId)).toBe(false);
      expect(f.revision()).toBe(usageRevision);
      const previous=direct.bindings.find(x=>x.targetId===a.id)!;
      const replaced=f.bindings.replace(f.auth,f.revision(),f.child.publicId,{bindings:[{...whole(a.id),id:previous.id}]}).data;
      expect(replaced.bindings[0].id).toBe(previous.id);
      expect(f.bindings.get(f.project.publicId,f.child.publicId).effective.inheritedBindings).toHaveLength(1);
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    }finally{f.db.close();}
  });
  it("rejects duplicate Target, empty/foreign subset, nonSummary subtree, wrong binding ID and stale/revoked authorization atomically",()=>{
    const f=setup();try {
      const a=f.target("A"),b=f.target("B"),revision=f.revision();
      const invalid=[{bindings:[whole(a.id),whole(a.id)]},{bindings:[{...whole(a.id),selection:"subset"}]},{bindings:[{...whole(a.id),selection:"subset",memberIds:[b.members[0].id]}]},{bindings:[whole(a.id,"subtree")]},{bindings:[{...whole(a.id),id:randomUUID()}]}];
      for(const raw of invalid) expect(()=>f.bindings.replace(f.auth,revision,f.leaf.publicId,raw)).toThrow();
      expect(f.revision()).toBe(revision);expect(f.bindings.get(f.project.publicId,f.leaf.publicId).bindings).toEqual([]);
      expect(()=>f.bindings.replace(f.auth,revision-1,f.leaf.publicId,{bindings:[whole(a.id)]})).toThrow("REVISION_MISMATCH");
      f.db.prepare("UPDATE edit_sessions SET revoked_at=? WHERE id=?").run(stamp,f.auth.sessionId);
      expect(()=>f.bindings.replace(f.auth,revision,f.leaf.publicId,{bindings:[whole(a.id)]})).toThrow("EDIT_SESSION_REQUIRED");
      expect(f.revision()).toBe(revision);
    }finally{f.db.close();}
  });
  it("previews exact whole member impact without mutation, requires confirmation, rejects stale/changed proposal, and blocks used Target deletion",()=>{
    const f=setup();try {
      const target=f.target("A");f.bindings.replace(f.auth,f.revision(),f.summary.publicId,{bindings:[whole(target.id,"subtree")]});
      const patch={members:f.systems.map(s=>({kind:"system",entityId:s.publicId}))}, revision=f.revision();
      const impact=f.targets.previewUpdate(f.auth,revision,target.id,patch).data;
      expect(impact.affectedTaskIds.sort()).toEqual([f.child.publicId,f.summary.publicId].sort());
      expect(impact.addedEntityIds).toEqual([f.systems[1].publicId]);expect(f.revision()).toBe(revision);
      expect(f.targets.get(f.project.publicId,target.id).members).toHaveLength(1);
      expect(()=>f.targets.update(f.auth,revision,target.id,patch)).toThrow("TARGET_IMPACT_CONFIRMATION_REQUIRED");
      expect(()=>f.targets.update(f.auth,revision,target.id,{...patch,name:"changed",confirmImpact:true,impactToken:impact.impactToken})).toThrow("TARGET_IMPACT_STALE");
      f.targets.update(f.auth,revision,target.id,{...patch,confirmImpact:true,impactToken:impact.impactToken});
      expect(f.bindings.get(f.project.publicId,f.child.publicId).effective.effectiveSystemIds).toHaveLength(2);
      expect(()=>f.targets.update(f.auth,revision,target.id,{...patch,confirmImpact:true,impactToken:impact.impactToken})).toThrow("REVISION_MISMATCH");
      expect(()=>f.targets.delete(f.auth,f.revision(),target.id)).toThrow("TARGET_IN_USE");
      expect(f.targets.get(f.project.publicId,target.id).members).toHaveLength(2);
    }finally{f.db.close();}
  });
  it("blocks selected member removal and system coverage without widening or losing subset",()=>{
    const f=setup();try {
      const target=f.target("A");f.targets.update(f.auth,f.revision(),target.id,{members:f.systems.map(s=>({kind:"system",entityId:s.publicId}))});
      const member=f.targets.get(f.project.publicId,target.id).members[0],subset={targetId:target.id,selection:"subset",scope:"self",memberIds:[member.id]};
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[{...subset,coverageByMember:[{memberId:member.id,coverage:1}]}]})).toThrow("INVALID_MEMBER_COVERAGE");
      f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[subset]});
      const patch={members:[{kind:"system",entityId:f.systems[1].publicId}]},rev=f.revision();
      expect(f.targets.previewUpdate(f.auth,rev,target.id,patch).data.blockedSubsetMemberIds).toEqual([member.id]);
      expect(()=>f.targets.update(f.auth,rev,target.id,patch)).toThrow("TARGET_SUBSET_MEMBER_IN_USE");
      expect(f.revision()).toBe(rev);expect(f.bindings.get(f.project.publicId,f.leaf.publicId).bindings[0].memberIds).toEqual([member.id]);
      expect(()=>f.db.prepare("DELETE FROM logistics_target_members WHERE public_id=?").run(member.id)).toThrow();
    }finally{f.db.close();}
  });
  it("validates per-source equipment coverage, rejects shared quantity reduction in service and DB, and permits explicit correction",()=>{
    const f=setup();try {
      const {equipment,target}=equipmentTarget(f),memberId=target.members[0].id;
      const binding=(coverage:number|null)=>({targetId:target.id,selection:"subset",scope:"self",memberIds:[memberId],coverageByMember:[{memberId,coverage}]});
      for(const coverage of [0,-1,1.5,11]) expect(()=>f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[binding(coverage)]})).toThrow();
      f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[binding(8)]});
      const service=new LogisticsService(f.db,{clock:()=>now}),rev=f.revision();
      expect(()=>service.updateEquipment(f.auth,rev,equipment.publicId,{quantity:7})).toThrow();
      expect(()=>f.db.prepare("UPDATE project_equipment SET quantity=7 WHERE id=?").run(equipment.id)).toThrow("TARGET_COVERAGE_EXCEEDS_QUANTITY");
      expect(f.logistics.findEquipmentByPublicId(f.project.id,equipment.publicId)?.quantity).toBe(10);expect(f.revision()).toBe(rev);
      f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[binding(6)]});
      service.updateEquipment(f.auth,f.revision(),equipment.publicId,{quantity:7});
      expect(f.logistics.findEquipmentByPublicId(f.project.id,equipment.publicId)?.quantity).toBe(7);
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    }finally{f.db.close();}
  });
  it("rejects new inactive Target/member selections while retaining existing inactive bindings",()=>{
    const f=setup();try {
      const target=f.target("A");f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[whole(target.id)]});
      f.db.prepare("UPDATE project_logistics_systems SET active=0 WHERE id=?").run(f.systems[0].id);
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.child.publicId,{bindings:[whole(target.id)]})).toThrow("TARGET_MEMBER_INACTIVE");
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[whole(target.id)]})).not.toThrow();
      f.targets.update(f.auth,f.revision(),target.id,{active:false});
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.child.publicId,{bindings:[whole(target.id)]})).toThrow("TARGET_INACTIVE");
    }finally{f.db.close();}
  });
  it("blocks inactive reference widening or reselection but allows unchanged retention",()=>{
    const f=setup();try {
      const target=f.target("A"),memberId=target.members[0].id;
      f.bindings.replace(f.auth,f.revision(),f.summary.publicId,{bindings:[whole(target.id)]});
      f.db.prepare("UPDATE project_logistics_systems SET active=0 WHERE id=?").run(f.systems[0].id);
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.summary.publicId,
        {bindings:[whole(target.id,"subtree")]})).toThrow("TARGET_MEMBER_INACTIVE");
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.summary.publicId,
        {bindings:[{targetId:target.id,scope:"self",selection:"subset",memberIds:[memberId]}]})).toThrow("TARGET_MEMBER_INACTIVE");
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.summary.publicId,
        {bindings:[whole(target.id)]})).not.toThrow();
      f.targets.update(f.auth,f.revision(),target.id,{active:false});
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.summary.publicId,
        {bindings:[whole(target.id,"subtree")]})).toThrow("TARGET_INACTIVE");
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.summary.publicId,
        {bindings:[{targetId:target.id,scope:"self",selection:"subset",memberIds:[memberId]}]})).toThrow("TARGET_INACTIVE");
      expect(()=>f.bindings.replace(f.auth,f.revision(),f.summary.publicId,
        {bindings:[whole(target.id)]})).not.toThrow();
      expect(f.bindings.get(f.project.publicId,f.summary.publicId).bindings).toMatchObject([
        {targetId:target.id,scope:"self",selection:"whole",memberIds:[]},
      ]);
    }finally{f.db.close();}
  });
  it("enforces immutable binding ownership and whole/subset SQL transitions and preserves whole Project deletion",()=>{
    const f=setup();try {
      const target=f.target("A"),memberId=target.members[0].id;
      f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[{targetId:target.id,selection:"subset",scope:"self",memberIds:[memberId]}]});
      const binding=loadTaskTargetBindingSnapshot(f.db,f.project.id).bindings[0];
      expect(()=>f.db.prepare("UPDATE task_target_bindings SET selection='whole',anchor_member_id=NULL WHERE public_id=?").run(binding.id)).toThrow("WHOLE_MEMBERS_MUST_BE_EMPTY");
      expect(()=>f.db.prepare("UPDATE task_target_bindings SET task_id=? WHERE public_id=?").run(f.child.id,binding.id)).toThrow("TARGET_BINDING_IDENTITY_IMMUTABLE");
      expect(()=>f.db.prepare("DELETE FROM logistics_targets WHERE public_id=?").run(target.id)).toThrow();
      expect(()=>f.db.prepare("DELETE FROM projects WHERE id=?").run(f.project.id)).not.toThrow();
      expect(f.db.prepare("SELECT COUNT(*) n FROM task_target_bindings").get()).toEqual({n:0});
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    }finally{f.db.close();}
  });
  it("upgrades an actual 0026 SQLite file and reopens explicit subset/coverage without flattening inheritance",()=>{
    const directory=mkdtempSync(join(tmpdir(),"target-bindings-")),prior=join(directory,"prior"),filename=join(directory,"database.sqlite3");mkdirSync(prior);
    for(const name of readdirSync(migrationsDirectory).filter(n=>/^\d{4}_.*\.sql$/.test(n)&&Number(n.slice(0,4))<=26)) copyFileSync(join(migrationsDirectory,name),join(prior,name));
    const f=setup(filename,prior),{equipment,target}=equipmentTarget(f),projectId=f.project.id,taskId=f.leaf.publicId,memberId=target.members[0].id,revision=f.revision();f.db.close();
    const upgraded=openDatabase({filename,migrationsDirectory});
    expect(upgraded.migrations.applied).toEqual(["0027_task_target_bindings.sql","0028_process_context.sql", "0029_project_resource_memberships.sql", "0030_project_work_areas.sql"]);
    new TaskTargetBindingService(upgraded.database,{clock:()=>now}).replace(f.auth,revision,taskId,{bindings:[{targetId:target.id,selection:"subset",scope:"self",memberIds:[memberId],coverageByMember:[{memberId,coverage:4}]}]});
    upgraded.database.close();
    const reopened=openDatabase({filename,migrationsDirectory});
    try {expect(reopened.migrations.applied).toEqual([]);expect(loadTaskTargetBindingSnapshot(reopened.database,projectId).bindings[0]).toMatchObject({taskId,selection:"subset",memberIds:[memberId],coverageByMember:[{memberId,coverage:4}]});expect(new LogisticsRepository(reopened.database).findEquipmentByPublicId(projectId,equipment.publicId)?.quantity).toBe(10);expect(new LogisticsTargetService(reopened.database).get(f.project.publicId,target.id).members[0].id).toBe(memberId);}
    finally{reopened.database.close();rmSync(directory,{recursive:true,force:true});}
  });
});


describe("Issue #785 physical links and retired public boundary",()=>{
  it("serves canonical archived instance IDs over actual HTTP and preserves them after SQLite reopen",async()=>{
    const directory=mkdtempSync(join(tmpdir(),"issue785-http-")),filename=join(directory,"archive.sqlite3"),f=setup(filename);
    let active=f.db,origin="";
    const target=f.target("ARCHIVE");
    f.bindings.replace(f.auth,f.revision(),f.summary.publicId,{bindings:[whole(target.id,"subtree")]});
    const server=createServer(async(incoming,outgoing)=>{
      try {
        const request=new Request(origin+incoming.url,{method:incoming.method,headers:incoming.headers as Record<string,string>});
        const deps={projectService:new TaskFieldProjectService(active,{clock:()=>now}),applicationBaseUrl:origin,environment:"test"};
        const path=new URL(request.url).pathname;
        const response=path.endsWith("/usage")
          ?handleGetLogisticsPhysicalUsage(request,f.project.publicId,"system",f.systems[0].publicId,{...deps,database:()=>active})
          :path.endsWith("/logistics-links")
            ?await handleGetTaskLogisticsLinks(request,f.project.publicId,f.child.publicId,{...deps,logisticsService:new LogisticsService(active,{clock:()=>now})})
            :handleRetiredLogisticsRoute(request,f.project.publicId,deps);
        outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
      }catch{outgoing.writeHead(500);outgoing.end();}
    });
    try {
      await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
      origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
      const linksPath=`${origin}/api/projects/${f.project.publicId}/tasks/${f.child.publicId}/logistics-links`;
      const first=await fetch(linksPath);expect(first.status).toBe(200);const before=await first.json();
      expect(before.data.links.compatibilityLinks).toMatchObject([{entityId:f.systems[0].publicId,inherited:true,sourceTaskId:f.summary.publicId}]);
      const usage=await fetch(`${origin}/api/projects/${f.project.publicId}/logistics/systems/${f.systems[0].publicId}/usage`);
      expect(usage.status).toBe(200);expect(usage.headers.get("x-content-type-options")).toBe("nosniff");expect((await usage.json()).data.relatedTasks).toHaveLength(2);
      expect((await fetch(`${origin}/api/projects/${f.project.publicId}/logistics/targets`)).status).toBe(410);
      active.close();active=openDatabase({filename,migrationsDirectory}).database;
      const second=await fetch(linksPath);expect(second.status).toBe(200);expect(await second.json()).toEqual(before);
      expect(active.pragma("foreign_key_check")).toEqual([]);
      expect(active.prepare("SELECT count(*) count FROM task_target_bindings").get()).toEqual({count:1});
    }finally{
      await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      if(active.open)active.close();rmSync(directory,{recursive:true,force:true});
    }
  });

  it("reads every archived source and coverage without flattening, including mixed direct paths and restart",()=>{
    const directory=mkdtempSync(join(tmpdir(),"issue785-")),filename=join(directory,"archive.sqlite3");
    const f=setup(filename);
    try {
      const {equipment,target}=equipmentTarget(f),shared=f.target("SHARED");
      const memberId=target.members[0].id;
      f.bindings.replace(f.auth,f.revision(),f.summary.publicId,{bindings:[whole(shared.id,"subtree")]});
      f.bindings.replace(f.auth,f.revision(),f.child.publicId,{bindings:[whole(shared.id),{targetId:target.id,scope:"self",selection:"subset",memberIds:[memberId],coverageByMember:[{memberId,coverage:8}]}]});
      f.logistics.replaceTaskSystemLinks(f.project.id,f.child.id,[{systemId:f.systems[0].id,scope:"self"}],stamp);
      const before=f.db.prepare("SELECT * FROM task_target_bindings ORDER BY id").all();
      const members=f.db.prepare("SELECT * FROM task_target_binding_members ORDER BY binding_id,member_id").all();
      const service=new LogisticsService(f.db,{clock:()=>now});
      const links=service.getTaskLogisticsLinks(f.project.id,f.child.publicId);
      expect(links.projectRevision).toBe(f.revision());
      expect(links.effectiveEquipmentIds).toEqual([equipment.publicId]);
      expect(links.effectiveSystemIds).toEqual([f.systems[0].publicId]);
      expect(links.directSystemLinks).toHaveLength(1);
      expect(links.compatibilityLinks).toHaveLength(3);
      expect(links.compatibilityLinks!.filter(row=>row.entityId===f.systems[0].publicId).map(row=>row.inherited).sort()).toEqual([false,true]);
      expect(links.compatibilityLinks!.find(row=>row.entityId===equipment.publicId)).toMatchObject({coverage:8,coverageMode:"partial",selection:"subset",readonly:true,sourceTaskId:f.child.publicId});
      expect(JSON.stringify(links)).not.toMatch(/targetId|targetName|memberId|Target/);
      service.replaceTaskLogisticsLinks(f.auth,f.revision(),f.child.publicId,{equipmentLinks:[],systemLinks:[]});
      expect(f.db.prepare("SELECT * FROM task_target_bindings ORDER BY id").all()).toEqual(before);
      expect(f.db.prepare("SELECT * FROM task_target_binding_members ORDER BY binding_id,member_id").all()).toEqual(members);
      const after=service.getTaskLogisticsLinks(f.project.id,f.child.publicId);
      f.db.close();
      const {database:reopened}=openDatabase({filename,migrationsDirectory});
      try {
        expect(new LogisticsService(reopened,{clock:()=>now}).getTaskLogisticsLinks(f.project.id,f.child.publicId)).toEqual(after);
        expect(reopened.pragma("foreign_key_check")).toEqual([]);
      } finally {reopened.close();}
    } finally { if(f.db.open) f.db.close();rmSync(directory,{recursive:true,force:true}); }
  });
  it("provides exact physical usage for subset and inherited paths in one unchanged revision",()=>{
    const f=setup();try {
      const a=f.target("A");
      f.targets.update(f.auth,f.revision(),a.id,{members:[{kind:"system",entityId:f.systems[0].publicId},{kind:"system",entityId:f.systems[1].publicId}]});
      const updated=f.targets.get(f.project.publicId,a.id);
      const second=updated.members.find(row=>row.entityId===f.systems[1].publicId)!;
      f.bindings.replace(f.auth,f.revision(),f.summary.publicId,{bindings:[{targetId:a.id,scope:"subtree",selection:"subset",memberIds:[second.id]}]});
      const revision=f.revision();
      expect(readLogisticsPhysicalUsage(f.db,f.project.publicId,"system",f.systems[0].publicId).relatedTasks).toEqual([]);
      expect(readLogisticsPhysicalUsage(f.db,f.project.publicId,"system",f.systems[1].publicId)).toMatchObject({projectRevision:revision,directTaskCount:0,compatibilityTaskCount:2});
      expect(readLogisticsPhysicalUsage(f.db,f.project.publicId,"system",f.systems[1].publicId).relatedTasks.map(row=>row.taskId).sort()).toEqual([f.summary.publicId,f.child.publicId].sort());
      expect(f.revision()).toBe(revision);
    }finally{f.db.close();}
  });
  it("retains origin/session/strong revision failures and retires every public method without mutation",async()=>{
    const f=setup();try {
      const origin="https://gantt.example.com",cookie=`${editSessionCookieName("test",new URL(origin))}=${f.token.rawToken}`;
      const deps={projectService:new TaskFieldProjectService(f.db,{clock:()=>now}),applicationBaseUrl:origin,environment:"test"};
      const request=(method:string,headers:Record<string,string>={})=>new Request(`${origin}/api/projects/${f.project.publicId}/logistics/targets`,{method,headers});
      const revision=f.revision();
      for(const method of ["GET","POST","PUT","PATCH","DELETE"]){
        const response=handleRetiredLogisticsRoute(request(method,{Origin:origin,Cookie:cookie,"If-Match":`"${revision}"`}),f.project.publicId,deps);
        expect(response.status).toBe(410);expect((await response.json()).error.code).toBe("LOGISTICS_API_RETIRED");expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      }
      expect(handleRetiredLogisticsRoute(request("POST",{Origin:"https://evil.example",Cookie:cookie,"If-Match":'"1"'}),f.project.publicId,deps).status).toBe(403);
      expect(handleRetiredLogisticsRoute(request("POST",{Origin:origin,"If-Match":'"1"'}),f.project.publicId,deps).status).toBe(401);
      expect(handleRetiredLogisticsRoute(request("PUT",{Origin:origin,Cookie:cookie}),f.project.publicId,deps).status).toBe(428);
      expect(handleRetiredLogisticsRoute(request("PUT",{Origin:origin,Cookie:cookie,"If-Match":'"2"'}),f.project.publicId,deps).status).toBe(412);
      expect(f.revision()).toBe(revision);expect(f.db.prepare("SELECT * FROM logistics_targets").all()).toEqual([]);
    }finally{f.db.close();}
  });
  it("bounds physical usage before graph materialization and rejects malformed instance IDs without source reads",async()=>{
    const f=setup();try {
      const origin="https://gantt.example.com",projectService=new TaskFieldProjectService(f.db,{clock:()=>now});
      let sourceReads=0;
      const request=new Request(`${origin}/api/projects/${f.project.publicId}/logistics/systems/invalid/usage`);
      const malformed=handleGetLogisticsPhysicalUsage(request,f.project.publicId,"system","invalid",{projectService,database:()=>{sourceReads++;return f.db;},applicationBaseUrl:origin,environment:"test"});
      expect(malformed.status).toBe(404);expect(malformed.headers.get("x-content-type-options")).toBe("nosniff");
      expect(sourceReads).toBe(1); // the service rejects before loading any graph rows
      const insert=f.db.prepare("INSERT INTO tasks(project_id,public_id,external_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,status,parent_id,sort_order,created_at,updated_at) VALUES(?,?,?,?,'task','auto',NULL,'2026-10-14','2026-10-14',1,0,'not_started',NULL,0,?,?)");
      f.db.transaction(()=>{for(let i=0;i<4998;i++)insert.run(f.project.id,randomUUID(),`BOUND-${i}`,`Bound ${i}`,stamp,stamp);})();
      const revision=f.revision(),count=f.db.prepare("SELECT count(*) n FROM tasks").get();
      const limited=handleGetLogisticsPhysicalUsage(request,f.project.publicId,"system",f.systems[0].publicId,{projectService,database:()=>f.db,applicationBaseUrl:origin,environment:"test"});
      expect(limited.status).toBe(422);expect((await limited.json()).error.code).toBe("LOGISTICS_SOURCE_LIMIT_EXCEEDED");expect(limited.headers.get("x-content-type-options")).toBe("nosniff");
      expect(f.revision()).toBe(revision);expect(f.db.prepare("SELECT count(*) n FROM tasks").get()).toEqual(count);
    }finally{f.db.close();}
  });
  it("bounds inherited member expansion before archive resolution without truncating sources",()=>{
    const f=setup();try {
      const systems=Array.from({length:100},(_,i)=>f.logistics.insertSystem({publicId:randomUUID(),projectId:f.project.id,code:`BOUND-S-${i}`,name:`Bound system ${i}`,systemType:"mcs",layer:"coordinator",scope:"project",now:stamp}));
      const target=f.targets.create(f.auth,f.revision(),{code:"BOUND",name:"Bound",scope:"project_common",members:systems.map(row=>({kind:"system",entityId:row.publicId}))}).data.target!;
      f.bindings.replace(f.auth,f.revision(),f.summary.publicId,{bindings:[whole(target.id,"subtree")]});
      const insert=f.db.prepare("INSERT INTO tasks(project_id,public_id,external_id,name,type,schedule_mode,requested_start,start_date,end_date,duration,progress,status,parent_id,sort_order,created_at,updated_at) VALUES(?,?,?,?,'task','auto',NULL,'2026-10-14','2026-10-14',1,0,'not_started',?,0,?,?)");
      f.db.transaction(()=>{for(let i=0;i<500;i++)insert.run(f.project.id,randomUUID(),`EXPAND-${i}`,`Expansion ${i}`,f.summary.id,stamp,stamp);})();
      const revision=f.revision();
      expect(()=>readLogisticsPhysicalUsage(f.db,f.project.publicId,"system",systems[0].publicId)).toThrow("물류 연결 조회 한도를 초과");
      expect(f.revision()).toBe(revision);expect(f.db.prepare("SELECT count(*) n FROM task_target_bindings").get()).toEqual({n:1});expect(f.db.pragma("foreign_key_check")).toEqual([]);
    }finally{f.db.close();}
  });
  it.each(["missing","unselected"])("rejects a %s subset anchor with exact selected-member ownership and preserves the damaged source",async mode=>{
    const f=setup();try {
      const a=f.target("ANCHOR");
      f.targets.update(f.auth,f.revision(),a.id,{members:[{kind:"system",entityId:f.systems[0].publicId},{kind:"system",entityId:f.systems[1].publicId}]});
      const target=f.targets.get(f.project.publicId,a.id),selected=target.members[0];
      f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[{targetId:a.id,scope:"self",selection:"subset",memberIds:[selected.id]}]});
      const unselected=f.db.prepare("SELECT id FROM logistics_target_members WHERE public_id=?").get(target.members[1].id) as {id:number};
      f.db.pragma("foreign_keys=OFF");f.db.prepare("UPDATE task_target_bindings SET anchor_member_id=?").run(mode==="missing"?999999:unselected.id);f.db.pragma("foreign_keys=ON");
      expect(f.db.pragma("foreign_key_check")).toHaveLength(1);
      const before=f.db.prepare("SELECT * FROM task_target_bindings").all(),revision=f.revision();
      const response=handleGetLogisticsPhysicalUsage(new Request(`https://gantt.example.com/api/projects/${f.project.publicId}/logistics/systems/${f.systems[0].publicId}/usage`),f.project.publicId,"system",f.systems[0].publicId,{
        projectService:new TaskFieldProjectService(f.db,{clock:()=>now}),database:()=>f.db,applicationBaseUrl:"https://gantt.example.com",environment:"test",
      });
      expect(response.status).toBe(409);expect((await response.json()).error.code).toBe("LOGISTICS_SOURCE_INVALID");
      expect(()=>new LogisticsService(f.db).getTaskLogisticsLinks(f.project.id,f.leaf.publicId)).toThrow("기존 물류 연결 원본");
      expect(f.db.prepare("SELECT * FROM task_target_bindings").all()).toEqual(before);expect(f.revision()).toBe(revision);
    }finally{f.db.close();}
  });
  it("retains original process and optional WorkArea context without writing a direct Task selection",()=>{
    const f=setup();try {
      const {target}=equipmentTarget(f),areaId=randomUUID();
      const occurrence=f.db.prepare("SELECT occurrence_id id FROM logistics_targets WHERE public_id=?").get(target.id) as {id:number};
      const area=f.db.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(areaId,occurrence.id,"ARCHIVE-AREA","Original area",stamp,stamp);
      f.db.prepare("UPDATE logistics_targets SET work_area_id=? WHERE public_id=?").run(Number(area.lastInsertRowid),target.id);
      f.bindings.replace(f.auth,f.revision(),f.summary.publicId,{bindings:[whole(target.id,"subtree")]});
      const directBefore=f.db.prepare("SELECT * FROM task_process_links").all(),revision=f.revision();
      const service=new LogisticsService(f.db),link=service.getTaskLogisticsLinks(f.project.id,f.child.publicId).compatibilityLinks![0];
      expect(link.context).toMatchObject({scope:"process",process:{id:target.projectProcessId,name:"A"},workArea:{id:areaId,name:"Original area"}});
      expect(link.context!.occurrenceId).toEqual(expect.any(String));expect(link.inherited).toBe(true);
      expect(f.db.prepare("SELECT * FROM task_process_links").all()).toEqual(directBefore);expect(f.revision()).toBe(revision);
      f.db.pragma("foreign_keys=OFF");f.db.prepare("UPDATE logistics_targets SET occurrence_id=999999 WHERE public_id=?").run(target.id);f.db.pragma("foreign_keys=ON");
      expect(()=>service.getTaskLogisticsLinks(f.project.id,f.child.publicId)).toThrow("기존 물류 연결 원본");
    }finally{f.db.close();}
  });
  it("rejects malformed Task ancestry before entering direct-link ancestor traversal",()=>{
    const f=setup();try {
      f.db.prepare("UPDATE tasks SET parent_id=? WHERE id=?").run(f.child.id,f.summary.id);
      expect(()=>new LogisticsService(f.db).getTaskLogisticsLinks(f.project.id,f.child.publicId)).toThrow("기존 물류 연결 원본");
      f.db.pragma("foreign_keys=OFF");
      f.db.prepare("UPDATE tasks SET parent_id=999999 WHERE id=?").run(f.summary.id);
      expect(()=>new LogisticsService(f.db).getTaskLogisticsLinks(f.project.id,f.child.publicId)).toThrow("기존 물류 연결 원본");
    }finally{f.db.close();}
  });
  it("rejects damaged archived references instead of reporting an empty physical relation",()=>{
    const f=setup();try {
      const a=f.target("A");
      f.bindings.replace(f.auth,f.revision(),f.leaf.publicId,{bindings:[whole(a.id)]});
      f.db.pragma("foreign_keys=OFF");
      f.db.prepare("DELETE FROM tasks WHERE id=?").run(f.leaf.id);
      expect(()=>new LogisticsService(f.db).getTaskLogisticsLinks(f.project.id,f.child.publicId)).toThrow("기존 물류 연결 원본");
      const response=handleGetLogisticsPhysicalUsage(new Request(`https://gantt.example.com/api/projects/${f.project.publicId}/logistics/systems/${f.systems[0].publicId}/usage`),f.project.publicId,"system",f.systems[0].publicId,{
        projectService:new TaskFieldProjectService(f.db,{clock:()=>now}),database:()=>f.db,applicationBaseUrl:"https://gantt.example.com",environment:"test",
      });
      expect(response.status).toBe(409);expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(f.db.prepare("SELECT task_id FROM task_target_bindings").get()).toEqual({task_id:f.leaf.id});
    }finally{f.db.close();}
  });
});
