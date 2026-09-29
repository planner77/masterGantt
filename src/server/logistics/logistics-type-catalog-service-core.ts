import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type Database from "better-sqlite3";
import type { CreateLogisticsTypeRequest, LogisticsActiveTypeCatalogResponse, LogisticsTypeCatalogResponse, LogisticsTypeKind, UpdateLogisticsTypeRequest } from "../../contracts/logistics";
import { LogisticsTypeCatalogRepository } from "../repositories/logistics-type-catalog-repository-core";
import { createSessionToken, hashSessionToken } from "../security/session-core";
import { LOGISTICS_CATALOG_ADMIN_SESSION_TTL_SECONDS } from "../security/logistics-catalog-cookie-core";

export class LogisticsCatalogAuthorizationError extends Error {}
export class LogisticsCatalogRevisionMismatchError extends Error {}
export class LogisticsCatalogNotFoundError extends Error {}
export class LogisticsCatalogInvalidInputError extends Error {}
export class LogisticsCatalogTypeInactiveError extends Error {}

function wellFormed(value:string):boolean{for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){if(i+1>=value.length)return false;const n=value.charCodeAt(++i);if(n<0xdc00||n>0xdfff)return false;}else if(c>=0xdc00&&c<=0xdfff)return false;}return true;}
function validLogin(value:unknown):value is string{return typeof value==="string"&&wellFormed(value)&&Array.from(value).length>=1&&Array.from(value).length<=512&&Buffer.byteLength(value,"utf8")<=1024;}
function validBootstrap(value:unknown):value is string{if(!validLogin(value))return false;const n=Array.from(value).length;return n<=12||n>=16;}
function validNew(value:unknown):value is string{return typeof value==="string"&&wellFormed(value)&&Array.from(value).length>=1&&Array.from(value).length<=12;}
function derive(password:string,salt:Buffer):Buffer{return scryptSync(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});}
function text(value:unknown,max:number):string|undefined{if(typeof value!=="string"||value!==value.trim()||!wellFormed(value))return undefined;const n=Array.from(value).length;return n>=1&&n<=max?value:undefined;}
function code(value:unknown):string|undefined{const v=text(value,64);return v&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v)?v.toLowerCase():undefined;}
function sortOrder(value:unknown, fallback=0):number|undefined{return value===undefined?fallback:(typeof value==="number"&&Number.isSafeInteger(value)&&value>=0?value:undefined);}

