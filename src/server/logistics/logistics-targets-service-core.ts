import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  CreateLogisticsTargetRequest, LogisticsTargetCreateMember, LogisticsTargetDto,
  LogisticsTargetMemberDto, LogisticsTargetMemberInput, LogisticsTargetMutationResponse,
  LogisticsTargetUsageDto, LogisticsTargetScope, UpdateLogisticsTargetRequest,
} from "../../contracts/logistics-targets";
import { isCanonicalUuidV4 } from "../projects/project-contract";
import type { AuthorizedEditSession } from "../projects/project-service-core";
import { EditSessionRepository, ProjectRepository } from "../repositories/project-repository-core";
import { LogisticsRepository } from "../repositories/logistics-repository-core";
import { LogisticsTypeCatalogRepository } from "../repositories/logistics-type-catalog-repository-core";

export class LogisticsTargetError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string = code) {
    super(message);
    this.name = "LogisticsTargetError";
  }
}
const invalid = (code = "INVALID_TARGET_REQUEST"): never => { throw new LogisticsTargetError(400, code); };
const conflict = (code: string): never => { throw new LogisticsTargetError(409, code); };
const uuid = (x: unknown): string => typeof x === "string" && isCanonicalUuidV4(x) ? x : invalid();
const object = (x: unknown, keys: string[]): Record<string, unknown> => {
  if (!x || typeof x !== "object" || Array.isArray(x)) return invalid();
  const value = x as Record<string, unknown>;
  if (Object.keys(value).some((key) => !keys.includes(key))) return invalid();
  return value;
};
const plain = (x: unknown, max: number, allowEmpty = false): string => {
  if (typeof x !== "string") return invalid();
  const value = x.trim();
  if ((!value && !allowEmpty) || Array.from(value).length > max || /[\u0000-\u001f\u007f]/u.test(value)) return invalid();
  return value;
};
const bool = (x: unknown): boolean => typeof x === "boolean" ? x : invalid();
const code = (x: unknown): string => {
  const value = plain(x, 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) return invalid();
  return value;
};
const scope = (x: unknown): LogisticsTargetScope => x === "process" || x === "project_common" ? x : invalid();
const member = (x: unknown, inline: boolean): LogisticsTargetCreateMember => {
  const row = object(x, inline ? ["kind","entityId","create"] : ["kind","entityId"]);
  if (row.kind !== "equipment" && row.kind !== "system") return invalid();
  if (row.create === undefined) {
    if ("entityId" in row === false) return invalid();
    return { kind: row.kind, entityId: uuid(row.entityId) };
  }
  if (!inline || row.entityId !== undefined) return invalid();
  if (row.kind === "equipment") {
    const d = object(row.create, ["code","name","equipmentType","managementUnit","quantity","manufacturer","model","description","confirmDuplicateLabel"]);
    const unit = d.managementUnit;
    if (unit !== "unit" && unit !== "fleet") return invalid();
    if (!Number.isSafeInteger(d.quantity) || (d.quantity as number) < 1 || (d.quantity as number) > 100000 ||
        (unit === "unit" && d.quantity !== 1)) return invalid();
    return { kind: "equipment", create: {
      code: code(d.code), name: plain(d.name,200), equipmentType: code(d.equipmentType),
      managementUnit: unit, quantity: d.quantity as number,
      manufacturer: d.manufacturer === undefined ? "" : plain(d.manufacturer,200,true),
      model: d.model === undefined ? "" : plain(d.model,200,true),
      description: d.description === undefined ? "" : plain(d.description,4000,true),
      confirmDuplicateLabel: d.confirmDuplicateLabel === undefined ? false : bool(d.confirmDuplicateLabel),
    } };
  }
  const d = object(row.create, ["code","name","systemType","layer","scope","processIds","vendor","description","confirmDuplicateLabel"]);
  if (d.layer !== "controller" && d.layer !== "coordinator") return invalid();
  if (d.scope !== "project" && d.scope !== "processes") return invalid();
  const ids = d.processIds === undefined ? [] : d.processIds;
  if (!Array.isArray(ids) || ids.length > 100 || new Set(ids).size !== ids.length) return invalid();
  const processes = ids.map(uuid);
  if ((d.scope === "project" && processes.length > 0) || (d.scope === "processes" && !processes.length)) return invalid();
  return { kind: "system", create: {
    code: code(d.code), name: d.name === undefined ? undefined : plain(d.name,200),
    systemType: code(d.systemType), layer: d.layer, scope: d.scope, processIds: processes,
    vendor: d.vendor === undefined ? "" : plain(d.vendor,200,true),
    description: d.description === undefined ? "" : plain(d.description,4000,true),
    confirmDuplicateLabel: d.confirmDuplicateLabel === undefined ? false : bool(d.confirmDuplicateLabel),
  } };
};
type ExtendedEquipment = Extract<LogisticsTargetCreateMember, { kind: "equipment"; create: unknown }>["create"] & {confirmDuplicateLabel?:boolean};
type ExtendedSystem = Extract<LogisticsTargetCreateMember, { kind: "system"; create: unknown }>["create"] & {confirmDuplicateLabel?:boolean};
export type ParsedTargetCreate = Omit<CreateLogisticsTargetRequest,"members"> & { members: LogisticsTargetCreateMember[] };
export function parseTargetCreate(input: unknown): ParsedTargetCreate {
  const d = object(input, ["code","name","scope","projectProcessId","workAreaId","active","description","members"]);
  if (!Array.isArray(d.members) || d.members.length < 1 || d.members.length > 100) return invalid("TARGET_MEMBERS_REQUIRED");
  return {
    code: code(d.code), name: plain(d.name,200), scope: scope(d.scope),
    projectProcessId: d.projectProcessId == null ? null : uuid(d.projectProcessId),
    workAreaId: d.workAreaId == null ? null : uuid(d.workAreaId),
    active: d.active === undefined ? true : bool(d.active),
    description: d.description === undefined ? "" : plain(d.description,4000,true),
    members: d.members.map((x) => member(x,true)),
  };
}
export function parseTargetUpdate(input: unknown): UpdateLogisticsTargetRequest {
  const d = object(input, ["code","name","scope","projectProcessId","workAreaId","active","description","members"]);
  if (!Object.keys(d).length) return invalid();
  const members = d.members === undefined ? undefined : d.members;
  if (members !== undefined && (!Array.isArray(members) || members.length < 1 || members.length > 100)) return invalid("TARGET_MEMBERS_REQUIRED");
  return {
    ...(d.code !== undefined ? {code:code(d.code)} : {}),
    ...(d.name !== undefined ? {name:plain(d.name,200)} : {}),
    ...(d.scope !== undefined ? {scope:scope(d.scope)} : {}),
    ...(d.projectProcessId !== undefined ? {projectProcessId:d.projectProcessId === null ? null : uuid(d.projectProcessId)} : {}),
    ...(d.workAreaId !== undefined ? {workAreaId:d.workAreaId === null ? null : uuid(d.workAreaId)} : {}),
    ...(d.active !== undefined ? {active:bool(d.active)} : {}),
    ...(d.description !== undefined ? {description:plain(d.description,4000,true)} : {}),
    ...(members !== undefined ? {members:(members as unknown[]).map((x) => member(x,false) as LogisticsTargetMemberInput)} : {}),
  };
}

