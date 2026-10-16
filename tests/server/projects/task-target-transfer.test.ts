import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { TaskHierarchyService } from "../../../src/server/projects/task-hierarchy-service-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { ScheduleRepository } from "../../../src/server/repositories/schedule-repository-core";
import { LogisticsTargetService } from "../../../src/server/logistics/logistics-targets-service-core";
import { TaskTargetBindingService, loadTaskTargetBindingSnapshot } from "../../../src/server/logistics/task-target-bindings-service-core";
import { resolveAllTaskTargetBindings } from "../../../src/domain/logistics/task-target-bindings";
import { PublicApiError } from "../../../src/server/http/api-error-core";
import { ProjectImportService } from "../../../src/server/imports/project-import-service-core";
import { ProjectJsonExportService } from "../../../src/server/exports/project-json-export-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { parseProjectImportBytes } from "../../../src/server/imports/project-import-parser-core";

const migrationsDirectory=join(process.cwd(),"db/migrations");
const now=new Date("2026-10-14T01:00:00.000Z"),stamp=now.toISOString();
const hashPassword=async()=>({algorithm:"scrypt" as const,salt:Buffer.alloc(16,1),hash:Buffer.alloc(32,2),n:32768,r:8,p:3,keyLength:32});
async function fixture(filename=":memory:") {
  const db=openDatabase({filename,migrationsDirectory}).database;
  const projects=new ProjectService(db,{clock:()=>now,hashPassword});
  const created=await projects.create({name:"Binding transfer",description:"",editPassword:"password123"});
  const publicId=created.response.data.project.publicId;
  const result=projects.authorize(publicId,created.rawSessionToken);
  if(result.kind!=="authorized")throw Error("auth");
  const auth=result.authorization, pid=auth.projectId;
  const schedules=new ScheduleRepository(db);
  const insert=(externalId:string,type:"task"|"summary"|"milestone",parentId:number|null,sortOrder:number)=>schedules.insertTask({
    projectId:pid,externalId,publicId:randomUUID(),name:externalId,type,scheduleMode:"auto",
    requestedStart:type==="summary"?null:"2026-10-14",startDate:"2026-10-14",endDate:"2026-10-14",duration:type==="milestone"?0:1,progress:0,
    parentId,sortOrder,createdAt:stamp,updatedAt:stamp,
  });
  const a=insert("A","summary",null,0), task=insert("T","task",a.id,0), other=insert("U","task",a.id,1);
  const b=insert("B","summary",null,1), bChild=insert("V","task",b.id,0), milestone=insert("M","milestone",null,2);
  const logistics=new LogisticsRepository(db);
  const system=logistics.insertSystem({projectId:pid,publicId:randomUUID(),code:"MCS",name:"Shared",systemType:"mcs",layer:"coordinator",scope:"project",now:stamp});
  const revision=()=>Number(db.prepare("SELECT revision FROM projects WHERE id=?").pluck().get(pid));
  const targets=new LogisticsTargetService(db,{clock:()=>now});
  const createTarget=(code:string)=>targets.create(auth,revision(),{code,name:code,scope:"project_common",projectProcessId:null,workAreaId:null,members:[{kind:"system",entityId:system.publicId}]}).data.target!;
  const ta=createTarget("TA"),tb=createTarget("TB");
  const bindings=new TaskTargetBindingService(db,{clock:()=>now});
  bindings.replace(auth,revision(),a.publicId,{bindings:[{targetId:ta.id,scope:"subtree",selection:"whole",memberIds:[]}]});
  bindings.replace(auth,revision(),task.publicId,{bindings:[{targetId:tb.id,scope:"self",selection:"subset",memberIds:[tb.members[0].id]}]});
  logistics.replaceTaskSystemLinks(pid,task.id,[{systemId:system.id,scope:"self"}],stamp);
  db.prepare("INSERT INTO task_milestone_memberships(project_id,member_task_id,milestone_task_id) VALUES(?,?,?)").run(pid,task.id,milestone.id);
  return {db,projects,auth,pid,publicId,revision,token:created.rawSessionToken,a,b,task,other,bChild,milestone,ta,tb,system};
}

