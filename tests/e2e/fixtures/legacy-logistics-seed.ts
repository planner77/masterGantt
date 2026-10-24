import { test, type BrowserContext, type Page } from "@playwright/test";
import SqliteDatabase from "better-sqlite3";
import { openDatabase } from "../../../src/server/db/core";
import { LogisticsTargetService } from "../../../src/server/logistics/logistics-targets-service-core";
import { TaskTargetBindingService } from "../../../src/server/logistics/task-target-bindings-service-core";
import { TaskFieldProjectService } from "../../../src/server/projects/task-field-project-service";
import { parseEditSessionCookie } from "../../../src/server/security/cookie-core";
import { resolve } from "node:path";

const isolatedDatabases=new Map<string,string>();
export function registerLegacyFixtureDatabase(origin:string,filename:string):void { isolatedDatabases.set(origin,filename); }
export function unregisterLegacyFixtureDatabase(origin:string):void { isolatedDatabases.delete(origin); }

/** Observe all archive tables through a read-only handle owned by this isolated test. */
export function readLegacyFixtureCounts(origin:string,publicId:string) {
  const filename=isolatedDatabases.get(origin);
  if(!filename) throw new Error("기존 자료 건수는 이 테스트가 소유한 격리 SQLite에서만 조회할 수 있습니다.");
  const db=new SqliteDatabase(filename,{readonly:true,fileMustExist:true});
  try {
    return db.transaction(()=>{
      const project=db.prepare("SELECT id FROM projects WHERE public_id=?").get(publicId) as {id:number}|undefined;
      if(!project) throw new Error("격리 SQLite에서 프로젝트를 찾을 수 없습니다.");
      const count=(table:string)=>(db.prepare(`SELECT count(*) count FROM ${table} WHERE project_id=?`).get(project.id) as {count:number}).count;
      return {targets:count("logistics_targets"),members:count("logistics_target_members"),bindings:count("task_target_bindings"),selectedMembers:count("task_target_binding_members")};
    }).deferred();
  } finally {db.close();}
}

/** Test-process archive setup only. There is deliberately no runtime seed endpoint. */
export async function seedLegacyLogistics(source:Page|BrowserContext,origin:string,publicId:string,path:string,body:unknown,method="post") {
  const filename=isolatedDatabases.get(origin);
  if(!filename) throw new Error("기존 자료 fixture는 이 테스트가 소유한 격리 SQLite에서만 만들 수 있습니다. 외부 서버 seed는 지원하지 않습니다.");
  const context="context" in source?source.context():source;
  const cookies=await context.cookies(origin);
  const parsed=parseEditSessionCookie(cookies.map(cookie=>`${cookie.name}=${cookie.value}`).join("; "),"development",new URL(origin));
  const {database:db}=openDatabase({filename,migrationsDirectory:resolve(__dirname,"../../../db/migrations")});
  try {
    const authorization=new TaskFieldProjectService(db).authorize(publicId,parsed.state==="present"?parsed.rawToken:undefined);
    if(authorization.kind!=="authorized") throw new Error("기존 자료 fixture에 현재 프로젝트 편집 세션이 필요합니다.");
    const auth=authorization.authorization,revision=auth.projectRevision;
    const targets=new LogisticsTargetService(db),bindings=new TaskTargetBindingService(db);
    const binding=/^\/tasks\/([0-9a-f-]{36})\/target-bindings$/.exec(path);
    const target=/^\/logistics\/targets\/([0-9a-f-]{36})(\/impact)?$/.exec(path);
    test.info().annotations.push({type:"legacy-archive-seed",description:"격리 SQLite 내부 서비스로 기존 자료를 준비함. 공개 HTTP 작성 성공의 증거가 아님."});
    if(binding&&method.toLowerCase()==="put") return bindings.replace(auth,revision,binding[1]!,body);
    if(path==="/logistics/targets"&&method.toLowerCase()==="post") return targets.create(auth,revision,body);
    if(target&&method.toLowerCase()==="patch") return targets.update(auth,revision,target[1]!,body);
    if(target?.[2]&&method.toLowerCase()==="post") return targets.previewUpdate(auth,revision,target[1]!,body);
    throw new Error("지원하지 않는 기존 자료 fixture 명령입니다.");
  } finally { db.close(); }
}
