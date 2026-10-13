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
  return {db,project,auth,logistics,systems,summary,child,leaf,targets,bindings,revision,target};
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
    expect(upgraded.migrations.applied).toEqual(["0027_task_target_bindings.sql"]);
    new TaskTargetBindingService(upgraded.database,{clock:()=>now}).replace(f.auth,revision,taskId,{bindings:[{targetId:target.id,selection:"subset",scope:"self",memberIds:[memberId],coverageByMember:[{memberId,coverage:4}]}]});
    upgraded.database.close();
    const reopened=openDatabase({filename,migrationsDirectory});
    try {expect(reopened.migrations.applied).toEqual([]);expect(loadTaskTargetBindingSnapshot(reopened.database,projectId).bindings[0]).toMatchObject({taskId,selection:"subset",memberIds:[memberId],coverageByMember:[{memberId,coverage:4}]});expect(new LogisticsRepository(reopened.database).findEquipmentByPublicId(projectId,equipment.publicId)?.quantity).toBe(10);expect(new LogisticsTargetService(reopened.database).get(f.project.publicId,target.id).members[0].id).toBe(memberId);}
    finally{reopened.database.close();rmSync(directory,{recursive:true,force:true});}
  });
});
