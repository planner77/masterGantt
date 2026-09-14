import { z } from "zod";
import type { ApiErrorDetail,CreateTaskRequest,UpdateTaskRequest } from "../../contracts/projects";
import { isCanonicalUuidV4 } from "./project-contract";
function isWellFormedUnicode(value:string){for(let i=0;i<value.length;i+=1){const c=value.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){if(i+1>=value.length)return false;const n=value.charCodeAt(i+1);if(n<0xdc00||n>0xdfff)return false;i+=1}else if(c>=0xdc00&&c<=0xdfff)return false}return true}
function codePointLength(v:string){return Array.from(v).length}
const wellFormedString=z.string().refine(isWellFormedUnicode);
const taskName=wellFormedString.transform(v=>v.trim()).refine(v=>codePointLength(v)>=1&&codePointLength(v)<=200);
const externalId=wellFormedString.refine(v=>codePointLength(v)>=1&&codePointLength(v)<=128&&!/^\p{White_Space}|\p{White_Space}$/u.test(v)&&!/[\p{Cc}\p{Cf}]/u.test(v));
const description=wellFormedString.refine(v=>codePointLength(v)<=4000).nullable();
const taskUrl=wellFormedString.refine(v=>{if(codePointLength(v)>2048)return false;try{const u=new URL(v);return u.protocol==="http:"||u.protocol==="https:"}catch{return false}}).nullable();
const leafType=z.enum(["task","milestone"]),scheduleMode=z.enum(["auto","manual"]),dateLabel=wellFormedString,duration=z.number().int(),progress=z.number().finite().min(0).max(100);
const createTaskSchema=z.object({externalId:externalId.optional(),parentTaskId:z.string().refine(isCanonicalUuidV4).optional(),convertParentToSummary:z.literal(true).optional(),name:taskName,type:leafType,scheduleMode:scheduleMode.optional(),start:dateLabel,end:dateLabel.optional(),duration,progress,parentExternalId:z.null().optional(),description:description.optional(),url:taskUrl.optional()}).strict().refine(v=>v.convertParentToSummary!==true||v.parentTaskId!==undefined,{path:["convertParentToSummary"],message:"Parent conversion requires parentTaskId."});
const updateTaskSchema=z.object({name:taskName.optional(),scheduleMode:scheduleMode.optional(),start:dateLabel.optional(),end:dateLabel.optional(),duration:duration.optional(),progress:progress.optional(),description:description.optional(),url:taskUrl.optional()}).strict().refine(v=>Object.keys(v).length>0,{message:"At least one task field is required."}).refine(v=>v.end===undefined||v.start!==undefined||v.duration!==undefined,{path:["end"],message:"End requires start or duration."});
type ParseResult<T>={success:true;data:T}|{success:false;details:ApiErrorDetail[]};
function parseStrict<T>(schema:z.ZodType<T>,input:unknown):ParseResult<T>{const result=schema.safeParse(input);if(result.success)return result;return{success:false,details:result.error.issues.map(issue=>({path:issue.code==="unrecognized_keys"?"$":issue.path.length>0?issue.path.join("."):"$",code:issue.code==="unrecognized_keys"?"UNKNOWN_FIELD":"INVALID_FIELD",message:issue.code==="unrecognized_keys"?"The request contains an unknown field.":"Invalid field value."}))}}
export function parseCreateTaskInput(input:unknown):ParseResult<CreateTaskRequest>{return parseStrict(createTaskSchema,input)}
export function parseUpdateTaskInput(input:unknown):ParseResult<UpdateTaskRequest>{return parseStrict(updateTaskSchema,input)}
