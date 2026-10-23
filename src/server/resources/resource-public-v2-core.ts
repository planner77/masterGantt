import { RESOURCE_READ_VERSION_HEADER, isRetiredResourceSelection, resourceV2FiltersToInternal, toResourcePublicV2, type ResourceReadVersion } from "../../contracts/resource-public-v2";
import { PublicApiError } from "../http/api-error-core";
export function resourceReadVersion(request:Request):ResourceReadVersion {
  const value=request.headers.get(RESOURCE_READ_VERSION_HEADER);
  if (value !== null && value !== "1" && value !== "2") throw new PublicApiError(400,"INVALID_REQUEST","조회 API 버전을 확인해 주세요.");
  return value === "1" ? 1 : 2;
}
export function resourceReadInput(value:unknown,version:ResourceReadVersion):unknown {
  if(version===1)return value;
  if(isRetiredResourceSelection(value)) throw new PublicApiError(410,"RESOURCE_SELECTION_RETIRED","이전 조회 조건은 지원하지 않습니다. 공정·WorkArea·설비·물류 시스템 관점에서 다시 선택해 주세요.");
  return resourceV2FiltersToInternal(value);
}
export function resourceReadParams(params:URLSearchParams,version:ResourceReadVersion):URLSearchParams {
  if(version===1)return params;
  const fields:Record<string,unknown>={};
  for(const key of params.keys()) fields[key]=key === "projectionOrder" ? params.getAll(key).flatMap(v=>v.split(",")) : params.getAll(key);
  resourceReadInput(fields,version);
  const result=new URLSearchParams();
  for(const [key,value] of params)result.append(key === "equipmentTypeCodes" ? "physicalEquipmentTypeCodes" : key === "systemTypeCodes" ? "physicalSystemTypeCodes" : key,value);
  return result;
}
export function resourceReadOutput(value:unknown,version:ResourceReadVersion):unknown {return version===1 ? value : toResourcePublicV2(value);}
export function resourceReadHeaders(version:ResourceReadVersion):Record<string,string> {
  return {"X-MasterGantt-Resource-Version":String(version),...(version===1?{"Deprecation":"true","Link":"<https://github.com/planner77/masterGantt/blob/main/docs/API.md>; rel=\"deprecation\""}:{})};
}
/** Public errors describe the physical read; internal audit paths remain available in v1. */
export function resourceReadError(error:unknown,request:Request):unknown {
  if(request.headers.get(RESOURCE_READ_VERSION_HEADER)==="1" || !(error instanceof PublicApiError))return error;
  const neutral=(text:string)=>text.replaceAll("Target", "설비·시스템").replaceAll("targetRows","connectionRows").replaceAll("TargetSources","ConnectionSources").replaceAll("targetSources","connectionSources").replaceAll("projection.target.","projection.connection.");
  return new PublicApiError(error.status,error.code,neutral(error.publicMessage),error.details.map(row=>({...row,...(row.path === undefined ? {} : {path:neutral(row.path)}),message:neutral(row.message)})),error.responseHeaders);
}
