import { ResourceDashboardService } from "../../../src/server/resources/resource-dashboard-service-core";
import { TaskHierarchyService } from "../../../src/server/projects/task-hierarchy-service-core";
import { ProjectCopyService } from "../../../src/server/projects/project-copy-service-core";
import { ProcessContextRepository } from "../../../src/server/repositories/process-context-repository-core";
import { snapshotProjectContexts } from "../../../src/server/logistics/project-context-transfer-core";
import { ProjectJsonExportService } from "../../../src/server/exports/project-json-export-core";
import { ProjectExportSnapshotService } from "../../../src/server/exports/project-export-snapshot-service-core";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectService } from "../../../src/server/projects/project-service-core";
import { ProjectTemplateService } from "../../../src/server/templates/project-template-service-core";
import { LogisticsTargetService } from "../../../src/server/logistics/logistics-targets-service-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { ProjectMasterRepository } from "../../../src/server/repositories/project-master-repository-core";
import { ProjectRepository } from "../../../src/server/repositories/project-repository-core";
import { ProcessCatalogRepository } from "../../../src/server/repositories/process-catalog-repository-core";
import { hashSessionToken } from "../../../src/server/security/session-core";

const migrationsDirectory=join(process.cwd(),"db/migrations");
const now=new Date("2026-10-12T01:00:00.000Z");
const stamp=now.toISOString();
const password=async()=>({
  algorithm:"scrypt" as const,salt:Buffer.alloc(16,1),hash:Buffer.alloc(32,2),
  n:32768,r:8,p:3,keyLength:32,
});