describe("Issue #617 explicit binding transfer and hierarchy",()=>{
  it("previews all descendant Target provenance, preserves identities, rejects stale confirmation atomically",async()=>{
    const f=await fixture();
    try {
      const hierarchy=new TaskHierarchyService(f.db,{clock:()=>now});
      const command={kind:"reparent" as const,taskId:f.task.publicId,anchorTaskId:f.b.publicId,placement:"child" as const};
      const oldRevision=f.revision(),before=loadTaskTargetBindingSnapshot(f.db,f.pid);
      let error:unknown;
      try{hierarchy.execute(f.auth,oldRevision,command);}catch(value){error=value;}
      expect(error).toBeInstanceOf(PublicApiError);
      const preview=error as PublicApiError;
      expect(preview.code).toBe("TASK_TARGET_IMPACT_REVIEW_REQUIRED");
      const digest=preview.details.find(d=>d.path==="targetImpactDigest")!.message;
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
      expect(f.revision()).toBe(oldRevision);
      expect(loadTaskTargetBindingSnapshot(f.db,f.pid)).toEqual(before);
      expect(()=>hierarchy.execute(f.auth,oldRevision,{...command,targetImpactDigest:"0".repeat(64)})).toThrow(PublicApiError);
      const moved=hierarchy.execute(f.auth,oldRevision,{...command,targetImpactDigest:digest});
      expect(moved.data.tasks.find(t=>t.taskId===f.task.publicId)?.parentExternalId).toBe("B");
      const after=loadTaskTargetBindingSnapshot(f.db,f.pid);
      expect(after.bindings).toEqual(before.bindings);
      expect(resolveAllTaskTargetBindings(after).get(f.task.publicId)?.effectiveTargetIds).toEqual([f.tb.id]);
      expect(()=>hierarchy.execute(f.auth,oldRevision,{...command,targetImpactDigest:digest})).toThrow();
      expect(f.db.prepare("SELECT milestone_task_id FROM task_milestone_memberships WHERE member_task_id=?").pluck().get(f.task.id)).toBe(f.milestone.id);
    }finally{f.db.close();}
  });

  it("requires confirmation for every affected descendant even when instance IDs stay equal",async()=>{
    const f=await fixture();
    try {
      new TaskTargetBindingService(f.db,{clock:()=>now}).replace(f.auth,f.revision(),f.b.publicId,{bindings:[{targetId:f.tb.id,scope:"subtree",selection:"whole",memberIds:[]}]});
      const command={kind:"reparent" as const,taskId:f.a.publicId,anchorTaskId:f.b.publicId,placement:"child" as const};
      const hierarchy=new TaskHierarchyService(f.db,{clock:()=>now}),revision=f.revision();
      let error:unknown;
      try{hierarchy.execute(f.auth,revision,command);}catch(value){error=value;}
      const preview=error as PublicApiError;
      expect(preview.code).toBe("TASK_TARGET_IMPACT_REVIEW_REQUIRED");
      const affected=preview.details.filter(d=>d.code==="TASK_TARGET_IMPACT").map(d=>JSON.parse(d.message).taskId);
      expect(new Set(affected)).toEqual(new Set([f.a.publicId,f.task.publicId,f.other.publicId]));
      const digest=preview.details.find(d=>d.path==="targetImpactDigest")!.message;
      hierarchy.execute(f.auth,revision,{...command,targetImpactDigest:digest});
      expect(resolveAllTaskTargetBindings(loadTaskTargetBindingSnapshot(f.db,f.pid)).get(f.task.publicId)?.effectiveSystemIds).toEqual([f.system.publicId]);
    }finally{f.db.close();}
  });

  it("appends supported import Tasks without dropping destination bindings or authoring new bindings",async()=>{
    const f=await fixture();
    try {
      const before=loadTaskTargetBindingSnapshot(f.db,f.pid);
      const service=new ProjectImportService(f.db,{clock:()=>now,projectService:f.projects});
      const file=new TextEncoder().encode(JSON.stringify({schemaVersion:"1.1",project:{name:"Append",description:""},tasks:[{
        externalId:"APPEND",name:"Append",type:"task",parentExternalId:null,requestedStart:"2026-10-14",duration:1,progress:0,status:"not_started",predecessors:[],
      }]}));
      const preview=service.preview(f.publicId,f.token,file);
      service.commit(f.publicId,f.token,preview.baseRevision,preview.previewDigest,file);
      const after=loadTaskTargetBindingSnapshot(f.db,f.pid);
      expect(after.bindings).toEqual(before.bindings);
      expect(after.tasks).toHaveLength(before.tasks.length+1);
    }finally{f.db.close();}
  });

  it("copies only explicit rows with new IDs and keeps legacy instance links and original WBS",async()=>{
    const f=await fixture();
    try {
      const original=loadTaskTargetBindingSnapshot(f.db,f.pid);
      const copied=new TaskHierarchyService(f.db,{clock:()=>now}).execute(f.auth,f.revision(),{
        kind:"copy",taskId:f.task.publicId,anchorTaskId:f.b.publicId,placement:"child",acknowledgedMembershipExclusions:true,
      });
      const newTask=copied.data.tasks.find(t=>t.taskId!==f.task.publicId && t.name==="T")!;
      const after=loadTaskTargetBindingSnapshot(f.db,f.pid),binding=after.bindings.find(b=>b.taskId===newTask.taskId)!;
      expect(binding.id).not.toBe(original.bindings.find(b=>b.taskId===f.task.publicId)!.id);
      expect(binding.targetId).toBe(f.tb.id);
      expect(binding.memberIds).toEqual([f.tb.members[0].id]);
      expect(after.bindings.filter(b=>b.taskId===newTask.taskId)).toHaveLength(1);
      expect(resolveAllTaskTargetBindings(after).get(newTask.taskId)?.effectiveTargetIds).toEqual([f.tb.id]);
      expect(after.legacy.find(l=>l.taskId===newTask.taskId)?.entityId).toBe(f.system.publicId);
      expect(copied.data.tasks.find(t=>t.taskId===f.task.publicId)?.parentExternalId).toBe("A");
    }finally{f.db.close();}
  });

  it("remaps Project Copy and v3 Template once and persists explicit/inherited distinction across restart",async()=>{
    const directory=mkdtempSync(join(tmpdir(),"mastergantt-bindings-")),filename=join(directory,"test.sqlite3");
    const f=await fixture(filename);
    let closed=false;
    try {
      const copy=await new ProjectCopyService(f.db,{clock:()=>now,hashPassword}).copy(f.auth,f.revision(),{name:"Copy",description:"",editPassword:"password123"});
      const templates=new ProjectTemplateService(f.db,{clock:()=>now,hashPassword});
      const template=templates.createTemplateFromProject(f.auth,f.revision(),{name:"Bindings"});
      const saved=JSON.parse(f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").pluck().get(template.id) as string);
      expect(saved.logistics.schemaVersion).toBe(3);
      expect(saved.logistics.taskTargetBindings).toHaveLength(2);
      const instantiated=await templates.instantiateProject(template.id,{name:"Template",ownerName:"Owner",editPassword:"password123",projectStartDate:"2026-10-14"});
      const publicIds=[copy.response.data.project.publicId,instantiated.response.data.project.publicId];
      const source=loadTaskTargetBindingSnapshot(f.db,f.pid);
      f.db.close();closed=true;
      const restarted=openDatabase({filename,migrationsDirectory}).database;
      try {
        for(const publicId of publicIds) {
          const pid=Number(restarted.prepare("SELECT id FROM projects WHERE public_id=?").pluck().get(publicId));
          const snapshot=loadTaskTargetBindingSnapshot(restarted,pid),resolved=resolveAllTaskTargetBindings(snapshot);
          expect(snapshot.bindings).toHaveLength(2);
          expect(snapshot.bindings.every(b=>!source.bindings.some(s=>s.id===b.id))).toBe(true);
          expect(snapshot.targets.every(t=>!source.targets.some(s=>s.id===t.id))).toBe(true);
          expect(new Set(snapshot.targets.flatMap(t=>t.members.map(m=>m.entityId))).size).toBe(1);
          expect(new Set(snapshot.targets.flatMap(t=>t.members.map(m=>m.id))).size).toBe(2);
          const inherited=[...resolved.values()].find(t=>t.inheritedBindings.length && !t.bindings.length)!;
          expect(inherited.effectiveTargetIds).toHaveLength(1);
          expect(restarted.prepare("SELECT COUNT(*) FROM task_milestone_memberships WHERE project_id=?").pluck().get(pid)).toBe(1);
        }
        expect(restarted.pragma("foreign_key_check")).toEqual([]);
      }finally{restarted.close();}
    }finally{if(!closed)f.db.close();rmSync(directory,{recursive:true,force:true});}
  });

  it("rolls back malformed v3 and forward bindings hidden inside a v2 Template",async()=>{
    const f=await fixture();
    try {
      const templates=new ProjectTemplateService(f.db,{clock:()=>now,hashPassword});
      const template=templates.createTemplateFromProject(f.auth,f.revision(),{name:"Strict bindings"});
      const original=f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").pluck().get(template.id) as string;
      const count=f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get();
      for(const mutate of [
        (saved: ReturnType<typeof JSON.parse>)=>{saved.logistics.schemaVersion=2;},
        (saved: ReturnType<typeof JSON.parse>)=>{saved.logistics.taskTargetBindings.find((b:{selection:string})=>b.selection==="subset").members=[];},
        (saved: ReturnType<typeof JSON.parse>)=>{saved.logistics.taskTargetBindings[0].targetCode="UNKNOWN";},
        (saved: ReturnType<typeof JSON.parse>)=>{saved.logistics.taskTargetBindings.find((b:{selection:string})=>b.selection==="subset").members[0].kind="equipment";},
        (saved: ReturnType<typeof JSON.parse>)=>{saved.logistics.taskTargetBindings.find((b:{selection:string})=>b.selection==="subset").members[0].coverage=1;},
      ]) {
        const saved=JSON.parse(original); mutate(saved);
        f.db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?").run(JSON.stringify(saved),template.id);
        await expect(templates.instantiateProject(template.id,{name:"Rejected",ownerName:"Owner",editPassword:"password123",projectStartDate:"2026-10-14"})).rejects.toThrow();
        expect(f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get()).toBe(count);
        expect(f.db.pragma("foreign_key_check")).toEqual([]);
      }
    }finally{f.db.close();}
  });

  it("rejects lossy schedule formats and Milestone conversion with bindings",async()=>{
    const f=await fixture();
    try {
      expect(()=>new ProjectJsonExportService(f.db,{clock:()=>now}).get(f.publicId,f.revision())).toThrow(expect.objectContaining({code:"TASK_TARGET_EXPORT_UNSUPPORTED"}));
      expect(()=>new ProjectExportSnapshotService(f.db,{clock:()=>now}).get(f.publicId,false,undefined,f.revision())).toThrow(expect.objectContaining({code:"TASK_TARGET_EXPORT_UNSUPPORTED"}));
      expect(()=>parseProjectImportBytes(new TextEncoder().encode(JSON.stringify({schemaVersion:"1.1",tasks:[{targetBindings:[]}]})))).toThrow(expect.objectContaining({code:"TARGET_BINDING_IMPORT_UNSUPPORTED"}));
      expect(()=>new TaskHierarchyService(f.db,{clock:()=>now}).execute(f.auth,f.revision(),{kind:"convert",taskId:f.task.publicId,targetType:"milestone"})).toThrow(expect.objectContaining({code:"TARGET_BINDING_TYPE_CONFLICT"}));
    }finally{f.db.close();}
  });
});