interface TargetRow {
  id: number; public_id: string; project_id: number; code: string; name: string;
  scope: LogisticsTargetScope; project_process_id: number | null;
  occurrence_id: number | null; work_area_id: number | null;
  process_public_id: string | null; occurrence_public_id: string | null; area_public_id: string | null;
  active: number; description: string; created_at: string; updated_at: string;
}
interface MemberRow {
  id: number; public_id: string; project_id: number; target_id: number;
  kind: "equipment" | "system"; equipment_id: number | null; system_id: number | null;
  entity_public_id: string; code: string; label: string; type_code: string;
  active: number; quantity: number; system_scope: string | null;
  process_matches: number;
}
const targetSql = [
  "SELECT t.*, pp.public_id AS process_public_id, o.public_id AS occurrence_public_id,",
  "w.public_id AS area_public_id FROM logistics_targets t",
  "LEFT JOIN project_processes pp ON pp.project_id=t.project_id AND pp.id=t.project_process_id",
  "LEFT JOIN site_product_processes o ON o.id=t.occurrence_id",
  "LEFT JOIN work_areas w ON w.id=t.work_area_id"
].join(" ");
const memberSql = [
  "SELECT m.*, COALESCE(e.public_id,s.public_id) entity_public_id,",
  "COALESCE(e.code,s.code) code, COALESCE(e.name,NULLIF(s.name,''),st.name,s.system_type) label,",
  "COALESCE(e.equipment_type,s.system_type) type_code, COALESCE(e.active,s.active) active,",
  "COALESCE(e.quantity,1) quantity, s.scope system_scope,",
  "CASE WHEN m.kind='equipment' THEN 1 WHEN s.scope='project' THEN 1",
  "WHEN EXISTS (SELECT 1 FROM project_system_processes sp",
  " JOIN logistics_targets t ON t.project_id=m.project_id AND t.id=m.target_id",
  " WHERE sp.project_id=m.project_id AND sp.system_id=m.system_id",
  " AND sp.process_id=t.project_process_id) THEN 1 ELSE 0 END process_matches",
  "FROM logistics_target_members m",
  "LEFT JOIN project_equipment e ON e.project_id=m.project_id AND e.id=m.equipment_id",
  "LEFT JOIN project_logistics_systems s ON s.project_id=m.project_id AND s.id=m.system_id",
  "LEFT JOIN logistics_system_types st ON st.code=s.system_type"
].join(" ");
const asMember = (r: MemberRow): LogisticsTargetMemberDto => ({
  id:r.public_id, kind:r.kind, entityId:r.entity_public_id, code:r.code,
  label:r.label, typeCode:r.type_code, active:r.active === 1, quantity:r.quantity
});
export class LogisticsTargetService {
  private readonly projects: ProjectRepository;
  private readonly sessions: EditSessionRepository;
  private readonly logistics: LogisticsRepository;
  private readonly types: LogisticsTypeCatalogRepository;
  constructor(private readonly db: Database.Database,
    private readonly options: {clock?:()=>Date; generatePublicId?:()=>string} = {}) {
    this.projects = new ProjectRepository(db);
    this.sessions = new EditSessionRepository(db);
    this.logistics = new LogisticsRepository(db);
    this.types = new LogisticsTypeCatalogRepository(db);
  }
  private now(): Date { return (this.options.clock ?? (()=>new Date()))(); }
  private id(): string { return uuid((this.options.generatePublicId ?? randomUUID)()); }
  private project(projectPublicId: string) {
    const p = this.projects.findByPublicId(uuid(projectPublicId));
    if (!p) throw new LogisticsTargetError(404,"PROJECT_NOT_FOUND");
    return p;
  }
  private check(auth: AuthorizedEditSession, revision: number, now: Date): void {
    const p = this.projects.findCredentialById(auth.projectId);
    const s = this.sessions.findById(auth.sessionId);
    if (!p || !s || p.publicId !== auth.projectPublicId || s.projectId !== p.id ||
        p.authVersion !== auth.projectAuthVersion || s.authVersion !== p.authVersion ||
        !s.tokenHash.equals(auth.tokenHash) || s.revokedAt !== null ||
        !Number.isFinite(Date.parse(s.expiresAt)) || Date.parse(s.expiresAt) <= now.getTime())
      throw new LogisticsTargetError(401,"EDIT_SESSION_REQUIRED");
    if (p.revision !== revision) throw new LogisticsTargetError(412,"REVISION_MISMATCH");
  }
  private row(projectId:number, publicId:string): TargetRow {
    const r = this.db.prepare(targetSql+" WHERE t.project_id=? AND t.public_id=?")
      .get(projectId,uuid(publicId)) as TargetRow|undefined;
    if (!r) throw new LogisticsTargetError(404,"TARGET_NOT_FOUND");
    return r;
  }
  private rows(projectId:number, limit:number, offset:number, search?:string): TargetRow[] {
    const where = search ? " AND (instr(lower(t.code),lower(?))>0 OR instr(lower(t.name),lower(?))>0)" : "";
    const values = search ? [projectId,search,search,limit,offset] : [projectId,limit,offset];
    return this.db.prepare(targetSql+" WHERE t.project_id=?"+where+
      " ORDER BY lower(t.name),t.code,t.public_id LIMIT ? OFFSET ?").all(...values) as TargetRow[];
  }
  private members(projectId:number, targetIds:number[]): Map<number,MemberRow[]> {
    const result = new Map<number,MemberRow[]>();
    if (!targetIds.length) return result;
    const placeholders = targetIds.map(()=>"?").join(",");
    const rows = this.db.prepare(memberSql+" WHERE m.project_id=? AND m.target_id IN ("+placeholders+") ORDER BY m.target_id,m.id")
      .all(projectId,...targetIds) as MemberRow[];
    for (const r of rows) result.set(r.target_id,[...(result.get(r.target_id)??[]),r]);
    return result;
  }
  private dto(row:TargetRow, members:MemberRow[]): LogisticsTargetDto {
    const warnings:string[] = [];
    for (const m of members) {
      if (!m.active) warnings.push("INACTIVE_MEMBER:"+m.public_id);
      if (m.kind === "system" && !m.process_matches)
        warnings.push("SYSTEM_CONTROL_SCOPE_DIFFERS:"+m.public_id);
    }
    return {
      id:row.public_id, code:row.code, name:row.name, scope:row.scope,
      projectProcessId:row.process_public_id, occurrenceId:row.occurrence_public_id,
      workAreaId:row.area_public_id, active:row.active===1, description:row.description,
      members:members.map(asMember), warnings, createdAt:row.created_at,updatedAt:row.updated_at,
    };
  }
  list(publicId:string, query:{limit?:number;offset?:number;search?:string}={}) {
    return this.db.transaction(()=>{
      const project = this.project(publicId);
      const limit = query.limit??50, offset = query.offset??0;
      if (!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>10000) return invalid();
      const search = query.search===undefined?undefined:plain(query.search,100);
      const total = (this.db.prepare("SELECT COUNT(*) total FROM logistics_targets WHERE project_id=?"+
        (search?" AND (instr(lower(code),lower(?))>0 OR instr(lower(name),lower(?))>0)":""))
        .get(...(search?[project.id,search,search]:[project.id])) as {total:number}).total;
      const rows = this.rows(project.id,limit,offset,search);
      const mapped = this.members(project.id,rows.map(r=>r.id));
      return {projectRevision:project.revision,targets:rows.map(r=>this.dto(r,mapped.get(r.id)??[])),limit,offset,total};
    }).deferred();
  }
  get(publicId:string,targetId:string): LogisticsTargetDto {
    return this.db.transaction(()=>{
      const project = this.project(publicId);
      const row = this.row(project.id,targetId);
      return this.dto(row,this.members(project.id,[row.id]).get(row.id)??[]);
    }).deferred();
  }
  usage(publicId:string,targetId:string): LogisticsTargetUsageDto {
    return this.db.transaction(()=>{
      const project = this.project(publicId), target = this.row(project.id,targetId);
      const members = this.members(project.id,[target.id]).get(target.id)??[];
      const usageMembers = members.map((m)=>({
        ...asMember(m),
        targetCount: (this.db.prepare("SELECT COUNT(*) n FROM logistics_target_members WHERE project_id=? AND kind=? AND "+
          (m.kind==="equipment"?"equipment_id":"system_id")+"=?")
          .get(project.id,m.kind,m.equipment_id??m.system_id) as {n:number}).n,
        directTaskCount:(this.db.prepare("SELECT COUNT(*) n FROM "+
          (m.kind==="equipment"?"task_equipment_links":"task_system_links")+
          " WHERE project_id=? AND "+(m.kind==="equipment"?"equipment_id":"system_id")+"=?")
          .get(project.id,m.equipment_id??m.system_id) as {n:number}).n,
      }));
      return { targetId:targetId, memberCount:members.length, referencedByTaskCount:0, members:usageMembers };
    }).deferred();
  }
  private location(projectId:number, targetScope:LogisticsTargetScope,
      processPublicId:string|null, workAreaPublicId:string|null) {
    if (targetScope==="project_common") {
      if (processPublicId!==null || workAreaPublicId!==null) return invalid("TARGET_COMMON_PROCESS_FORBIDDEN");
      return {processId:null,occurrenceId:null,workAreaId:null};
    }
    if (!processPublicId) return invalid("TARGET_PROCESS_REQUIRED");
    const p=this.logistics.findProcessByPublicId(projectId,uuid(processPublicId));
    if (!p || p.active===0) return conflict("TARGET_PROCESS_INVALID");
    const m = this.db.prepare("SELECT m.*,o.active occurrence_active,pt.active type_active FROM project_process_occurrence_mappings m JOIN site_product_processes o ON o.id=m.occurrence_id JOIN process_types pt ON pt.id=o.process_type_id WHERE m.project_id=? AND m.project_process_id=?")
      .get(projectId,p.id) as {occurrence_id:number;occurrence_active:number;type_active:number}|undefined;
    if (!m || !m.occurrence_active || !m.type_active) return conflict("TARGET_PROCESS_MAPPING_REQUIRED");
    let areaId:number|null=null;
    if (workAreaPublicId) {
      const a=this.db.prepare("SELECT id,occurrence_id,active FROM work_areas WHERE public_id=?")
        .get(uuid(workAreaPublicId)) as {id:number;occurrence_id:number;active:number}|undefined;
      if (!a || a.occurrence_id!==m.occurrence_id || a.active!==1) return conflict("TARGET_WORK_AREA_MISMATCH");
      areaId=a.id;
    }
    return {processId:p.id,occurrenceId:m.occurrence_id,workAreaId:areaId};
  }
  private instance(projectId:number, targetScope:LogisticsTargetScope, processId:number|null,
      value:LogisticsTargetMemberInput, allowInactive:boolean) {
    const r = value.kind === "equipment"
      ? this.logistics.findEquipmentByPublicId(projectId,uuid(value.entityId))
      : this.logistics.findSystemByPublicId(projectId,uuid(value.entityId));
    if (!r) return conflict("TARGET_MEMBER_NOT_IN_PROJECT");
    if (!allowInactive && r.active===0) return conflict("TARGET_MEMBER_INACTIVE");
    if (value.kind==="equipment" && (targetScope!=="process" || ("processId" in r && r.processId!==processId)))
      return conflict("TARGET_EQUIPMENT_PROCESS_MISMATCH");
    if (value.kind==="system" && targetScope==="project_common" && ("scope" in r && r.scope!=="project"))
      return conflict("TARGET_SYSTEM_SCOPE_MISMATCH");
    return {kind:value.kind,entityId:r.id};
  }
  private inline(projectId:number, targetScope:LogisticsTargetScope, processId:number|null,
      entry:LogisticsTargetCreateMember, now:string): LogisticsTargetMemberInput {
    if (!("create" in entry)) return entry;
    if (entry.kind==="equipment") {
      if (targetScope!=="process" || processId===null) return conflict("TARGET_EQUIPMENT_PROCESS_MISMATCH");
      const d=entry.create as ExtendedEquipment;
      const type=this.types.find("equipment",d.equipmentType);
      if (!type || !type.active) return conflict("TARGET_EQUIPMENT_TYPE_INACTIVE");
      if (this.logistics.findEquipmentByCode(projectId,d.code)) return conflict("EQUIPMENT_CODE_ALREADY_EXISTS");
      const duplicate=this.db.prepare("SELECT 1 FROM project_equipment WHERE project_id=? AND equipment_type=? AND name=? LIMIT 1")
        .get(projectId,d.equipmentType,d.name);
      if (duplicate && !d.confirmDuplicateLabel) return conflict("TARGET_DUPLICATE_LABEL_CONFIRMATION_REQUIRED");
      const e=this.logistics.insertEquipment({
        publicId:this.id(),projectId,processId,code:d.code,name:d.name,equipmentType:d.equipmentType,
        managementUnit:d.managementUnit,quantity:d.quantity,manufacturer:d.manufacturer,model:d.model,
        description:d.description,active:1,now
      });
      return {kind:"equipment",entityId:e.publicId};
    }
    const d=entry.create as ExtendedSystem;
    const type=this.types.find("system",d.systemType);
    if (!type || !type.active) return conflict("TARGET_SYSTEM_TYPE_INACTIVE");
    if (this.logistics.findSystemByCode(projectId,d.code)) return conflict("SYSTEM_CODE_ALREADY_EXISTS");
    const label=d.name??type.name;
    const duplicate=this.db.prepare("SELECT 1 FROM project_logistics_systems WHERE project_id=? AND system_type=? AND name=? LIMIT 1")
      .get(projectId,d.systemType,label);
    if (duplicate && !d.confirmDuplicateLabel) return conflict("TARGET_DUPLICATE_LABEL_CONFIRMATION_REQUIRED");
    if (targetScope==="project_common" && d.scope!=="project") return conflict("TARGET_SYSTEM_SCOPE_MISMATCH");
    const ids=(d.processIds??[]).map(pid=>{
      const p=this.logistics.findProcessByPublicId(projectId,pid);
      if (!p || p.active===0) return conflict("TARGET_PROCESS_INVALID");
      return p.id;
    });
    const s=this.logistics.insertSystem({publicId:this.id(),projectId,code:d.code,
      name:label,systemType:d.systemType,layer:d.layer,scope:d.scope,
      vendor:d.vendor,description:d.description,active:1,now});
    if (ids.length) this.logistics.setSystemProcesses(projectId,s.id,ids,now);
    return {kind:"system",entityId:s.publicId};
  }
  private addMember(projectId:number,targetId:number,value:LogisticsTargetMemberInput,
    targetScope:LogisticsTargetScope,processId:number|null,now:string,allowInactive=false): void {
    const resolved=this.instance(projectId,targetScope,processId,value,allowInactive);
    const exists=this.db.prepare("SELECT 1 FROM logistics_target_members WHERE project_id=? AND target_id=? AND kind=? AND "+
      (value.kind==="equipment"?"equipment_id":"system_id")+"=?").get(projectId,targetId,value.kind,resolved.entityId);
    if (exists) return;
    this.db.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,equipment_id,system_id,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(this.id(),projectId,targetId,value.kind,value.kind==="equipment"?resolved.entityId:null,
        value.kind==="system"?resolved.entityId:null,now);
  }
  private ensureUniqueMembers(values:LogisticsTargetMemberInput[]): void {
    if (!values.length || values.length>100) return invalid("TARGET_MEMBERS_REQUIRED");
    const keys=values.map(v=>v.kind+":"+v.entityId);
    if (new Set(keys).size!==keys.length) return conflict("TARGET_MEMBER_DUPLICATE");
  }
  private write(auth:AuthorizedEditSession,expected:number,
      action:(projectId:number,now:string)=>{targetId:string|null;operation:"create"|"update"|"delete";changed:boolean})
    :LogisticsTargetMutationResponse {
    const now=this.now();
    return this.db.transaction(()=>{
      this.check(auth,expected,now);
      const result=action(auth.projectId,now.toISOString());
      if (result.changed && !this.projects.advanceRevision(auth.projectId,expected,now.toISOString()))
        throw new LogisticsTargetError(412,"REVISION_MISMATCH");
      return {data:{projectRevision:expected+(result.changed?1:0),
        target:result.targetId?this.get(auth.projectPublicId,result.targetId):null,
        operation:result.operation}};
    }).immediate();
  }
  create(auth:AuthorizedEditSession,expected:number,raw:unknown):LogisticsTargetMutationResponse {
    const input=parseTargetCreate(raw);
    return this.write(auth,expected,(projectId,now)=>{
      const present=this.db.prepare("SELECT 1 FROM logistics_targets WHERE project_id=? AND code=?").get(projectId,input.code);
      if (present) return conflict("TARGET_CODE_ALREADY_EXISTS");
      const where=this.location(projectId,input.scope,input.projectProcessId??null,input.workAreaId??null);
      const resolved=input.members.map(m=>this.inline(projectId,input.scope,where.processId,m,now));
      this.ensureUniqueMembers(resolved);
      const targetId=this.id();
      const inserted=this.db.prepare("INSERT INTO logistics_targets(public_id,project_id,code,name,scope,project_process_id,occurrence_id,work_area_id,active,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(targetId,projectId,input.code,input.name,input.scope,where.processId,where.occurrenceId,
          where.workAreaId,input.active?1:0,input.description??"",now,now);
      for (const m of resolved) this.addMember(projectId,Number(inserted.lastInsertRowid),m,input.scope,where.processId,now);
      return {targetId,operation:"create",changed:true};
    });
  }
  update(auth:AuthorizedEditSession,expected:number,targetId:string,raw:unknown):LogisticsTargetMutationResponse {
    const input=parseTargetUpdate(raw);
    return this.write(auth,expected,(projectId,now)=>{
      const current=this.row(projectId,targetId);
      const nextScope=input.scope??current.scope;
      const nextProcess=input.projectProcessId!==undefined ? input.projectProcessId : current.process_public_id;
      const nextArea=input.workAreaId!==undefined ? input.workAreaId : current.area_public_id;
      const where=this.location(projectId,nextScope,nextProcess,nextArea);
      const details=[input.code??current.code,input.name??current.name,nextScope,
        where.processId,where.occurrenceId,where.workAreaId,input.active===undefined?current.active:(input.active?1:0),
        input.description??current.description] as const;
      const old=[current.code,current.name,current.scope,current.project_process_id,current.occurrence_id,
        current.work_area_id,current.active,current.description];
      const metadataChanged=details.some((d,i)=>d!==old[i]);
      const existing=this.members(projectId,[current.id]).get(current.id)??[];
      let changed=metadataChanged;
      if (input.members) {
        this.ensureUniqueMembers(input.members);
        const desired=input.members.map(v=>this.instance(projectId,nextScope,where.processId,v,
          existing.some(m=>m.kind===v.kind&&m.entity_public_id===v.entityId)));
        const signatures=new Set(desired.map(v=>v.kind+":"+v.entityId));
        for (const [i,source] of input.members.entries()) {
          if (existing.some(m=>m.kind===source.kind && m.entity_public_id===source.entityId)) continue;
          this.addMember(projectId,current.id,source,nextScope,where.processId,now);
          changed=true;
        }
        for (const m of existing) {
          if (!signatures.has(m.kind+":"+(m.equipment_id??m.system_id))) {
            this.db.prepare("DELETE FROM logistics_target_members WHERE project_id=? AND target_id=? AND id=?")
              .run(projectId,current.id,m.id);
            changed=true;
          }
        }
      } else if (metadataChanged) {
        for (const m of existing) this.instance(projectId,nextScope,where.processId,
          {kind:m.kind,entityId:m.entity_public_id},true);
      }
      if (metadataChanged) this.db.prepare("UPDATE logistics_targets SET code=?,name=?,scope=?,project_process_id=?,occurrence_id=?,work_area_id=?,active=?,description=?,updated_at=? WHERE project_id=? AND id=?")
        .run(...details,now,projectId,current.id);
      return {targetId:current.public_id,operation:"update",changed};
    });
  }
  delete(auth:AuthorizedEditSession,expected:number,targetId:string):LogisticsTargetMutationResponse {
    return this.write(auth,expected,(projectId)=>{
      const current=this.row(projectId,targetId);
      // F3 will introduce RESTRICTed WBS bindings. Existing targets may be deleted without
      // changing Equipment, System, controls, coordinators, Resource roles or direct Task links.
      this.db.prepare("DELETE FROM logistics_targets WHERE project_id=? AND id=?").run(projectId,current.id);
      return {targetId:null,operation:"delete",changed:true};
    });
  }
}
/** Copy once per source Target, sharing the already copied instance IDs across Target memberships.
 * Called inside ProjectCopyService's encompassing IMMEDIATE transaction, never advancing revision. */