export class LogisticsTypeCatalogService{
  private readonly catalog:LogisticsTypeCatalogRepository;
  private readonly clock:()=>Date;
  constructor(private readonly database:Database.Database,options:{clock?:()=>Date}={}){this.catalog=new LogisticsTypeCatalogRepository(database);this.clock=options.clock??(()=>new Date());}
  adminCredentialConfigured():boolean{return this.catalog.getAdminCredential()!==undefined;}
  unlockAdmin(candidate:string,configuredPassword:string|undefined):{rawToken:string;expiresAt:string}|undefined{
    if(!validLogin(candidate))return undefined;let credential=this.catalog.getAdminCredential();
    if(!credential){if(!validBootstrap(configuredPassword))return undefined;const salt=randomBytes(16);this.catalog.seedAdminCredential({passwordSalt:salt,passwordHash:derive(configuredPassword,salt),updatedAt:this.clock().toISOString()});credential=this.catalog.getAdminCredential();}
    if(!credential)return undefined;const hash=derive(candidate,credential.passwordSalt);if(!timingSafeEqual(hash,credential.passwordHash))return undefined;
    const now=this.clock(),expires=new Date(now.getTime()+LOGISTICS_CATALOG_ADMIN_SESSION_TTL_SECONDS*1000),token=createSessionToken();this.catalog.insertAdminSession({tokenHash:token.tokenHash,createdAt:now.toISOString(),expiresAt:expires.toISOString()});return{rawToken:token.rawToken,expiresAt:expires.toISOString()};
  }
  authorizeAdmin(rawToken:string|undefined):boolean{if(!rawToken)return false;const s=this.catalog.findAdminSessionByHash(hashSessionToken(rawToken));return !!s&&s.revokedAt===null&&Date.parse(s.expiresAt)>this.clock().getTime();}
  logoutAdmin(rawToken:string|undefined):void{if(!rawToken)return;const s=this.catalog.findAdminSessionByHash(hashSessionToken(rawToken));if(s&&s.revokedAt===null)this.catalog.revokeAdminSession(s.id,this.clock().toISOString());}
  changeAdminPassword(rawToken:string|undefined,newPassword:string):{rawToken:string;expiresAt:string}{
    if(!this.authorizeAdmin(rawToken))throw new LogisticsCatalogAuthorizationError();if(!validNew(newPassword))throw new LogisticsCatalogInvalidInputError();
    const salt=randomBytes(16),now=this.clock(),expires=new Date(now.getTime()+LOGISTICS_CATALOG_ADMIN_SESSION_TTL_SECONDS*1000),token=createSessionToken();
    const tx=this.database.transaction(()=>{if(!this.authorizeAdmin(rawToken))throw new LogisticsCatalogAuthorizationError();this.catalog.replaceAdminCredential({passwordSalt:salt,passwordHash:derive(newPassword,salt),updatedAt:now.toISOString()});this.catalog.revokeAllAdminSessions(now.toISOString());this.catalog.insertAdminSession({tokenHash:token.tokenHash,createdAt:now.toISOString(),expiresAt:expires.toISOString()});});tx.immediate();return{rawToken:token.rawToken,expiresAt:expires.toISOString()};
  }
  getActiveCatalog():LogisticsActiveTypeCatalogResponse{return{data:{equipmentTypes:this.catalog.list("equipment",true).map(({code,name})=>({code,name})),systemTypes:this.catalog.list("system",true).map(({code,name})=>({code,name}))}};}
  getCatalog(rawToken:string|undefined):LogisticsTypeCatalogResponse{if(!this.authorizeAdmin(rawToken))throw new LogisticsCatalogAuthorizationError();return{data:{revision:this.catalog.getRevision(),equipmentTypes:this.catalog.list("equipment"),systemTypes:this.catalog.list("system")}};}
  assertActiveType(kind:LogisticsTypeKind,value:string):void{const item=this.catalog.find(kind,value);if(!item)throw new LogisticsCatalogNotFoundError();if(!item.active)throw new LogisticsCatalogTypeInactiveError();}
  create(kind:LogisticsTypeKind,rawToken:string|undefined,expectedRevision:number,input:CreateLogisticsTypeRequest):LogisticsTypeCatalogResponse{
    if(!this.authorizeAdmin(rawToken))throw new LogisticsCatalogAuthorizationError();const canonicalCode=code(input?.code),name=text(input?.name,200),order=sortOrder(input?.sortOrder);if(!canonicalCode||!name||order===undefined|| (input.active!==undefined&&typeof input.active!=="boolean"))throw new LogisticsCatalogInvalidInputError();
    const tx=this.database.transaction(()=>{if(this.catalog.getRevision()!==expectedRevision)throw new LogisticsCatalogRevisionMismatchError();if(this.catalog.find(kind,canonicalCode))throw new LogisticsCatalogInvalidInputError();const now=this.clock().toISOString();this.catalog.insert(kind,{code:canonicalCode,name,active:input.active??true,sortOrder:order,now});if(!this.catalog.advanceRevision(expectedRevision,now))throw new LogisticsCatalogRevisionMismatchError();return this.getCatalog(rawToken);});return tx.immediate();
  }
  update(kind:LogisticsTypeKind,typeCode:string,rawToken:string|undefined,expectedRevision:number,input:UpdateLogisticsTypeRequest):LogisticsTypeCatalogResponse{
    if(!this.authorizeAdmin(rawToken))throw new LogisticsCatalogAuthorizationError();const keys=Object.keys(input??{});if(keys.length===0||keys.some(k=>!["name","active","sortOrder"].includes(k)))throw new LogisticsCatalogInvalidInputError();const name=input.name===undefined?undefined:text(input.name,200),order=input.sortOrder===undefined?undefined:sortOrder(input.sortOrder);if(input.name!==undefined&&!name||input.sortOrder!==undefined&&order===undefined||input.active!==undefined&&typeof input.active!=="boolean")throw new LogisticsCatalogInvalidInputError();
    const tx=this.database.transaction(()=>{if(this.catalog.getRevision()!==expectedRevision)throw new LogisticsCatalogRevisionMismatchError();const current=this.catalog.find(kind,typeCode);if(!current)throw new LogisticsCatalogNotFoundError();const now=this.clock().toISOString();this.catalog.update(kind,typeCode,{name,active:input.active,sortOrder:order,now});if(!this.catalog.advanceRevision(expectedRevision,now))throw new LogisticsCatalogRevisionMismatchError();return this.getCatalog(rawToken);});return tx.immediate();
  }
}
