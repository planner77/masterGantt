import { randomUUID } from "node:crypto";
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

async function fixture() {
  const {database:db}=openDatabase({filename:":memory:",migrationsDirectory});
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
    occA,occB,mcs};
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