export function copyLogisticsTargets(db:Database.Database,sourceId:number,targetId:number,
  processIds:Map<number,number>,equipmentIds:Map<number,number>,systemIds:Map<number,number>,
  now:string):number {
  const targets=db.prepare("SELECT * FROM logistics_targets WHERE project_id=? ORDER BY id")
    .all(sourceId) as Array<{id:number;code:string;name:string;scope:LogisticsTargetScope;project_process_id:number|null;occurrence_id:number|null;work_area_id:number|null;active:number;description:string}>;
  for (const t of targets) {
    const processId=t.project_process_id===null?null:processIds.get(t.project_process_id);
    if (t.project_process_id!==null && processId===undefined) return conflict("TARGET_COPY_MAPPING_MISSING");
    const mapping=processId===null?null:db.prepare("SELECT occurrence_id FROM project_process_occurrence_mappings WHERE project_id=? AND project_process_id=?")
      .get(targetId,processId) as {occurrence_id:number}|undefined;
    if (processId!==null && (!mapping || mapping.occurrence_id!==t.occurrence_id)) return conflict("TARGET_COPY_OCCURRENCE_MISMATCH");
    const inserted=db.prepare("INSERT INTO logistics_targets(public_id,project_id,code,name,scope,project_process_id,occurrence_id,work_area_id,active,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(randomUUID(),targetId,t.code,t.name,t.scope,processId??null,t.occurrence_id,t.work_area_id,t.active,t.description,now,now);
    const members=db.prepare("SELECT * FROM logistics_target_members WHERE project_id=? AND target_id=? ORDER BY id")
      .all(sourceId,t.id) as Array<{kind:"equipment"|"system";equipment_id:number|null;system_id:number|null}>;
    if (!members.length) return conflict("TARGET_COPY_EMPTY");
    for (const m of members) {
      const id=m.kind==="equipment"?equipmentIds.get(m.equipment_id!):systemIds.get(m.system_id!);
      if (id===undefined) return conflict("TARGET_COPY_MEMBER_MISSING");
      db.prepare("INSERT INTO logistics_target_members(public_id,project_id,target_id,kind,equipment_id,system_id,created_at) VALUES(?,?,?,?,?,?,?)")
        .run(randomUUID(),targetId,Number(inserted.lastInsertRowid),m.kind,m.kind==="equipment"?id:null,m.kind==="system"?id:null,now);
    }
  }
  return targets.length;
}