async function fixture(filename = ":memory:") {
  const {database:db}=openDatabase({filename,migrationsDirectory});
  const projectService=new ProjectService(db,{
    clock:()=>now,hashPassword:password,
    generateSessionToken:()=>({rawToken:"src-token",tokenHash:hashSessionToken("src-token")}),
  });
  const created=await projectService.create({name:"Target source",description:"",editPassword:"password123"});
  const sourceId=created.response.data.project.publicId;
  const project=(db.prepare("SELECT id FROM projects WHERE public_id=?").get(sourceId) as {id:number}).id;
  const authorization=projectService.authorize(sourceId,"src-token");
  if(authorization.kind!=="authorized")throw Error("Source authorization failed");

  const masters=new ProjectMasterRepository(db);
  const item=(category:"BUSINESS_UNIT"|"PRODUCT"|"SITE_ENTITY",code:string)=>
    masters.insertItem({publicId:randomUUID(),category,code,name:code,active:true,sortOrder:0,now:stamp});
  const bu=item("BUSINESS_UNIT","BU");
  const product=item("PRODUCT","PRODUCT");
  const site=item("SITE_ENTITY","SITE");
  db.prepare("INSERT INTO business_unit_products(business_unit_id,product_id) VALUES(?,?)")
    .run(bu.id,product.id);
  db.prepare("INSERT INTO business_unit_product_sites(business_unit_id,product_id,site_entity_id) VALUES(?,?,?)")
    .run(bu.id,product.id,site.id);
  db.prepare("UPDATE projects SET business_unit_id=?,product_id=?,site_entity_id=? WHERE id=?")
    .run(bu.id,product.id,site.id,project);

  const logistics=new LogisticsRepository(db);
  const pA=logistics.insertProcess({publicId:randomUUID(),projectId:project,
    code:"PROC-A",name:"Assembly",parentId:null,active:1,now:stamp});
  const pB=logistics.insertProcess({publicId:randomUUID(),projectId:project,
    code:"PROC-B",name:"Inspection",parentId:null,active:1,now:stamp});
  const typeId=Number(db.prepare(
    "INSERT INTO process_types(public_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?)",
  ).run(randomUUID(),"TYPE","Process",stamp,stamp).lastInsertRowid);
  const occurrence=(code:string,processId:number)=>{
    const publicId=randomUUID();
    const id=Number(db.prepare(
      "INSERT INTO site_product_processes(public_id,business_unit_id,product_id,site_entity_id,process_type_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(publicId,bu.id,product.id,site.id,typeId,code,code,stamp,stamp).lastInsertRowid);
    return {id,publicId,processId};
  };
  const occA=occurrence("ASSEMBLY",pA.id),occB=occurrence("INSPECT",pB.id);
  const areaPublicId=randomUUID();
  db.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)")
    .run(areaPublicId,occA.id,"WA-A","Area A",stamp,stamp);
  const catalog=new ProcessCatalogRepository(db);
  for(const occ of [occA,occB]) {
    catalog.setMapping(project,occ.processId,catalog.find("occurrences",occ.publicId)!,null,stamp);
  }
  const eqA=logistics.insertEquipment({publicId:randomUUID(),projectId:project,processId:pA.id,
    code:"AMR-A",name:"Fork AMR A",equipmentType:"amr",managementUnit:"fleet",quantity:10,now:stamp});
  const eqB=logistics.insertEquipment({publicId:randomUUID(),projectId:project,processId:pB.id,
    code:"AMR-B",name:"Fork AMR B",equipmentType:"amr",managementUnit:"fleet",quantity:5,now:stamp});
  const system=(code:string,type:"acs"|"mcs",scope:"processes"|"project",layer:"controller"|"coordinator")=>
    logistics.insertSystem({publicId:randomUUID(),projectId:project,code,name:code,
      systemType:type,scope,layer,now:stamp});
  const acsA=system("ACS-A","acs","processes","controller");
  const acsB=system("ACS-B","acs","processes","controller");
  const mcs=system("MCS1","mcs","project","coordinator");
  logistics.setSystemProcesses(project,acsA.id,[pA.id],stamp);
  logistics.setSystemProcesses(project,acsB.id,[pB.id],stamp);
  logistics.setEquipmentSystems(project,eqA.id,[{systemId:acsA.id,controlRole:"primary"}],stamp);
  logistics.setEquipmentSystems(project,eqB.id,[{systemId:acsB.id,controlRole:"primary"}],stamp);
  logistics.setCoordinatedSystems(project,mcs.id,[acsA.id,acsB.id],stamp);

  const targetService=new LogisticsTargetService(db,{clock:()=>now});
  const projectRevision=()=>new ProjectRepository(db).findByPublicId(sourceId)!.revision;
  const make=(code:string,processId:string|null,workAreaId:string|null,members:Array<{kind:"system"|"equipment";entityId:string}>)=>
    targetService.create(authorization.authorization,projectRevision(),{
      code,name:code,scope:processId===null?"project_common":"process",
      projectProcessId:processId,workAreaId,members,
    }).data.target!;
  const a=make("TARGET-A",pA.publicId,areaPublicId,[
    {kind:"equipment",entityId:eqA.publicId},{kind:"system",entityId:acsA.publicId},{kind:"system",entityId:mcs.publicId}]);
  const b=make("TARGET-B",pB.publicId,null,[
    {kind:"equipment",entityId:eqB.publicId},{kind:"system",entityId:acsB.publicId},{kind:"system",entityId:mcs.publicId}]);
  const common=make("TARGET-COMMON",null,null,[{kind:"system",entityId:mcs.publicId}]);
  const templates=new ProjectTemplateService(db,{
    clock:()=>now,hashPassword:password,
    generateSessionToken:()=>({rawToken:"template-token",tokenHash:hashSessionToken("template-token")}),
  });
  return {db,project,sourceId,authorization:authorization.authorization,
    projectRevision,templates,targets:[a,b,common],catalog,areaPublicId,
    occA,occB,mcs,pA,pB,eqA,eqB,projectService};
}

describe("Issue #616 versioned Template Target/member graph",()=>{
  it("roundtrips two process Targets and common MCS while preserving distinct local IDs",async()=>{
    const f=await fixture();
    try {
      const template=f.templates.createTemplateFromProject(
        f.authorization,f.projectRevision(),{name:"F2 template"});
      const saved=(f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?")
        .get(template.id) as {content_json:string});
      const payload=JSON.parse(saved.content_json);
      expect(payload.logistics.schemaVersion).toBe(2);
      expect(payload.logistics.processMappings).toHaveLength(2);
      expect(payload.logistics.targets).toHaveLength(3);
      expect(payload.logistics.targets.find((t:{code:string})=>t.code==="TARGET-A").workAreaId)
        .toBe(f.areaPublicId);
      const {response}=await f.templates.instantiateProject(template.id,{
        name:"Installed from Template",ownerName:"Owner",editPassword:"password123",
        projectStartDate:"2026-10-12",
      });
      const projectId=response.data.project.publicId;
      const copied=(f.db.prepare("SELECT id FROM projects WHERE public_id=?")
        .get(projectId) as {id:number}).id;
      const targets=new LogisticsTargetService(f.db).list(projectId,{limit:20}).targets;
      expect(targets).toHaveLength(3);
      expect(response.data.operation.counts.targets).toBe(3);
      expect(response.data.operation.counts.processMappings).toBe(2);
      const A=targets.find(t=>t.code==="TARGET-A")!;
      const B=targets.find(t=>t.code==="TARGET-B")!;
      const C=targets.find(t=>t.code==="TARGET-COMMON")!;
      expect(A.workAreaId).toBe(f.areaPublicId);
      expect(B.workAreaId).toBeNull();
      expect(C.scope).toBe("project_common");
      const shared=targets.flatMap(t=>t.members).filter(m=>m.code==="MCS1");
      expect(shared).toHaveLength(3);
      expect(new Set(shared.map(m=>m.entityId)).size).toBe(1);
      expect(shared[0].entityId).not.toBe(f.mcs.publicId);
      expect(new Set(shared.map(m=>m.id)).size).toBe(3);
      expect(targets.flatMap(t=>t.members).filter(m=>m.kind==="equipment")
        .reduce((sum,m)=>sum+m.quantity,0)).toBe(15);
      expect(f.db.prepare("SELECT COUNT(*) count FROM project_logistics_systems WHERE project_id=?")
        .get(copied)).toEqual({count:3});
      const mappings=new ProcessCatalogRepository(f.db).rawMappings(copied);
      expect(mappings).toHaveLength(2);
      expect(mappings.map(m=>m.occurrence_id).sort()).toEqual([f.occA.id,f.occB.id].sort());
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    }finally{f.db.close();}
  });

  it("rejects missing, duplicate and cross-occurrence members without creating a partial Project",async()=>{
    const f=await fixture();
    try{
      const template=f.templates.createTemplateFromProject(
        f.authorization,f.projectRevision(),{name:"Tamper-protected"});
      const content=(f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?")
        .get(template.id) as {content_json:string}).content_json;
      const original=JSON.parse(content);
      const before=(f.db.prepare("SELECT COUNT(*) count FROM projects").get() as {count:number}).count;
      const verify=async(p:unknown)=>{
        f.db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?")
          .run(JSON.stringify(p),template.id);
        await expect(f.templates.instantiateProject(template.id,{
          name:"Must rollback",ownerName:"Owner",editPassword:"password123",
          projectStartDate:"2026-10-12",
        })).rejects.toThrow();
        expect(f.db.prepare("SELECT COUNT(*) count FROM projects").get()).toEqual({count:before});
        expect(f.db.pragma("foreign_key_check")).toEqual([]);
      };
      const missing=structuredClone(original);
      missing.logistics.targets[0].members[0].instanceCode="NON-EXISTENT";
      await verify(missing);
      const duplicate=structuredClone(original);
      duplicate.logistics.targets[0].members.push({...duplicate.logistics.targets[0].members[0]});
      await verify(duplicate);
      const wrongArea=structuredClone(original);
      wrongArea.logistics.targets[1].workAreaId=f.areaPublicId;
      await verify(wrongArea);
      const unsupported=structuredClone(original);
      unsupported.logistics.schemaVersion=3;
      await verify(unsupported);
    }finally{f.db.close();}
  });

  it("supports old Template logistics snapshots that did not carry the F2 graph",async()=>{
    const f=await fixture();
    try {
      const template=f.templates.createTemplateFromProject(
        f.authorization,f.projectRevision(),{name:"Legacy"});
      const saved=(f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?")
        .get(template.id) as {content_json:string}).content_json;
      const legacy=JSON.parse(saved);
      delete legacy.logistics.schemaVersion;
      delete legacy.logistics.processMappings;
      delete legacy.logistics.targets;
      f.db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?")
        .run(JSON.stringify(legacy),template.id);
      const {response}=await f.templates.instantiateProject(template.id,{
        name:"Legacy clone",ownerName:"Owner",editPassword:"password123",
        projectStartDate:"2026-10-12",
      });
      const targetRows=new LogisticsTargetService(f.db).list(response.data.project.publicId).targets;
      expect(targetRows).toEqual([]);
      expect(response.data.operation.counts.targets).toBe(0);
    }finally{f.db.close();}
  });
});


describe("Issue #725 Copy/Template process context preservation",()=>{
  async function contextFixture() {
    const f=await fixture();
    const add=(name:string,type:"summary"|"task"="task")=>f.projectService.createTask(f.authorization,f.projectRevision(),
      type==="summary"?{name,externalId:name,type}:{name,externalId:name,type,start:"2026-10-12",duration:1,progress:0}).data.tasks.find(t=>t.externalId===name)!;
    const root=add("Root","summary"),empty=add("Explicit-empty"),legacy=add("Legacy-null");
    const repository=new ProcessContextRepository(f.db);
    repository.replaceEquipment(f.project,f.eqB.id,repository.validateEquipmentWorkAreas(f.project,[{processId:f.pA.publicId,workAreaId:f.areaPublicId}]));
    const id=(publicId:string)=>(f.db.prepare("SELECT id FROM tasks WHERE public_id=?").get(publicId) as {id:number}).id;
    repository.replaceTask(f.project,id(root.taskId),repository.validateTaskContext(f.project,id(root.taskId),{
      processLinks:[{processId:f.pA.publicId,scope:"subtree"},{processId:f.pB.publicId,scope:"self"}],
      workAreaLinks:[{processId:f.pA.publicId,workAreaId:f.areaPublicId,scope:"subtree"}],
    }));
    repository.replaceTask(f.project,id(empty.taskId),{processLinks:[],workAreaLinks:[]});
    return {...f,root,empty,legacy,repository};
  }
  it.each(["copy","template"])("preserves W1 cross-process locations, scoped W2 context and null/empty with %s",async(method)=>{
    const f=await contextFixture();
    try {
      const before=snapshotProjectContexts(f.db,f.project);
      let targetPublicId:string;
      if(method==="copy") {
        const copied=await new ProjectCopyService(f.db,{hashPassword:password,clock:()=>now}).copy(f.authorization,f.projectRevision(),{name:"Copy",description:"",editPassword:"password123",resetProgress:false});
        targetPublicId=copied.response.data.project.publicId;
      }else{
        const saved=f.templates.createTemplateFromProject(f.authorization,f.projectRevision(),{name:"Context v4"});
        const payload=JSON.parse((f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").get(saved.id) as {content_json:string}).content_json);
        expect(payload.logistics.schemaVersion).toBe(4);
        expect(payload.logistics.taskTargetBindings).toEqual([]);
        expect(payload.logistics.equipmentWorkAreas).toEqual([{equipmentCode:"AMR-B",workAreaLinks:[{processCode:"PROC-A",workAreaId:f.areaPublicId}]}]);
        expect(payload.logistics.taskContexts.find((t:{taskExternalId:string})=>t.taskExternalId==="Explicit-empty")).toMatchObject({processLinks:[],workAreaLinks:[]});
        targetPublicId=(await f.templates.instantiateProject(saved.id,{name:"Installed",ownerName:"Owner",editPassword:"password123",projectStartDate:"2026-10-12"})).response.data.project.publicId;
      }
      const projectId=(f.db.prepare("SELECT id FROM projects WHERE public_id=?").get(targetPublicId) as {id:number}).id;
      expect(snapshotProjectContexts(f.db,projectId)).toEqual(before);
      const targetContexts=f.repository.taskContexts(projectId);
      const byExternal=new Map((f.db.prepare("SELECT public_id,external_id FROM tasks WHERE project_id=?").all(projectId) as {public_id:string;external_id:string}[]).map(t=>[t.external_id,t.public_id]));
      expect(targetContexts.find(t=>t.taskId===byExternal.get("Legacy-null"))).toMatchObject({processLinks:null,workAreaLinks:null});
      expect(targetContexts.find(t=>t.taskId===byExternal.get("Explicit-empty"))).toMatchObject({processLinks:[],workAreaLinks:[]});
      expect(byExternal.get("Root")).not.toBe(f.root.taskId);
      expect(snapshotProjectContexts(f.db,f.project)).toEqual(before);
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    }finally{f.db.close();}
  });
  it.each(["copy","template"])("preserves one quantity-10 fleet serving two process-owned WorkAreas through %s and SQLite reopen",async(method)=>{
    const directory=mkdtempSync(join(tmpdir(),"mastergantt-725-w1-"));
    const filename=join(directory,"project.sqlite3");
    const f=await fixture(filename);
    try {
      const areaB=randomUUID();
      f.db.prepare("INSERT INTO work_areas(public_id,occurrence_id,code,name,created_at,updated_at) VALUES(?,?,?,?,?,?)")
        .run(areaB,f.occB.id,"WA-B","Inspection area B",stamp,stamp);
      const repository=new ProcessContextRepository(f.db);
      repository.replaceEquipment(f.project,f.eqA.id,repository.validateEquipmentWorkAreas(f.project,[
        {processId:f.pA.publicId,workAreaId:f.areaPublicId},
        {processId:f.pB.publicId,workAreaId:areaB},
      ]));
      const before=snapshotProjectContexts(f.db,f.project);
      expect(before.equipmentWorkAreas).toEqual([{equipmentCode:"AMR-A",workAreaLinks:[
        {processCode:"PROC-A",workAreaId:f.areaPublicId},
        {processCode:"PROC-B",workAreaId:areaB},
      ]}]);
      const target=method==="copy"
        ? (await new ProjectCopyService(f.db,{hashPassword:password,clock:()=>now}).copy(f.authorization,f.projectRevision(),{name:"Two-area copy",description:"",editPassword:"password123",resetProgress:false})).response.data.project.publicId
        : (await f.templates.instantiateProject(f.templates.createTemplateFromProject(f.authorization,f.projectRevision(),{name:"Two-area template"}).id,{name:"Two-area installed",ownerName:"Owner",editPassword:"password123",projectStartDate:"2026-10-12"})).response.data.project.publicId;
      const targetId=(f.db.prepare("SELECT id FROM projects WHERE public_id=?").get(target) as {id:number}).id;
      const check=(db:typeof f.db)=>{
        for(const projectId of [f.project,targetId]){
          const fleet=db.prepare("SELECT id,public_id,quantity,management_unit FROM project_equipment WHERE project_id=? AND code='AMR-A'").all(projectId) as {id:number;public_id:string;quantity:number;management_unit:string}[];
          expect(fleet).toHaveLength(1);
          expect(fleet[0]).toMatchObject({quantity:10,management_unit:"fleet"});
          const links=new ProcessContextRepository(db).equipmentLinks(projectId).filter(link=>link.equipmentId===fleet[0].public_id);
          expect(links).toHaveLength(2);
          expect(new Set(links.map(link=>link.workAreaId))).toEqual(new Set([f.areaPublicId,areaB]));
          expect(snapshotProjectContexts(db,projectId)).toEqual(before);
          if(projectId===targetId) expect(fleet[0].public_id).not.toBe(f.eqA.publicId);
        }
        expect(db.pragma("foreign_key_check")).toEqual([]);
      };
      check(f.db);
      f.db.close();
      const reopened=openDatabase({filename,migrationsDirectory}).database;
      try{check(reopened);}finally{reopened.close();}
    }finally{if(f.db.open)f.db.close();rmSync(directory,{recursive:true,force:true});}
  });
  it.each(["copy","template"])("retains inactive original references with %s",async(method)=>{
    const f=await contextFixture();
    try {
      const before=snapshotProjectContexts(f.db,f.project);
      f.db.prepare("UPDATE project_processes SET active=0 WHERE id=?").run(f.pA.id);
      f.db.prepare("UPDATE work_areas SET active=0 WHERE public_id=?").run(f.areaPublicId);
      const target=method==="copy"
        ? (await new ProjectCopyService(f.db,{hashPassword:password,clock:()=>now}).copy(f.authorization,f.projectRevision(),{name:"Inactive copy",description:"",editPassword:"password123",resetProgress:false})).response.data.project.publicId
        : (await f.templates.instantiateProject(f.templates.createTemplateFromProject(f.authorization,f.projectRevision(),{name:"Inactive v4"}).id,{name:"Inactive installed",ownerName:"Owner",editPassword:"password123",projectStartDate:"2026-10-12"})).response.data.project.publicId;
      const targetId=(f.db.prepare("SELECT id FROM projects WHERE public_id=?").get(target) as {id:number}).id;
      expect(snapshotProjectContexts(f.db,targetId)).toEqual(before);
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    }finally{f.db.close();}
  });
  it("copies subtree explicit contexts while preserving inherited child legacy null",async()=>{
    const f=await contextFixture();
    try {
      const child=f.projectService.createTask(f.authorization,f.projectRevision(),{name:"Inherited-child",externalId:"Inherited-child",type:"task",parentTaskId:f.root.taskId,start:"2026-10-12",duration:1,progress:0}).data.tasks.find(t=>t.externalId==="Inherited-child")!;
      const destination=f.projectService.createTask(f.authorization,f.projectRevision(),{name:"Destination",externalId:"Destination",type:"summary"}).data.tasks.find(t=>t.externalId==="Destination")!;
      const originals=f.repository.taskContexts(f.project);
      const result=new TaskHierarchyService(f.db,{clock:()=>now}).execute(f.authorization,f.projectRevision(),{kind:"copy",taskIds:[f.root.taskId,f.empty.taskId,f.legacy.taskId],anchorTaskId:destination.taskId,placement:"child"});
      const oldIds=new Set(originals.map(t=>t.taskId));
      const copied=result.data.tasks.filter(t=>!oldIds.has(t.taskId));
      const contexts=f.repository.taskContexts(f.project);
      const copiedContext=(name:string)=>contexts.find(t=>t.taskId===copied.find(c=>c.name===name)!.taskId)!;
      expect(copiedContext("Root").processLinks).toEqual(originals.find(t=>t.taskId===f.root.taskId)!.processLinks);
      expect(copiedContext("Root").workAreaLinks).toEqual(originals.find(t=>t.taskId===f.root.taskId)!.workAreaLinks);
      expect(copiedContext("Explicit-empty")).toMatchObject({processLinks:[],workAreaLinks:[]});
      expect(copiedContext("Legacy-null")).toMatchObject({processLinks:null,workAreaLinks:null});
      expect(copiedContext("Inherited-child")).toMatchObject({processLinks:null,workAreaLinks:null});
      expect(copied.find(t=>t.name==="Inherited-child")!.taskId).not.toBe(child.taskId);
      expect(f.db.pragma("foreign_key_check")).toEqual([]);
    }finally{f.db.close();}
  });
  it("rejects damaged v4 references, mixed null and downgraded fields atomically",async()=>{
    const f=await contextFixture();
    try {
      const saved=f.templates.createTemplateFromProject(f.authorization,f.projectRevision(),{name:"Strict v4"});
      const original=JSON.parse((f.db.prepare("SELECT content_json FROM project_templates WHERE public_id=?").get(saved.id) as {content_json:string}).content_json);
      const before=f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get();
      const cases=[
        (p:typeof original)=>{delete p.logistics.taskContexts;},
        (p:typeof original)=>{p.logistics.schemaVersion=3;},
        (p:typeof original)=>{p.logistics.equipmentWorkAreas[0].workAreaLinks[0].processCode="PROC-B";},
        (p:typeof original)=>{p.logistics.equipmentWorkAreas[0].workAreaLinks[0].workAreaId=randomUUID();},
        (p:typeof original)=>{p.logistics.taskContexts[0].processLinks=null;},
        (p:typeof original)=>{p.logistics.taskContexts.push(p.logistics.taskContexts[0]);},
        (p:typeof original)=>{p.logistics.taskContexts.find((t:{taskExternalId:string})=>t.taskExternalId==="Root").workAreaLinks[0].processCode="PROC-B";},
      ];
      for(const mutate of cases){
        const payload=structuredClone(original);mutate(payload);
        f.db.prepare("UPDATE project_templates SET content_json=? WHERE public_id=?").run(JSON.stringify(payload),saved.id);
        await expect(f.templates.instantiateProject(saved.id,{name:"Rejected",ownerName:"Owner",editPassword:"password123",projectStartDate:"2026-10-12"})).rejects.toThrow();
        expect(f.db.prepare("SELECT COUNT(*) FROM projects").pluck().get()).toBe(before);
        expect(f.db.pragma("foreign_key_check")).toEqual([]);
      }
    }finally{f.db.close();}
  });
  it("guards schedule JSON/Excel even for explicit empty context",async()=>{
    const f=await contextFixture();
    try {
      expect(()=>new ProjectJsonExportService(f.db).get(f.sourceId,f.projectRevision())).toThrow(expect.objectContaining({code:"PROCESS_CONTEXT_EXPORT_UNSUPPORTED"}));
      expect(()=>new ProjectExportSnapshotService(f.db).get(f.sourceId)).toThrow(expect.objectContaining({code:"PROCESS_CONTEXT_EXPORT_UNSUPPORTED"}));
      const report=new ResourceDashboardService(f.db,{clock:()=>now}).getDashboard(f.sourceId,{})!;
      expect(()=>new ProjectExportSnapshotService(f.db,{clock:()=>now}).get(f.sourceId,false,{basis:"current",expectedReport:{context:report.resourceScopeContext!,snapshotId:report.snapshotId,filters:{}},granularities:["month"]})).not.toThrow();
      f.db.prepare("DELETE FROM equipment_work_areas WHERE project_id=?").run(f.project);
      f.db.prepare("DELETE FROM task_process_links WHERE project_id=?").run(f.project);
      expect(()=>new ProjectJsonExportService(f.db).get(f.sourceId,f.projectRevision())).toThrow(expect.objectContaining({code:"PROCESS_CONTEXT_EXPORT_UNSUPPORTED"}));
      expect(()=>new ProjectExportSnapshotService(f.db).get(f.sourceId)).toThrow(expect.objectContaining({code:"PROCESS_CONTEXT_EXPORT_UNSUPPORTED"}));
    }finally{f.db.close();}
  });
});
