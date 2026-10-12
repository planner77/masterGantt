import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { openDatabase } from "../../../src/server/db/core";
import { ProjectRepository,EditSessionRepository } from "../../../src/server/repositories/project-repository-core";
import { LogisticsTargetService,copyLogisticsTargets } from "../../../src/server/logistics/logistics-targets-service-core";
import { LogisticsRepository } from "../../../src/server/repositories/logistics-repository-core";
import { createSessionToken,sessionExpiry } from "../../../src/server/security/session-core";
const migrationsDirectory=join(process.cwd(),"db/migrations");
const now=new Date("2026-10-12T01:00:00Z");
const setup=()=>{
  const {database:db}=openDatabase({filename:":memory:",migrationsDirectory});
  const project=new ProjectRepository(db).insert({
    publicId:randomUUID(),name:"Targets",description:"",status:"planned",
    passwordKdf:"scrypt",passwordSalt:Buffer.alloc(16,1),passwordHash:Buffer.alloc(32,2),
    scryptN:32768,scryptR:8,scryptP:3,scryptKeyLength:32,calendarTimezone:"Asia/Seoul",
    createdAt:now.toISOString(),updatedAt:now.toISOString()
  });
  const token=createSessionToken();
  const sessionId=new EditSessionRepository(db).insert({
    projectId:project.id,tokenHash:token.tokenHash,authVersion:project.authVersion,
    createdAt:now.toISOString(),expiresAt:sessionExpiry(now).toISOString()
  });
  const auth={projectId:project.id,projectPublicId:project.publicId,projectRevision:project.revision,
    projectAuthVersion:project.authVersion,sessionId,tokenHash:token.tokenHash,expiresAt:sessionExpiry(now).toISOString()};
  const service=new LogisticsTargetService(db,{clock:()=>now});
  const logistics=new LogisticsRepository(db);
  const system=logistics.insertSystem({publicId:randomUUID(),projectId:project.id,
    code:"MCS1",name:"MCS",systemType:"mcs",layer:"coordinator",scope:"project",now:now.toISOString()});
  return {db,project,auth,service,logistics,system};
};
describe("Issue #616 Target persistence",()=>{
  it("creates a common Target using an existing project System and increments revision once",()=>{
    const f=setup();
    try {
      const r=f.service.create(f.auth,1,{code:"COMMON",name:"Common",scope:"project_common",
        members:[{kind:"system",entityId:f.system.publicId}]});
      expect(r.data.projectRevision).toBe(2);
      expect(r.data.target?.members).toHaveLength(1);
      expect(r.data.target?.members[0].quantity).toBe(1);
      expect(f.service.list(f.project.publicId).total).toBe(1);
      expect(f.service.usage(f.project.publicId,r.data.target!.id).members[0].targetCount).toBe(1);
      expect(()=>f.service.create(f.auth,1,{code:"STALE",name:"Stale",scope:"project_common",
        members:[{kind:"system",entityId:f.system.publicId}]})).toThrow();
      expect(f.service.list(f.project.publicId).total).toBe(1);
    } finally {f.db.close();}
  });
  it("shares a System instance across Targets and keeps it alive when membership is removed",()=>{
    const f=setup();
    try {
      const a=f.service.create(f.auth,1,{code:"A",name:"A",scope:"project_common",members:[{kind:"system",entityId:f.system.publicId}]});
      const b=f.service.create(f.auth,2,{code:"B",name:"B",scope:"project_common",members:[{kind:"system",entityId:f.system.publicId}]});
      expect(f.service.usage(f.project.publicId,a.data.target!.id).members[0].targetCount).toBe(2);
      f.service.delete(f.auth,3,a.data.target!.id);
      expect(f.service.get(f.project.publicId,b.data.target!.id).members[0].entityId).toBe(f.system.publicId);
      expect(f.logistics.findSystemByPublicId(f.project.id,f.system.publicId)).toBeDefined();
    } finally {f.db.close();}
  });
  it("rejects cross-project typed FK, empty members, duplicate member and wrong common scope",()=>{
    const f=setup();
    try {
      const second=new ProjectRepository(f.db).insert({
        publicId:randomUUID(),name:"Other",description:"",status:"planned",passwordKdf:"scrypt",
        passwordSalt:Buffer.alloc(16,1),passwordHash:Buffer.alloc(32,2),scryptN:32768,scryptR:8,
        scryptP:3,scryptKeyLength:32,calendarTimezone:"Asia/Seoul",
        createdAt:now.toISOString(),updatedAt:now.toISOString()
      });
      const foreign=f.logistics.insertSystem({publicId:randomUUID(),projectId:second.id,
        code:"MCS2",name:"MCS2",systemType:"mcs",layer:"coordinator",scope:"project",now:now.toISOString()});
      const create=(members:unknown[])=>f.service.create(f.auth,1,{code:"X",name:"X",scope:"project_common",members});
      expect(()=>create([])).toThrow();
      expect(()=>create([{kind:"system",entityId:foreign.publicId}])).toThrow();
      expect(()=>create([{kind:"system",entityId:f.system.publicId},{kind:"system",entityId:f.system.publicId}])).toThrow();
      expect(f.service.list(f.project.publicId).total).toBe(0);
    } finally {f.db.close();}
  });
  it("preserves shared instance through Project copy remap and rejects unmapped child",()=>{
    const f=setup();
    try{
      const target=f.service.create(f.auth,1,{code:"T",name:"T",scope:"project_common",members:[{kind:"system",entityId:f.system.publicId}]});
      const p2=new ProjectRepository(f.db).insert({
        publicId:randomUUID(),name:"Clone",description:"",status:"planned",passwordKdf:"scrypt",
        passwordSalt:Buffer.alloc(16,1),passwordHash:Buffer.alloc(32,2),scryptN:32768,scryptR:8,
        scryptP:3,scryptKeyLength:32,calendarTimezone:"Asia/Seoul",
        createdAt:now.toISOString(),updatedAt:now.toISOString()
      });
      expect(()=>copyLogisticsTargets(f.db,f.project.id,p2.id,new Map(),new Map(),new Map(),now.toISOString())).toThrow();
      expect(f.service.list(p2.publicId).total).toBe(0);
      const copied=f.logistics.insertSystem({publicId:randomUUID(),projectId:p2.id,code:"MCS1",name:"MCS",systemType:"mcs",layer:"coordinator",scope:"project",now:now.toISOString()});
      expect(copyLogisticsTargets(f.db,f.project.id,p2.id,new Map(),new Map(),new Map([[f.system.id,copied.id]]),now.toISOString())).toBe(1);
      const results=f.service.list(p2.publicId).targets;
      expect(results[0].id).not.toBe(target.data.target!.id);
      expect(results[0].members[0].entityId).toBe(copied.publicId);
    }finally{f.db.close();}
  });
});
